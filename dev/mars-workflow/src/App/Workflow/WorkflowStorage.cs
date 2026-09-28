using Mars.Workflow.App.Runtime;

namespace Mars.Workflow.App.Workflow;

public interface IWorkflowStorage : IAsyncDisposable
{
	IWorkflowStore Store { get; }
	IWorkflowLogStore Logs { get; }
}

public interface IWorkflowStorageProvider
{
	Task<IWorkflowStorage> OpenForRunAsync(
		string sourcePath,
		CancellationToken cancellationToken
	);

	Task<IWorkflowStorage?> OpenForHistoryAsync(CancellationToken cancellationToken);
}
