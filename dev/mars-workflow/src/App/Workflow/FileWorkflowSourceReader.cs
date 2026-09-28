using Mars.Workflow.App.Modules;

namespace Mars.Workflow.App.Workflow;

public class FileWorkflowSourceReader : IWorkflowSourceReader
{
	public Task<string> ReadAsync(string path, CancellationToken cancellationToken)
	{
		return File.ReadAllTextAsync(path, cancellationToken);
	}
}
