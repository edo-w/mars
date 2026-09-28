using System.Text.Json.Nodes;
using Mars.Workflow.App.Compiler;
using Mars.Workflow.App.Language;
using Mars.Workflow.App.Types;

namespace Mars.Workflow.App.Runtime;

public class WorkflowVm
{
	private readonly IWorkflowStore store;
	private readonly IWorkflowOperationHost host;
	private readonly WorkflowValueValidator validator;
	private readonly Func<WorkflowEventRecord, Task>? eventSink;

	public WorkflowVm(
		IWorkflowStore store,
		IWorkflowOperationHost host,
		Func<WorkflowEventRecord, Task>? eventSink = null
	)
	{
		this.store = store;
		this.host = host;
		this.validator = new WorkflowValueValidator();
		this.eventSink = eventSink;
	}

	public async Task<WorkflowExecutionResult> RunAsync(
		WorkflowCompilation compilation,
		JsonNode? input,
		string? manifestPath = null,
		CancellationToken cancellationToken = default
	)
	{
		if (!compilation.IsValid || compilation.Root is null)
		{
			throw new WorkflowRuntimeException("Cannot run a workflow with compilation errors.");
		}

		var root = compilation.Root;
		var validatedInput = this.validator.Validate(
			root.Input,
			input,
			"workflow input",
			allowExtraFields: true
		);
		var run = new WorkflowRunRecord
		{
			Id = Guid.CreateVersion7(),
			SourcePath = root.Document.Path,
			ManifestPath = manifestPath,
			State = WorkflowRunState.Pending,
			CreateDate = DateTimeOffset.UtcNow,
			Input = validatedInput?.DeepClone(),
		};
		await this.store.CreateRunAsync(run, cancellationToken);

		try
		{
			run.State = WorkflowRunState.Running;
			await this.store.UpdateRunAsync(run, cancellationToken);
			await this.EmitAsync(run.Id, null, "workflow.started", null, null, cancellationToken);

			var directory = Path.GetDirectoryName(root.Document.Path)!;
			var environment = new Dictionary<string, string>(StringComparer.Ordinal);
			var output = await this.ExecuteFrameAsync(
				root,
				validatedInput,
				directory,
				environment,
				run.Id,
				cancellationToken
			);
			var validatedOutput = this.validator.Validate(
				root.Output,
				output,
				"workflow output"
			);

			run.Output = validatedOutput;
			run.State = WorkflowRunState.Succeeded;
			run.EndDate = DateTimeOffset.UtcNow;
			await this.store.UpdateRunAsync(run, cancellationToken);
			await this.EmitAsync(
				run.Id,
				null,
				"workflow.returned",
				null,
				validatedOutput,
				cancellationToken
			);
			await this.EmitAsync(
				run.Id,
				null,
				"workflow.completed",
				null,
				validatedOutput,
				cancellationToken
			);
		}
		catch (OperationCanceledException)
		{
			run.State = WorkflowRunState.Cancelled;
			run.EndDate = DateTimeOffset.UtcNow;
			run.Error = "Cancelled";
			await this.store.UpdateRunAsync(run, CancellationToken.None);
			await this.EmitAsync(
				run.Id,
				null,
				"workflow.cancelled",
				run.Error,
				null,
				CancellationToken.None
			);
		}
		catch (Exception exception)
		{
			run.State = WorkflowRunState.Failed;
			run.EndDate = DateTimeOffset.UtcNow;
			run.Error = exception.Message;
			await this.store.UpdateRunAsync(run, CancellationToken.None);
			await this.EmitAsync(
				run.Id,
				null,
				"workflow.failed",
				run.Error,
				null,
				CancellationToken.None
			);
		}

		return new WorkflowExecutionResult(run);
	}

	private async Task<JsonNode?> ExecuteFrameAsync(
		CompiledWorkflow workflow,
		JsonNode? input,
		string inheritedDirectory,
		IReadOnlyDictionary<string, string> inheritedEnvironment,
		Guid runId,
		CancellationToken cancellationToken
	)
	{
		var scope = new Dictionary<string, JsonNode?>(StringComparer.Ordinal);
		if (input is JsonObject inputObject)
		{
			foreach (var item in inputObject)
			{
				scope[item.Key] = item.Value?.DeepClone();
			}
		}

		var evaluator = this.CreateEvaluator(workflow, runId);
		foreach (var declaration in workflow.Document.Values)
		{
			var value = await evaluator.EvaluateAsync(declaration.Value, scope, cancellationToken);
			scope[declaration.Name] = value;
		}

		var directory = inheritedDirectory;
		var properties = workflow.Document.Properties!;
		if (properties.Workdir is not null)
		{
			var value = await evaluator.EvaluateAsync(properties.Workdir, scope, cancellationToken);
			directory = Path.GetFullPath(WorkflowExpressionEvaluator.ToText(value), directory);
		}

		var environment = new Dictionary<string, string>(inheritedEnvironment, StringComparer.Ordinal);
		foreach (var item in properties.Environment)
		{
			var value = await evaluator.EvaluateAsync(item.Value, scope, cancellationToken);
			environment[item.Key] = WorkflowExpressionEvaluator.ToText(value);
		}

		var result = await this.ExecuteStatementsAsync(
			workflow,
			workflow.Document.Statements,
			scope,
			directory,
			environment,
			runId,
			cancellationToken
		);

		return result.Value;
	}

