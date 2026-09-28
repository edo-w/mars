using System.Text.Json.Nodes;
using Mars.Core.Lib;
using Mars.Workflow.App.Compiler;
using Mars.Workflow.App.Modules;
using Mars.Workflow.App.Runtime;
using Mars.Workflow.App.Types;

namespace Mars.Workflow.App.Workflow;

public class WorkflowService
{
	private readonly IWorkflowStorageProvider storageProvider;
	private readonly IVProcess process;

	public WorkflowService(IWorkflowStorageProvider storageProvider, IVProcess process)
	{
		this.storageProvider = storageProvider;
		this.process = process;
	}

	public async Task<WorkflowSession> CompileAsync(
		string path,
		CancellationToken cancellationToken
	)
	{
		var fullPath = Path.GetFullPath(path, this.process.CurrentDirectory);
		var manifest = WorkflowManifestLoader.Find(fullPath);
		var modules = new WorkflowModuleCatalog(manifest);

		try
		{
			IWorkflowSourceReader sourceReader = new FileWorkflowSourceReader();
			var compiler = new WorkflowCompiler(sourceReader, modules);
			var compilation = await compiler.CompileAsync(fullPath, cancellationToken);
			var session = new WorkflowSession(compilation, manifest, modules);

			return session;
		}
		catch
		{
			await modules.DisposeAsync();
			throw;
		}
	}

	public async Task<WorkflowExecutionResult> RunAsync(
		WorkflowSession session,
		JsonNode? input,
		Func<WorkflowEventRecord, Task>? eventSink,
		CancellationToken cancellationToken
	)
	{
		if (!session.Compilation.IsValid)
		{
			throw new WorkflowRuntimeException("Workflow has compilation errors.");
		}

		var sourcePath = session.Compilation.Root!.Document.Path;
		await using var storage = await this.storageProvider.OpenForRunAsync(
			sourcePath,
			cancellationToken
		);
		var shell = new WorkflowShellRunner(storage.Logs);
		var host = new WorkflowOperationHost(session.Modules, shell, storage.Logs);
		var diagnostics = new WorkflowDiagnosticWriter(storage.Logs);
		using var eventLog = new WorkflowEventLogWriter(storage.Logs);
		async Task ReportEventAsync(WorkflowEventRecord item)
		{
			await eventLog.WriteAsync(item, CancellationToken.None);

			var atRunBoundary = item.Name is "workflow.started"
				or "workflow.completed" or "workflow.failed" or "workflow.cancelled";
			if (atRunBoundary)
			{
				await session.Modules.PersistPreRunDiagnosticsAsync(
					item.RunId,
					diagnostics,
					CancellationToken.None
				);
			}

			if (eventSink is not null)
			{
				await eventSink(item);
			}
		}

		var vm = new WorkflowVm(storage.Store, host, ReportEventAsync);
		var result = await vm.RunAsync(
			session.Compilation,
			input,
			session.Manifest?.Path,
			cancellationToken
		);

		return result;
	}

	public async Task<IReadOnlyList<WorkflowRunRecord>> ListRunsAsync(
		CancellationToken cancellationToken
	)
	{
		await using var storage = await this.storageProvider.OpenForHistoryAsync(cancellationToken);
		if (storage is null)
		{
			return [];
		}

		var runs = await storage.Store.ListRunsAsync(cancellationToken);

		return runs;
	}

	public async Task<WorkflowRunLogs> ReadLogsAsync(
		Guid? runId,
		CancellationToken cancellationToken
	)
	{
		await using var storage = await this.storageProvider.OpenForHistoryAsync(cancellationToken);
		if (storage is null)
		{
			throw new NotFoundException("No workflow runs found.");
		}

		WorkflowRunRecord? run;

		if (runId is null)
		{
			var runs = await storage.Store.ListRunsAsync(cancellationToken);
			run = runs.Count > 0 ? runs[0] : null;
		}
		else
		{
			run = await storage.Store.GetRunAsync(runId.Value, cancellationToken);
		}

		if (run is null)
		{
			var message = runId is null
				? "No workflow runs found."
				: $"Workflow run '{runId}' was not found.";
			throw new NotFoundException(message);
		}

		var files = await storage.Logs.ReadAsync(run.Id, cancellationToken);
		var result = new WorkflowRunLogs(run, files);

		return result;
	}

