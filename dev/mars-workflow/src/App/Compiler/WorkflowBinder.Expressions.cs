using System.Text.Json.Nodes;
using Mars.Workflow.App.Language;
using Mars.Workflow.App.Modules;
using Mars.Workflow.App.Types;

namespace Mars.Workflow.App.Compiler;

public partial class WorkflowBinder
{
	private WorkflowType BindExpression(
		ExpressionSyntax expression,
		Dictionary<string, WorkflowType> scope
	)
	{
		var type = expression switch
		{
			LiteralSyntax literal => BindLiteral(literal),
			NameSyntax name => this.BindName(name, scope),
			MemberSyntax member => this.BindMember(member, scope),
			IndexSyntax index => this.BindIndex(index, scope),
			UnarySyntax unary => this.BindUnary(unary, scope),
			BinarySyntax binary => this.BindBinary(binary, scope),
			CallSyntax call => this.BindCall(call, scope),
			ArraySyntax array => this.BindArray(array, scope),
			ObjectSyntax obj => this.BindObject(obj, scope),
			StringSyntax str => this.BindString(str, scope),
			_ => WorkflowType.Unknown,
		};

		this.compiled?.ExpressionTypes.TryAdd(expression, type);

		return type;
	}

	private static WorkflowType BindLiteral(LiteralSyntax literal)
	{
		return literal.Value switch
		{
			null => WorkflowType.Null,
			string => WorkflowType.Text,
			bool => WorkflowType.Bool,
			int => WorkflowType.I32,
			float => WorkflowType.F32,
			JsonNode => WorkflowType.Unknown,
			_ => WorkflowType.Unknown,
		};
	}

	private WorkflowType BindName(NameSyntax name, Dictionary<string, WorkflowType> scope)
	{
		if (scope.TryGetValue(name.Name, out var local))
		{
			return local;
		}

		var imported = this.FindImport(name.Name);
		if (imported?.Export?.Kind is ModuleExportKind.Constant or ModuleExportKind.Value)
		{
			return imported.Export.Output ?? WorkflowType.Unknown;
		}

		this.Report("WF231", $"Unknown value '{name.Name}'.", name.Span);

		return WorkflowType.Unknown;
	}

	private WorkflowType BindMember(MemberSyntax member, Dictionary<string, WorkflowType> scope)
	{
		if (member.Target is NameSyntax moduleName)
		{
			var path = $"{moduleName.Name}.{member.Member}";
			var import = this.FindImport(path);
			if (import?.Export?.Kind is ModuleExportKind.Constant or ModuleExportKind.Value)
			{
				return import.Export.Output ?? WorkflowType.Unknown;
			}
		}

		var target = this.BindExpression(member.Target, scope);
		if (target.Kind != WorkflowTypeKind.Shape)
		{
			this.Report("WF232", "Member access needs a shape value.", member.Span);

			return WorkflowType.Unknown;
		}

		var field = target.Fields.FirstOrDefault(item => item.Name == member.Member);
		if (field is null)
		{
			this.Report("WF233", $"Shape has no member '{member.Member}'.", member.Span);

			return WorkflowType.Unknown;
		}

		return field.Type;
	}

	private WorkflowType BindIndex(IndexSyntax index, Dictionary<string, WorkflowType> scope)
	{
		var target = this.BindExpression(index.Target, scope);
		var position = this.BindExpression(index.Index, scope);
		if (position.Kind != WorkflowTypeKind.I32)
		{
			this.Report("WF234", "List index must be i32.", index.Index.Span);
		}

		if (target.Kind != WorkflowTypeKind.List || target.Element is null)
		{
			this.Report("WF235", "Indexing requires a list.", index.Span);

			return WorkflowType.Unknown;
		}

		return target.Element;
	}

	private WorkflowType BindUnary(UnarySyntax unary, Dictionary<string, WorkflowType> scope)
	{
		var operand = this.BindExpression(unary.Operand, scope);
		if (unary.Operator == "!")
		{
			if (operand.Kind != WorkflowTypeKind.Bool)
			{
				this.Report("WF236", "'!' requires bool.", unary.Span);
			}

			return WorkflowType.Bool;
		}

		var isNumber = operand.Kind is WorkflowTypeKind.I32 or WorkflowTypeKind.F32;
		if (!isNumber)
		{
			this.Report("WF237", "Unary number operator requires i32 or f32.", unary.Span);
		}

		return operand;
	}

