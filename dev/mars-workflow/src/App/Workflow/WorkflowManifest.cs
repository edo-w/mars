namespace Mars.Workflow.App.Workflow;

public class WorkflowManifest
{
	public WorkflowManifest(string path, IReadOnlyList<WorkflowModuleEntry> modules)
	{
		this.Path = path;
		this.Modules = modules;
	}

	public string Path { get; }
	public string Directory => System.IO.Path.GetDirectoryName(this.Path)!;
	public IReadOnlyList<WorkflowModuleEntry> Modules { get; }
}

public class WorkflowModuleEntry
{
	public WorkflowModuleEntry(string path, string command, IReadOnlyList<string> arguments)
	{
		this.Path = path;
		this.Command = command;
		this.Arguments = arguments;
	}

	public string Path { get; }
	public string Command { get; }
	public IReadOnlyList<string> Arguments { get; }
}
