using Mars.Workflow.App.Language;
using Mars.Workflow.App.Modules;
using Mars.Workflow.App.Types;

namespace Mars.Workflow.App.Compiler;

public partial class WorkflowBinder
{
	private readonly WorkflowDocument document;
	private readonly IReadOnlyDictionary<string, BoundSymbol> imports;
	private readonly List<WorkflowDiagnostic> diagnostics;
	private readonly Func<string, CancellationToken, Task<CompiledWorkflow?>> compileFile;
	private readonly Dictionary<string, WorkflowType> shapes = new(StringComparer.Ordinal);
	private readonly Dictionary<string, BoundFunction> localFunctions = new(StringComparer.Ordinal);
	private CompiledWorkflow? compiled;

	public WorkflowBinder(
		WorkflowDocument document,
		IReadOnlyDictionary<string, BoundSymbol> imports,
		List<WorkflowDiagnostic> diagnostics,
		Func<string, CancellationToken, Task<CompiledWorkflow?>> compileFile
	)
	{
		this.document = document;
		this.imports = imports;
		this.diagnostics = diagnostics;
		this.compileFile = compileFile;
	}

	public async Task<CompiledWorkflow> BindAsync(CancellationToken cancellationToken)
	{
		this.BindShapes();
		var properties = this.document.Properties!;
		var input = this.ResolveShape(properties.Input);
		var output = this.ResolveShape(properties.Output);
		this.compiled = new CompiledWorkflow(this.document, input, output, this.imports, this.shapes);
		this.BindFunctionSignatures();
		this.BindFunctionBodies();

		var scope = new Dictionary<string, WorkflowType>(StringComparer.Ordinal);
		this.AddFieldsToScope(input, scope, properties.Span);
		this.BindValues(scope);
		this.BindProperties(properties, scope);
		await this.BindStatementsAsync(this.document.Statements, scope, output, true, cancellationToken);

		return this.compiled;
	}

	private void BindShapes()
	{
		foreach (var shape in this.document.Shapes)
		{
			var collidesImport = this.imports.ContainsKey(shape.Name);
			if (collidesImport)
			{
				this.Report("WF250", $"Name '{shape.Name}' is already imported.", shape.Span);
			}

			var fields = this.ResolveFields(shape.Fields);
			var type = WorkflowType.ShapeOf(shape.Name, fields);
			if (!this.shapes.TryAdd(shape.Name, type))
			{
				this.Report("WF210", $"Duplicate shape '{shape.Name}'.", shape.Span);
			}
		}
	}

	private WorkflowType ResolveShape(ShapeReferenceSyntax? syntax)
	{
		if (syntax is null)
		{
			return WorkflowType.Void;
		}

		if (syntax.Name is not null)
		{
			var found = this.ResolveNamedType(syntax.Name);
			if (found is null)
			{
				this.Report("WF211", $"Unknown shape '{syntax.Name}'.", syntax.Span);

				return WorkflowType.Unknown;
			}

			if (found.Kind != WorkflowTypeKind.Shape)
			{
				this.Report("WF212", $"'{syntax.Name}' is not a shape.", syntax.Span);
			}

			return found;
		}

		var fields = this.ResolveFields(syntax.Fields);

		return WorkflowType.ShapeOf(null, fields);
	}

	private List<WorkflowField> ResolveFields(IReadOnlyList<FieldSyntax> fields)
	{
		var result = new List<WorkflowField>();
		var names = new HashSet<string>(StringComparer.Ordinal);
		foreach (var field in fields)
		{
			if (!names.Add(field.Name))
			{
				this.Report("WF213", $"Duplicate field '{field.Name}'.", field.Span);
			}

			var type = this.ResolveType(field.Type, false);
			var model = new WorkflowField(field.Name, type, field.Default);
			result.Add(model);

			if (field.Default is not null)
			{
				var isStatic = IsStaticDefault(field.Default);
				if (!isStatic)
				{
					this.Report(
						"WF249",
						$"Default for '{field.Name}' must be a constant value.",
						field.Span
					);
				}

				var defaults = new Dictionary<string, WorkflowType>(StringComparer.Ordinal);
				var valueType = this.BindExpression(field.Default, defaults);
				if (!WorkflowType.Accepts(type, valueType))
				{
					this.Report("WF214", $"Default for '{field.Name}' has the wrong type.", field.Span);
				}
			}
		}

		return result;
	}