	private WorkflowType BindBinary(BinarySyntax binary, Dictionary<string, WorkflowType> scope)
	{
		var left = this.BindExpression(binary.Left, scope);
		var right = this.BindExpression(binary.Right, scope);
		var sameType = left.Kind == right.Kind;
		var isNumeric = left.Kind is WorkflowTypeKind.I32 or WorkflowTypeKind.F32;

		if (binary.Operator is "and" or "or")
		{
			var bothBoolean = left.Kind == WorkflowTypeKind.Bool
				&& right.Kind == WorkflowTypeKind.Bool;
			if (!bothBoolean)
			{
				this.Report("WF238", "Boolean operator requires bool operands.", binary.Span);
			}

			return WorkflowType.Bool;
		}

		if (binary.Operator is "==" or "!=")
		{
			if (!sameType && left.Kind != WorkflowTypeKind.Null
				&& right.Kind != WorkflowTypeKind.Null)
			{
				this.Report("WF239", "Equality operands must have compatible types.", binary.Span);
			}

			return WorkflowType.Bool;
		}

		if (binary.Operator is "<" or "<=" or ">" or ">=")
		{
			var valid = sameType && (isNumeric || left.Kind == WorkflowTypeKind.Text);
			if (!valid)
			{
				this.Report("WF240", "Ordering operands must share a numeric or string type.", binary.Span);
			}

			return WorkflowType.Bool;
		}

		var isConcatenation = binary.Operator == "+"
			&& left.Kind == WorkflowTypeKind.Text && right.Kind == WorkflowTypeKind.Text;
		if (isConcatenation)
		{
			return WorkflowType.Text;
		}

		if (!sameType || !isNumeric)
		{
			this.Report("WF241", "Arithmetic operands must share a numeric type.", binary.Span);
		}

		return left;
	}

	private WorkflowType BindCall(CallSyntax call, Dictionary<string, WorkflowType> scope)
	{
		var targetName = GetCallableName(call.Target);
		if (targetName is null)
		{
			this.Report("WF242", "Function target must be static.", call.Span);

			return WorkflowType.Unknown;
		}

		BoundFunction? function = null;
		if (this.localFunctions.TryGetValue(targetName, out var local))
		{
			function = local;
		}
		else
		{
			var import = this.FindImport(targetName);
			if (import?.Export?.Kind == ModuleExportKind.Function)
			{
				var export = import.Export;
				function = new BoundFunction(
					targetName,
					export.Input!,
					export.Output!,
					export: export,
					module: import.Module
				);
			}
		}

		if (function is null)
		{
			this.Report("WF243", $"Unknown function '{targetName}'.", call.Span);

			return WorkflowType.Unknown;
		}

		this.compiled?.Functions.TryAdd(call, function);
		var parameters = function.Input.Fields;
		if (parameters.Count != call.Arguments.Count)
		{
			this.Report("WF244", $"Function '{targetName}' has the wrong argument count.", call.Span);
		}

		for (var index = 0; index < call.Arguments.Count; index++)
		{
			var argument = call.Arguments[index];
			var type = this.BindExpression(argument, scope);
			if (index >= parameters.Count)
			{
				continue;
			}

			var accepts = WorkflowType.Accepts(parameters[index].Type, type);
			if (!accepts)
			{
				this.Report("WF245", $"Argument {index + 1} has the wrong type.", argument.Span);
			}
		}

		return function.Output;
	}

	private static string? GetCallableName(ExpressionSyntax target)
	{
		if (target is NameSyntax name)
		{
			return name.Name;
		}

		if (target is MemberSyntax member && member.Target is NameSyntax module)
		{
			return $"{module.Name}.{member.Member}";
		}

		return null;
	}

	private WorkflowType BindArray(ArraySyntax array, Dictionary<string, WorkflowType> scope)
	{
		WorkflowType? element = null;
		foreach (var item in array.Items)
		{
			var type = this.BindExpression(item, scope);
			if (element is null)
			{
				element = type;
				continue;
			}

			if (!WorkflowType.Accepts(element, type))
			{
				this.Report("WF246", "List elements must have compatible types.", item.Span);
			}
		}

		return WorkflowType.ListOf(element ?? WorkflowType.Unknown);
	}

	private WorkflowType BindObject(ObjectSyntax obj, Dictionary<string, WorkflowType> scope)
	{
		var fields = new List<WorkflowField>();
		foreach (var item in obj.Fields)
		{
			var type = this.BindExpression(item.Value, scope);
			fields.Add(new WorkflowField(item.Key, type));
		}

		return WorkflowType.ShapeOf(null, fields);
	}

	private WorkflowType BindString(StringSyntax str, Dictionary<string, WorkflowType> scope)
	{
		foreach (var part in str.Parts)
		{
			if (part.Expression is null)
			{
				continue;
			}

			var type = this.BindExpression(part.Expression, scope);
			var isComplex = type.Kind is WorkflowTypeKind.Shape
				or WorkflowTypeKind.List or WorkflowTypeKind.Void;
			if (isComplex)
			{
				this.Report("WF247", "Interpolate scalar values only.", part.Expression.Span);
			}
		}

		return WorkflowType.Text;
	}
}