	private async Task<WorkflowReturn> ExecuteStatementsAsync(
		CompiledWorkflow workflow,
		IReadOnlyList<StatementSyntax> statements,
		Dictionary<string, JsonNode?> scope,
		string directory,
		IReadOnlyDictionary<string, string> environment,
		Guid runId,
		CancellationToken cancellationToken
	)
	{
		var evaluator = this.CreateEvaluator(workflow, runId);
		foreach (var statement in statements)
		{
			cancellationToken.ThrowIfCancellationRequested();

			if (statement is LetSyntax let)
			{
				var value = let.Step is not null
					? await this.ExecuteStepAsync(
						workflow,
						let.Step,
						scope,
						directory,
						environment,
						runId,
						cancellationToken
					)
					: await evaluator.EvaluateAsync(let.Value!, scope, cancellationToken);
				scope[let.Name] = value;
			}
			else if (statement is StepSyntax step)
			{
				await this.ExecuteStepAsync(
					workflow,
					step,
					scope,
					directory,
					environment,
					runId,
					cancellationToken
				);
			}
			else if (statement is ReturnSyntax returned)
			{
				var value = returned.Value is null
					? null
					: await evaluator.EvaluateAsync(returned.Value, scope, cancellationToken);

				return new WorkflowReturn(true, value);
			}
			else if (statement is IfSyntax condition)
			{
				var test = await evaluator.EvaluateAsync(condition.Condition, scope, cancellationToken);
				var branch = test?.GetValue<bool>() == true ? condition.Then : condition.Else;
				var childScope = new Dictionary<string, JsonNode?>(scope, StringComparer.Ordinal);
				var result = await this.ExecuteStatementsAsync(
					workflow,
					branch,
					childScope,
					directory,
					environment,
					runId,
					cancellationToken
				);
				if (result.HasReturn)
				{
					return result;
				}
			}
		}

		return new WorkflowReturn(false, null);
	}

