using Mars.Workflow.App.Compiler;

namespace Mars.Workflow.App.Workflow;

public class WorkflowSession : IAsyncDisposable
{
	public WorkflowSession(
		WorkflowCompilation compilation,
		WorkflowManifest? manifest,
		WorkflowModuleCatalog modules
	)
	{
		this.Compilation = compilation;
		this.Manifest = manifest;
		this.Modules = modules;
	}

	public WorkflowCompilation Compilation { get; }
	public WorkflowManifest? Manifest { get; }
	public WorkflowModuleCatalog Modules { get; }

	public async ValueTask DisposeAsync()
	{
		await this.Modules.DisposeAsync();
		GC.SuppressFinalize(this);
	}
}