	private static bool IsStaticDefault(ExpressionSyntax expression)
	{
		if (expression is LiteralSyntax)
		{
			return true;
		}

		if (expression is StringSyntax text)
		{
			return text.Parts.All(part => part.Expression is null);
		}

		if (expression is UnarySyntax unary && unary.Operator is "+" or "-")
		{
			var isInteger = unary.Operand is LiteralSyntax { Value: int };
			var isFloat = unary.Operand is LiteralSyntax { Value: float };

			return isInteger || isFloat;
		}

		if (expression is ArraySyntax array)
		{
			return array.Items.All(IsStaticDefault);
		}

		if (expression is ObjectSyntax obj)
		{
			return obj.Fields.Values.All(IsStaticDefault);
		}

		return false;
	}

	private WorkflowType ResolveType(TypeSyntax syntax, bool allowVoid)
	{
		var type = WorkflowType.Primitive(syntax.Name) ?? this.ResolveNamedType(syntax.Name);
		if (type is null)
		{
			this.Report("WF215", $"Unknown type '{syntax.Name}'.", syntax.Span);
			return WorkflowType.Unknown;
		}

		var invalidVoid = type.Kind == WorkflowTypeKind.Void
			&& (!allowVoid || syntax.IsList || syntax.IsOptional);
		if (invalidVoid)
		{
			this.Report("WF216", "void is only valid as a callable input or output.", syntax.Span);
			return WorkflowType.Unknown;
		}

		if (syntax.IsList)
		{
			type = WorkflowType.ListOf(type);
		}

		if (syntax.IsOptional)
		{
			type = WorkflowType.OptionalOf(type);
		}

		return type;
	}

	private WorkflowType? ResolveNamedType(string name)
	{
		if (this.shapes.TryGetValue(name, out var local))
		{
			return local;
		}

		var symbol = this.FindImport(name);
		if (symbol?.Export?.Kind == ModuleExportKind.Shape)
		{
			return symbol.Export.Output;
		}

		return null;
	}

	private void BindFunctionSignatures()
	{
		foreach (var function in this.document.Functions)
		{
			var collidesExisting = this.imports.ContainsKey(function.Name)
				|| this.shapes.ContainsKey(function.Name);
			if (collidesExisting)
			{
				this.Report(
					"WF250",
					$"Name '{function.Name}' is already defined.",
					function.Span
				);
			}

			var fields = this.ResolveFields(function.Parameters);
			var input = WorkflowType.ShapeOf(null, fields);
			var output = this.ResolveType(function.Output, true);
			var bound = new BoundFunction(function.Name, input, output, local: function);

			if (!this.localFunctions.TryAdd(function.Name, bound))
			{
				this.Report("WF217", $"Duplicate function '{function.Name}'.", function.Span);
			}
		}
	}

	private void BindFunctionBodies()
	{
		foreach (var function in this.document.Functions)
		{
			var bound = this.localFunctions[function.Name];
			var scope = new Dictionary<string, WorkflowType>(StringComparer.Ordinal);
			this.AddFieldsToScope(bound.Input, scope, function.Span);
			this.BindFunctionStatements(function.Body, scope, bound.Output);

			var needsReturn = bound.Output.Kind != WorkflowTypeKind.Void;
			var hasReturn = ContainsReturn(function.Body);
			if (needsReturn && !hasReturn)
			{
				this.Report(
					"WF248",
					$"Function '{function.Name}' does not return on every path.",
					function.Span
				);
			}
		}
	}

	private void BindFunctionStatements(
		IReadOnlyList<StatementSyntax> statements,
		Dictionary<string, WorkflowType> scope,
		WorkflowType output
	)
	{
		foreach (var statement in statements)
		{
			if (statement is StepSyntax || statement is LetSyntax { Step: not null })
			{
				this.Report("WF218", "Functions cannot start tasks or workflows.", statement.Span);
				continue;
			}

			if (statement is LetSyntax let)
			{
				var value = this.BindExpression(let.Value!, scope);
				this.CheckReservedName(let.Name, let.Span);
				if (!scope.TryAdd(let.Name, value))
				{
					this.Report("WF221", $"Duplicate local '{let.Name}'.", let.Span);
				}
			}
			else if (statement is ReturnSyntax returned)
			{
				this.BindReturn(returned, scope, output);
			}
			else if (statement is IfSyntax condition)
			{
				this.BindCondition(condition.Condition, scope);
				this.BindFunctionStatements(condition.Then, new(scope), output);
				this.BindFunctionStatements(condition.Else, new(scope), output);
			}
		}
	}

	private void BindValues(Dictionary<string, WorkflowType> scope)
	{
		foreach (var declaration in this.document.Values)
		{
			this.CheckReservedName(declaration.Name, declaration.Span);
			var type = this.BindExpression(declaration.Value, scope);
			if (!scope.TryAdd(declaration.Name, type))
			{
				this.Report("WF219", $"Duplicate value '{declaration.Name}'.", declaration.Span);
			}
		}
	}

