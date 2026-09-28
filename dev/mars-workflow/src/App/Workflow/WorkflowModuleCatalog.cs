using System.Collections.Concurrent;
using System.Text.Json.Nodes;
using Mars.Workflow.App.Modules;

namespace Mars.Workflow.App.Workflow;

public class WorkflowModuleCatalog : IWorkflowModuleCatalog, IAsyncDisposable
{
	private readonly WorkflowManifest? manifest;
	private readonly ModuleMetadataReader metadataReader = new();
	private readonly Dictionary<string, WorkflowModuleProcess> processes = new(StringComparer.Ordinal);
	private readonly Dictionary<string, WorkflowModule> modules = new(StringComparer.Ordinal);
	private readonly Dictionary<string, JsonNode?> outputs = new(StringComparer.Ordinal);
	private readonly Dictionary<string, ConcurrentQueue<WorkflowDiagnosticLine>>
		preRunDiagnostics = new(StringComparer.Ordinal);

	public WorkflowModuleCatalog(WorkflowManifest? manifest)
	{
		this.manifest = manifest;
	}

	public async Task<WorkflowModule?> GetAsync(
		string modulePath,
		CancellationToken cancellationToken
	)
	{
		if (this.modules.TryGetValue(modulePath, out var existing))
		{
			return existing;
		}

		var entry = this.manifest?.Modules.FirstOrDefault(item => item.Path == modulePath);
		if (entry is null)
		{
			return null;
		}

		await this.DescribeModuleAsync(entry, cancellationToken);
		while (true)
		{
			try
			{
				var describedModules = this.metadataReader.ReadAll(this.outputs);
				foreach (var described in describedModules.Values)
				{
					var exports = this.ResolveWorkflowSources(described.Exports);
					this.modules[described.Path] = new WorkflowModule(described.Path, exports);
				}

				break;
			}
			catch (UnknownModuleShapeException exception)
			{
				var dependency = this.FindShapeModule(exception.Reference);
				if (dependency is null || this.outputs.ContainsKey(dependency.Path))
				{
					throw;
				}

				await this.DescribeModuleAsync(dependency, cancellationToken);
			}
		}

		var module = this.modules[modulePath];

		return module;
	}

	private WorkflowModuleEntry? FindShapeModule(string reference)
	{
		var separator = reference.LastIndexOf('/');
		if (separator <= 0)
		{
			return null;
		}

		var modulePath = reference[..separator];
		var entry = this.manifest?.Modules.FirstOrDefault(item => item.Path == modulePath);

		return entry;
	}

	private async Task DescribeModuleAsync(
		WorkflowModuleEntry entry,
		CancellationToken cancellationToken
	)
	{
		if (this.outputs.ContainsKey(entry.Path))
		{
			return;
		}

		var diagnostics = new ConcurrentQueue<WorkflowDiagnosticLine>();
		void CaptureDiagnostic(string line)
		{
			var item = new WorkflowDiagnosticLine(DateTimeOffset.UtcNow, line);
			diagnostics.Enqueue(item);
		}

		var process = new WorkflowModuleProcess(
			entry,
			this.manifest!.Directory,
			diagnostic: CaptureDiagnostic
		);
		try
		{
			var output = await process.DescribeAsync(cancellationToken);
			this.outputs.Add(entry.Path, output);
			this.processes.Add(entry.Path, process);
			this.preRunDiagnostics.Add(entry.Path, diagnostics);
		}
		catch
		{
			await process.DisposeAsync();
			throw;
		}
	}

	public WorkflowModuleProcess GetProcess(string modulePath)
	{
		if (!this.processes.TryGetValue(modulePath, out var process))
		{
			throw new InvalidOperationException($"Module '{modulePath}' was not described.");
		}

		return process;
	}

	public async Task PersistPreRunDiagnosticsAsync(
		Guid runId,
		WorkflowDiagnosticWriter writer,
		CancellationToken cancellationToken
	)
	{
		foreach (var item in this.preRunDiagnostics)
		{
			await writer.WriteAsync(
				runId,
				null,
				item.Key,
				item.Value,
				cancellationToken
			);
		}
	}

	private List<ModuleExport> ResolveWorkflowSources(
		IReadOnlyList<ModuleExport> exports
	)
	{
		var result = new List<ModuleExport>();
		foreach (var export in exports)
		{
			if (export.Kind != ModuleExportKind.Workflow || export.Source is null)
			{
				result.Add(export);
				continue;
			}

			var sourcePath = Path.GetFullPath(export.Source, this.manifest!.Directory);
			var mapped = new ModuleExport(export.Name, export.Kind, source: sourcePath);
			result.Add(mapped);
		}

		return result;
	}

	public async ValueTask DisposeAsync()
	{
		foreach (var process in this.processes.Values)
		{
			await process.DisposeAsync();
		}

		this.processes.Clear();
		this.modules.Clear();
		this.outputs.Clear();
		this.preRunDiagnostics.Clear();
		GC.SuppressFinalize(this);
	}
}