	private async Task<JsonNode?> ExecuteStepAsync(
		CompiledWorkflow workflow,
		StepSyntax syntax,
		IReadOnlyDictionary<string, JsonNode?> scope,
		string directory,
		IReadOnlyDictionary<string, string> environment,
		Guid runId,
		CancellationToken cancellationToken
	)
	{
		var bound = workflow.Steps[syntax];
		var evaluator = this.CreateEvaluator(workflow, runId);
		var rawInput = new JsonObject();
		foreach (var item in syntax.Input)
		{
			var value = await evaluator.EvaluateAsync(item.Value, scope, cancellationToken);
			rawInput[item.Key] = value;
		}

		JsonNode? input = null;
		if (bound.Input.Kind != WorkflowTypeKind.Void)
		{
			input = this.validator.Validate(
				bound.Input,
				rawInput,
				"step input",
				allowExtraFields: true
			);
		}

		var effectiveDirectory = directory;
		if (syntax.Workdir is not null)
		{
			var value = await evaluator.EvaluateAsync(syntax.Workdir, scope, cancellationToken);
			effectiveDirectory = Path.GetFullPath(WorkflowExpressionEvaluator.ToText(value), directory);
		}

		var effectiveEnvironment = new Dictionary<string, string>(environment, StringComparer.Ordinal);
		foreach (var item in syntax.Environment)
		{
			var value = await evaluator.EvaluateAsync(item.Value, scope, cancellationToken);
			effectiveEnvironment[item.Key] = WorkflowExpressionEvaluator.ToText(value);
		}

		var step = new WorkflowStepRecord
		{
			Id = Guid.CreateVersion7(),
			RunId = runId,
			SourceId = $"{syntax.Span.Path}:{syntax.Span.Offset}",
			SourcePath = syntax.Span.Path,
			SourceLine = syntax.Span.Line,
			SourceColumn = syntax.Span.Column,
			Kind = syntax.Kind.ToString().ToLowerInvariant(),
			Target = syntax.Target,
			State = WorkflowRunState.Running,
			CreateDate = DateTimeOffset.UtcNow,
			Input = input?.DeepClone(),
		};
		await this.store.CreateStepAsync(step, cancellationToken);
		await this.EmitAsync(runId, step.Id, "step.started", null, input, cancellationToken);

		try
		{
			JsonNode? output;
			if (bound.Workflow is not null)
			{
				var callDetails = new JsonObject
				{
					["source_path"] = bound.Workflow.Document.Path,
				};
				await this.EmitAsync(
					runId,
					step.Id,
					"workflow.called",
					null,
					callDetails,
					cancellationToken
				);

				output = await this.ExecuteFrameAsync(
					bound.Workflow,
					input,
					effectiveDirectory,
					effectiveEnvironment,
					runId,
					cancellationToken
				);
				await this.EmitAsync(
					runId,
					step.Id,
					"workflow.returned",
					null,
					output,
					cancellationToken
				);
			}
			else
			{
				var operation = new WorkflowOperationContext(
					runId,
					step.Id,
					effectiveDirectory,
					effectiveEnvironment,
					(message, percent, token) => this.ReportProgressAsync(
						runId,
						step.Id,
						message,
						percent,
						token
					)
				);
				output = await this.host.InvokeTaskAsync(bound, input, operation, cancellationToken);
			}

			var validated = this.validator.Validate(bound.Output, output, "step output");
			step.Output = validated?.DeepClone();
			step.State = WorkflowRunState.Succeeded;
			step.EndDate = DateTimeOffset.UtcNow;
			await this.store.UpdateStepAsync(step, cancellationToken);
			await this.EmitAsync(
				runId,
				step.Id,
				"step.completed",
				null,
				validated,
				cancellationToken
			);

			return validated;
		}
		catch (OperationCanceledException)
		{
			step.State = WorkflowRunState.Cancelled;
			step.EndDate = DateTimeOffset.UtcNow;
			await this.store.UpdateStepAsync(step, CancellationToken.None);
			await this.EmitAsync(
				runId,
				step.Id,
				"step.cancelled",
				null,
				null,
				CancellationToken.None
			);

			throw;
		}
		catch (Exception exception)
		{
			step.State = WorkflowRunState.Failed;
			step.EndDate = DateTimeOffset.UtcNow;
			step.Error = exception.Message;
			await this.store.UpdateStepAsync(step, CancellationToken.None);
			await this.EmitAsync(
				runId,
				step.Id,
				"step.failed",
				exception.Message,
				null,
				CancellationToken.None
			);

			throw;
		}
	}

	private async Task ReportProgressAsync(
		Guid runId,
		Guid stepId,
		string message,
		int? percent,
		CancellationToken cancellationToken
	)
	{
		var data = percent is null ? null : new JsonObject { ["percent"] = percent };
		await this.EmitAsync(runId, stepId, "step.progress", message, data, cancellationToken);
	}

	private WorkflowExpressionEvaluator CreateEvaluator(CompiledWorkflow workflow, Guid runId)
	{
		var evaluator = new WorkflowExpressionEvaluator(
			workflow,
			this.host,
			runId,
			(message, percent, token) => this.ReportFunctionProgressAsync(
				runId,
				message,
				percent,
				token
			)
		);

		return evaluator;
	}

	private async Task ReportFunctionProgressAsync(
		Guid runId,
		string message,
		int? percent,
		CancellationToken cancellationToken
	)
	{
		var data = percent is null ? null : new JsonObject { ["percent"] = percent };
		await this.EmitAsync(
			runId,
			null,
			"function.progress",
			message,
			data,
			cancellationToken
		);
	}

	private async Task EmitAsync(
		Guid runId,
		Guid? stepId,
		string name,
		string? message,
		JsonNode? data,
		CancellationToken cancellationToken
	)
	{
		var item = new WorkflowEventRecord
		{
			Id = Guid.CreateVersion7(),
			RunId = runId,
			StepId = stepId,
			Name = name,
			Message = message,
			Data = data?.DeepClone(),
			CreateDate = DateTimeOffset.UtcNow,
		};
		await this.store.AppendEventAsync(item, cancellationToken);

		if (this.eventSink is not null)
		{
			await this.eventSink(item);
		}
	}
}

public class WorkflowReturn
{
	public WorkflowReturn(bool hasReturn, JsonNode? value)
	{
		this.HasReturn = hasReturn;
		this.Value = value;
	}

	public bool HasReturn { get; }
	public JsonNode? Value { get; }
}
