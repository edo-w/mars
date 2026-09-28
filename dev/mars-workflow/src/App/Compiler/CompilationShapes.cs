using Mars.Workflow.App.Language;
using Mars.Workflow.App.Modules;
using Mars.Workflow.App.Types;

namespace Mars.Workflow.App.Compiler;

public class BoundSymbol
{
	public BoundSymbol(string name, WorkflowModule? module = null, ModuleExport? export = null)
	{
		this.Name = name;
		this.Module = module;
		this.Export = export;
	}

	public string Name { get; }
	public WorkflowModule? Module { get; }
	public ModuleExport? Export { get; }
}

public class CompiledWorkflow
{
	public CompiledWorkflow(
		WorkflowDocument document,
		WorkflowType input,
		WorkflowType output,
		IReadOnlyDictionary<string, BoundSymbol> imports,
		IReadOnlyDictionary<string, WorkflowType> shapes
	)
	{
		this.Document = document;
		this.Input = input;
		this.Output = output;
		this.Imports = imports;
		this.Shapes = shapes;
	}

	public WorkflowDocument Document { get; }
	public WorkflowType Input { get; }
	public WorkflowType Output { get; }
	public IReadOnlyDictionary<string, BoundSymbol> Imports { get; }
	public IReadOnlyDictionary<string, WorkflowType> Shapes { get; }
	public Dictionary<StepSyntax, BoundStep> Steps { get; } = new(ReferenceEqualityComparer.Instance);
	public Dictionary<CallSyntax, BoundFunction> Functions { get; } = new(ReferenceEqualityComparer.Instance);
	public Dictionary<ExpressionSyntax, WorkflowType> ExpressionTypes { get; } = new(ReferenceEqualityComparer.Instance);
}

public class BoundStep
{
	public BoundStep(
		StepSyntax syntax,
		WorkflowType input,
		WorkflowType output,
		ModuleExport? export = null,
		WorkflowModule? module = null,
		CompiledWorkflow? workflow = null
	)
	{
		this.Syntax = syntax;
		this.Input = input;
		this.Output = output;
		this.Export = export;
		this.Module = module;
		this.Workflow = workflow;
	}

	public StepSyntax Syntax { get; }
	public WorkflowType Input { get; }
	public WorkflowType Output { get; }
	public ModuleExport? Export { get; }
	public WorkflowModule? Module { get; }
	public CompiledWorkflow? Workflow { get; }
}

public class BoundFunction
{
	public BoundFunction(
		string name,
		WorkflowType input,
		WorkflowType output,
		FunctionSyntax? local = null,
		ModuleExport? export = null,
		WorkflowModule? module = null
	)
	{
		this.Name = name;
		this.Input = input;
		this.Output = output;
		this.Local = local;
		this.Export = export;
		this.Module = module;
	}

	public string Name { get; }
	public WorkflowType Input { get; }
	public WorkflowType Output { get; }
	public FunctionSyntax? Local { get; }
	public ModuleExport? Export { get; }
	public WorkflowModule? Module { get; }
}

public class WorkflowCompilation
{
	public WorkflowCompilation(
		CompiledWorkflow? root,
		IReadOnlyList<WorkflowDiagnostic> diagnostics,
		IReadOnlyDictionary<string, CompiledWorkflow> workflows
	)
	{
		this.Root = root;
		this.Diagnostics = diagnostics;
		this.Workflows = workflows;
	}

	public CompiledWorkflow? Root { get; }
	public IReadOnlyList<WorkflowDiagnostic> Diagnostics { get; }
	public IReadOnlyDictionary<string, CompiledWorkflow> Workflows { get; }
	public bool IsValid => this.Root is not null && this.Diagnostics.Count == 0;
}
