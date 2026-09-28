using Mars.Workflow.App.Runtime;

namespace Mars.Workflow.App.Workflow;

public class WorkflowRunLogs
{
	public WorkflowRunLogs(WorkflowRunRecord run, IReadOnlyList<WorkflowLogFile> files)
	{
		this.Run = run;
		this.Files = files;
	}

	public WorkflowRunRecord Run { get; }
	public IReadOnlyList<WorkflowLogFile> Files { get; }
}