	public async Task<JsonNode?> ParseInputAsync(
		WorkflowType type,
		string? inputFile,
		string? inputJson,
		IReadOnlyList<string> pairs,
		CancellationToken cancellationToken
	)
	{
		if (inputFile is not null && inputJson is not null)
		{
			throw new WorkflowRuntimeException("Use either --input-file or --input-json.");
		}

		if (inputFile is not null)
		{
			var fullPath = Path.GetFullPath(inputFile, this.process.CurrentDirectory);
			inputJson = await File.ReadAllTextAsync(fullPath, cancellationToken);
		}

		var input = ParseInput(type, inputJson, pairs);

		return input;
	}

	public static JsonNode? ParseInput(
		WorkflowType type,
		string? inputJson,
		IReadOnlyList<string> pairs
	)
	{
		JsonNode? input;
		if (inputJson is null)
		{
			input = type.Kind == WorkflowTypeKind.Shape ? new JsonObject() : null;
		}
		else
		{
			try
			{
				input = JsonNode.Parse(inputJson);
			}
			catch (System.Text.Json.JsonException exception)
			{
				throw new WorkflowRuntimeException("Workflow input must be valid JSON.", exception);
			}
		}

		if (pairs.Count == 0)
		{
			return input;
		}

		if (input is not JsonObject obj || type.Kind != WorkflowTypeKind.Shape)
		{
			throw new WorkflowRuntimeException("--input needs an object workflow input.");
		}

		var provided = new HashSet<string>(StringComparer.Ordinal);
		foreach (var pair in pairs)
		{
			var equalsIndex = pair.IndexOf('=');
			if (equalsIndex <= 0)
			{
				throw new WorkflowRuntimeException($"Input '{pair}' must be written as key=value.");
			}

			var path = pair[..equalsIndex];
			var value = pair[(equalsIndex + 1)..];
			if (!provided.Add(path))
			{
				throw new WorkflowRuntimeException($"Input property '{path}' was provided twice.");
			}

			SetInputProperty(obj, type, path, value);
		}

		return input;
	}

	private static void SetInputProperty(
		JsonObject input,
		WorkflowType inputType,
		string path,
		string value
	)
	{
		var segments = path.Split('.');
		var currentObject = input;
		var currentType = inputType;
		for (var index = 0; index < segments.Length; index++)
		{
			var segment = segments[index];
			var field = currentType.Fields.FirstOrDefault(item => item.Name == segment);
			if (field is null || segment.Length == 0)
			{
				throw new WorkflowRuntimeException($"Unknown input property '{path}'.");
			}

			var fieldType = field.Type.Kind == WorkflowTypeKind.Optional
				? field.Type.Element ?? WorkflowType.Unknown
				: field.Type;
			var isLast = index == segments.Length - 1;
			if (isLast)
			{
				currentObject[segment] = ParsePropertyValue(fieldType, value, path);

				return;
			}

			if (fieldType.Kind != WorkflowTypeKind.Shape)
			{
				throw new WorkflowRuntimeException($"Input property '{path}' cannot use a nested field.");
			}

			if (!currentObject.TryGetPropertyValue(segment, out var child) || child is null)
			{
				var nested = new JsonObject();
				currentObject[segment] = nested;
				currentObject = nested;
			}
			else if (child is JsonObject nested)
			{
				currentObject = nested;
			}
			else
			{
				throw new WorkflowRuntimeException($"Input property '{segment}' must be an object.");
			}

			currentType = fieldType;
		}
	}

	private static JsonNode? ParsePropertyValue(WorkflowType type, string value, string path)
	{
		var isText = type.Kind is WorkflowTypeKind.Text or WorkflowTypeKind.Path
			or WorkflowTypeKind.Url or WorkflowTypeKind.Datetime;
		if (isText)
		{
			return JsonValue.Create(value);
		}

		try
		{
			return JsonNode.Parse(value);
		}
		catch (System.Text.Json.JsonException exception)
		{
			throw new WorkflowRuntimeException(
				$"Input property '{path}' must be valid JSON.",
				exception
			);
		}
	}
}