	private void BindProperties(
		WorkflowProperties properties,
		Dictionary<string, WorkflowType> scope
	)
	{
		if (properties.Workdir is not null)
		{
			this.BindTextExpression(properties.Workdir, scope, "workdir");
		}

		foreach (var item in properties.Environment)
		{
			this.BindTextExpression(item.Value, scope, $"env.{item.Key}");
		}
	}

	private async Task BindStatementsAsync(
		IReadOnlyList<StatementSyntax> statements,
		Dictionary<string, WorkflowType> scope,
		WorkflowType output,
		bool isRoot,
		CancellationToken cancellationToken
	)
	{
		foreach (var statement in statements)
		{
			if (statement is LetSyntax let)
			{
				this.CheckReservedName(let.Name, let.Span);
				WorkflowType value;
				if (let.Step is not null)
				{
					var bound = await this.BindStepAsync(let.Step, scope, cancellationToken);
					value = bound.Output;
				}
				else
				{
					value = this.BindExpression(let.Value!, scope);
				}

				if (value.Kind == WorkflowTypeKind.Void)
				{
					this.Report("WF220", "void result cannot be bound with let.", let.Span);
				}

				if (!scope.TryAdd(let.Name, value))
				{
					this.Report("WF221", $"Duplicate local '{let.Name}'.", let.Span);
				}
			}
			else if (statement is StepSyntax step)
			{
				await this.BindStepAsync(step, scope, cancellationToken);
			}
			else if (statement is ReturnSyntax returned)
			{
				this.BindReturn(returned, scope, output);
			}
			else if (statement is IfSyntax condition)
			{
				this.BindCondition(condition.Condition, scope);
				await this.BindStatementsAsync(condition.Then, new(scope), output, false, cancellationToken);
				await this.BindStatementsAsync(condition.Else, new(scope), output, false, cancellationToken);
			}
		}

		if (isRoot && output.Kind != WorkflowTypeKind.Void)
		{
			var hasReturn = ContainsReturn(statements);
			if (!hasReturn)
			{
				this.Report("WF222", "Workflow declares output but has no return.", this.document.Properties!.Span);
			}
		}
	}

	private static bool ContainsReturn(IReadOnlyList<StatementSyntax> statements)
	{
		foreach (var statement in statements)
		{
			if (statement is ReturnSyntax)
			{
				return true;
			}

			if (statement is IfSyntax conditional)
			{
				var thenReturns = ContainsReturn(conditional.Then);
				var elseReturns = ContainsReturn(conditional.Else);
				if (thenReturns && elseReturns)
				{
					return true;
				}
			}
		}

		return false;
	}

	private async Task<BoundStep> BindStepAsync(
		StepSyntax step,
		Dictionary<string, WorkflowType> scope,
		CancellationToken cancellationToken
	)
	{
		BoundStep bound;
		if (step.Kind == StepKind.Run || step.Target == "mars.run")
		{
			var input = WorkflowType.ShapeOf(
				"mars.run.Input",
				[
					new WorkflowField("command", WorkflowType.Text),
				]
			);
			var output = WorkflowType.ShapeOf(
				"mars.run.Output",
				[
					new WorkflowField("exit_code", WorkflowType.I32),
				]
			);
			bound = new BoundStep(step, input, output);
		}
		else if (step.Kind == StepKind.Task)
		{
			var symbol = this.FindImport(step.Target);
			var isTask = symbol?.Export?.Kind == ModuleExportKind.Task;
			if (!isTask)
			{
				this.Report("WF223", $"Unknown task '{step.Target}'.", step.Span);
				bound = new BoundStep(step, WorkflowType.Unknown, WorkflowType.Unknown);
			}
			else
			{
				var export = symbol!.Export!;
				bound = new BoundStep(step, export.Input!, export.Output!, export, symbol.Module);
			}
		}
		else
		{
			var targetPath = this.ResolveWorkflowPath(step.Target);
			var workflow = await this.compileFile(targetPath, cancellationToken);
			if (workflow is null)
			{
				var message = $"Could not load called workflow '{step.Target}' at '{targetPath}'.";
				this.Report("WF201", message, step.Span);
				bound = new BoundStep(step, WorkflowType.Unknown, WorkflowType.Unknown);
			}
			else
			{
				bound = new BoundStep(step, workflow.Input, workflow.Output, workflow: workflow);
			}
		}

		this.BindStepInput(step, bound.Input, scope);
		if (step.Workdir is not null)
		{
			this.BindTextExpression(step.Workdir, scope, "workdir");
		}

		foreach (var item in step.Environment)
		{
			this.BindTextExpression(item.Value, scope, $"env.{item.Key}");
		}

		this.compiled!.Steps.Add(step, bound);

		return bound;
	}

