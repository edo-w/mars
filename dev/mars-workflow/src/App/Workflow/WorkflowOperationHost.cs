using System.Text.Json.Nodes;
using System.Collections.Concurrent;
using Mars.Workflow.App.Compiler;
using Mars.Workflow.App.Runtime;
using Mars.Workflow.App.Types;

namespace Mars.Workflow.App.Workflow;

public class WorkflowOperationHost : IWorkflowOperationHost
{
	private readonly WorkflowModuleCatalog modules;
	private readonly WorkflowShellRunner shell;
	private readonly WorkflowDiagnosticWriter diagnostics;

	public WorkflowOperationHost(
		WorkflowModuleCatalog modules,
		WorkflowShellRunner shell,
		IWorkflowLogStore logs
	)
	{
		this.modules = modules;
		this.shell = shell;
		this.diagnostics = new WorkflowDiagnosticWriter(logs);
	}

	public async Task<JsonNode?> InvokeTaskAsync(
		BoundStep step,
		JsonNode? input,
		WorkflowOperationContext context,
		CancellationToken cancellationToken
	)
	{
		if (step.Syntax.Target == "mars.run")
		{
			var command = input?["command"]?.GetValue<string>();
			if (command is null)
			{
				throw new WorkflowRuntimeException("mars.run needs a command.");
			}

			var exitCode = await this.shell.RunAsync(command, context, cancellationToken);
			var result = new JsonObject { ["exit_code"] = exitCode };

			return result;
		}

		if (step.Module is null || step.Export is null)
		{
			throw new WorkflowRuntimeException($"Task '{step.Syntax.Target}' has no implementation.");
		}

		var process = this.modules.GetProcess(step.Module.Path);
		var lines = new ConcurrentQueue<WorkflowDiagnosticLine>();
		void CaptureDiagnostic(string line)
		{
			var item = new WorkflowDiagnosticLine(DateTimeOffset.UtcNow, line);
			lines.Enqueue(item);
		}

		process.Diagnostic += CaptureDiagnostic;
		JsonNode? output;
		try
		{
			var outputIsVoid = step.Export.Output?.Kind == WorkflowTypeKind.Void;
			output = await process.InvokeTaskAsync(
				step.Export.Name,
				input,
				outputIsVoid,
				context.Progress,
				cancellationToken
			);
		}
		finally
		{
			process.Diagnostic -= CaptureDiagnostic;
			await this.diagnostics.WriteAsync(
				context.RunId,
				context.StepId,
				step.Module.Path,
				lines,
				CancellationToken.None
			);
		}

		return output;
	}

	public async Task<JsonNode?> InvokeFunctionAsync(
		BoundFunction function,
		JsonNode? input,
		Guid runId,
		Func<string, int?, CancellationToken, Task> progress,
		CancellationToken cancellationToken
	)
	{
		if (function.Module is null || function.Export is null)
		{
			throw new WorkflowRuntimeException($"Function '{function.Name}' has no implementation.");
		}

		var process = this.modules.GetProcess(function.Module.Path);
		var outputIsVoid = function.Export.Output?.Kind == WorkflowTypeKind.Void;
		var lines = new ConcurrentQueue<WorkflowDiagnosticLine>();
		void CaptureDiagnostic(string line)
		{
			var item = new WorkflowDiagnosticLine(DateTimeOffset.UtcNow, line);
			lines.Enqueue(item);
		}

		process.Diagnostic += CaptureDiagnostic;
		JsonNode? output;
		try
		{
			output = await process.InvokeFunctionAsync(
				function.Export.Name,
				input,
				outputIsVoid,
				progress,
				cancellationToken
			);
		}
		finally
		{
			process.Diagnostic -= CaptureDiagnostic;
			await this.diagnostics.WriteAsync(
				runId,
				null,
				function.Module.Path,
				lines,
				CancellationToken.None
			);
		}

		return output;
	}
}
