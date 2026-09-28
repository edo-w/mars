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
	private readonly Dictionary<string, ConcurrentQueue<WorkflowDiagnosticLine>>
		preRunDiagnostics = new(StringComparer.Ordinal);
	private bool loaded;

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

		var isDeclared = this.manifest?.Modules.Any(item => item.Path == modulePath) == true;
		if (!isDeclared)
		{
			return null;
		}

		await this.LoadAllAsync(cancellationToken);
		var module = this.modules[modulePath];

		return module;
	}

	private async Task LoadAllAsync(CancellationToken cancellationToken)
	{
		if (this.loaded)
		{
			return;
		}

		var outputs = new Dictionary<string, JsonNode?>(StringComparer.Ordinal);
		try
		{
			foreach (var entry in this.manifest!.Modules)
			{
				var diagnostics = new ConcurrentQueue<WorkflowDiagnosticLine>();
				this.preRunDiagnostics.Add(entry.Path, diagnostics);
				void CaptureDiagnostic(string line)
				{
					var item = new WorkflowDiagnosticLine(DateTimeOffset.UtcNow, line);
					diagnostics.Enqueue(item);
				}

				var process = new WorkflowModuleProcess(
					entry,
					this.manifest.Directory,
					diagnostic: CaptureDiagnostic
				);
				this.processes.Add(entry.Path, process);
				var output = await process.DescribeAsync(cancellationToken);
				outputs.Add(entry.Path, output);
			}

			var describedModules = this.metadataReader.ReadAll(outputs);
			foreach (var described in describedModules.Values)
			{
				var exports = this.ResolveWorkflowSources(described.Exports);
				var module = new WorkflowModule(described.Path, exports);
				this.modules.Add(module.Path, module);
			}

			this.loaded = true;
		}
		catch
		{
			await this.DisposeAsync();
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
		this.preRunDiagnostics.Clear();
		this.loaded = false;
		GC.SuppressFinalize(this);
	}
}