	private string ResolveWorkflowPath(string target)
	{
		var imported = this.FindImport(target);
		if (imported?.Export?.Kind == ModuleExportKind.Workflow && imported.Export.Source is not null)
		{
			return imported.Export.Source;
		}

		var hasExtension = Path.HasExtension(target);
		var name = hasExtension ? target : $"{target}.mwf";
		var directory = Path.GetDirectoryName(this.document.Path)!;
		var relative = name.Replace('/', Path.DirectorySeparatorChar);
		var fullPath = Path.GetFullPath(relative, directory);

		return fullPath;
	}

	private void BindStepInput(
		StepSyntax step,
		WorkflowType input,
		Dictionary<string, WorkflowType> scope
	)
	{
		if (input.Kind == WorkflowTypeKind.Void)
		{
			if (step.Input.Count > 0)
			{
				this.Report("WF224", "This step takes no input.", step.Span);
			}

			return;
		}

		var actualFields = new List<WorkflowField>();
		foreach (var item in step.Input)
		{
			var type = this.BindExpression(item.Value, scope);
			actualFields.Add(new WorkflowField(item.Key, type));
		}

		var actual = WorkflowType.ShapeOf(null, actualFields);
		var isCompatible = WorkflowType.Accepts(input, actual);
		if (!isCompatible)
		{
			this.Report("WF225", $"Inputs do not match '{step.Target}'.", step.Span);
		}
	}

	private void BindReturn(
		ReturnSyntax returned,
		Dictionary<string, WorkflowType> scope,
		WorkflowType output
	)
	{
		if (returned.Value is null)
		{
			if (output.Kind != WorkflowTypeKind.Void)
			{
				this.Report("WF226", "Return value is required.", returned.Span);
			}

			return;
		}

		var actual = this.BindExpression(returned.Value, scope);
		var isCompatible = WorkflowType.Accepts(output, actual, false);
		if (!isCompatible)
		{
			this.Report("WF227", "Return value does not match workflow output.", returned.Span);
		}
	}

	private void BindCondition(ExpressionSyntax condition, Dictionary<string, WorkflowType> scope)
	{
		var type = this.BindExpression(condition, scope);
		if (type.Kind != WorkflowTypeKind.Bool && type.Kind != WorkflowTypeKind.Unknown)
		{
			this.Report("WF228", "Condition must be bool.", condition.Span);
		}
	}

	private void BindTextExpression(
		ExpressionSyntax expression,
		Dictionary<string, WorkflowType> scope,
		string name
	)
	{
		var type = this.BindExpression(expression, scope);
		var isText = type.Kind is WorkflowTypeKind.Text or WorkflowTypeKind.Path;
		if (!isText && type.Kind != WorkflowTypeKind.Unknown)
		{
			this.Report("WF229", $"{name} must be string or path.", expression.Span);
		}
	}

	private void AddFieldsToScope(
		WorkflowType shape,
		Dictionary<string, WorkflowType> scope,
		SourceSpan span
	)
	{
		foreach (var field in shape.Fields)
		{
			this.CheckReservedName(field.Name, span);
			if (!scope.TryAdd(field.Name, field.Type))
			{
				this.Report("WF230", $"Duplicate input '{field.Name}'.", span);
			}
		}
	}

	private void CheckReservedName(string name, SourceSpan span)
	{
		var collidesImport = this.imports.ContainsKey(name);
		var collidesShape = this.shapes.ContainsKey(name);
		var collidesFunction = this.localFunctions.ContainsKey(name);
		if (collidesImport || collidesShape || collidesFunction)
		{
			this.Report("WF250", $"Name '{name}' is already defined.", span);
		}
	}

	private BoundSymbol? FindImport(string name)
	{
		if (this.imports.TryGetValue(name, out var direct))
		{
			return direct;
		}

		var dot = name.IndexOf('.', StringComparison.Ordinal);
		if (dot < 0)
		{
			return null;
		}

		var prefix = name[..dot];
		var member = name[(dot + 1)..];
		if (!this.imports.TryGetValue(prefix, out var binding) || binding.Module is null)
		{
			return null;
		}

		var export = binding.Module.Exports.FirstOrDefault(item => item.Name == member);
		if (export is null)
		{
			return null;
		}

		return new BoundSymbol(name, binding.Module, export);
	}

	private void Report(string code, string message, SourceSpan span)
	{
		this.diagnostics.Add(new WorkflowDiagnostic(code, message, span));
	}
}
