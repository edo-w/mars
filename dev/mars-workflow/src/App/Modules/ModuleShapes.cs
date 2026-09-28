using System.Text.Json.Nodes;
using Mars.Workflow.App.Types;

namespace Mars.Workflow.App.Modules;

public enum ModuleExportKind
{
	Shape,
	Function,
	Task,
	Workflow,
	Constant,
	Value,
}

public class ModuleExport
{
	public ModuleExport(
		string name,
		ModuleExportKind kind,
		WorkflowType? input = null,
		WorkflowType? output = null,
		string? source = null,
		JsonNode? value = null
	)
	{
		this.Name = name;
		this.Kind = kind;
		this.Input = input;
		this.Output = output;
		this.Source = source;
		this.Value = value;
	}

	public string Name { get; }
	public ModuleExportKind Kind { get; }
	public WorkflowType? Input { get; }
	public WorkflowType? Output { get; }
	public string? Source { get; }
	public JsonNode? Value { get; }
}

public class WorkflowModule
{
	public WorkflowModule(string path, IReadOnlyList<ModuleExport> exports)
	{
		this.Path = path;
		this.Exports = exports;
	}

	public string Path { get; }
	public IReadOnlyList<ModuleExport> Exports { get; }
}

public interface IWorkflowModuleCatalog
{
	Task<WorkflowModule?> GetAsync(string modulePath, CancellationToken cancellationToken);
}

public interface IWorkflowSourceReader
{
	Task<string> ReadAsync(string path, CancellationToken cancellationToken);
}
