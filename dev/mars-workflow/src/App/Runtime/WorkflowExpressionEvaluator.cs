using System.Globalization;
using System.Text;
using System.Text.Json.Nodes;
using Mars.Workflow.App.Compiler;
using Mars.Workflow.App.Language;
using Mars.Workflow.App.Modules;
using Mars.Workflow.App.Types;

namespace Mars.Workflow.App.Runtime;

public class WorkflowExpressionEvaluator
{
	private readonly CompiledWorkflow workflow;
	private readonly IWorkflowOperationHost host;
	private readonly Guid runId;
	private readonly Func<string, int?, CancellationToken, Task> progress;

	public WorkflowExpressionEvaluator(
		CompiledWorkflow workflow,
		IWorkflowOperationHost host,
		Guid runId,
		Func<string, int?, CancellationToken, Task> progress
	)
	{
		this.workflow = workflow;
		this.host = host;
		this.runId = runId;
		this.progress = progress;
	}

	public async Task<JsonNode?> EvaluateAsync(
		ExpressionSyntax expression,
		IReadOnlyDictionary<string, JsonNode?> scope,
		CancellationToken cancellationToken
	)
	{
		if (expression is LiteralSyntax literal)
		{
			return ToNode(literal.Value);
		}

		if (expression is NameSyntax name)
		{
			return this.ReadName(name.Name, scope);
		}

		if (expression is StringSyntax str)
		{
			return await this.EvaluateStringAsync(str, scope, cancellationToken);
		}

		if (expression is MemberSyntax member)
		{
			return await this.EvaluateMemberAsync(member, scope, cancellationToken);
		}

		if (expression is IndexSyntax index)
		{
			var target = await this.EvaluateAsync(index.Target, scope, cancellationToken);
			var position = await this.EvaluateAsync(index.Index, scope, cancellationToken);
			var number = ReadInt(position);
			if (target is not JsonArray array || number < 0 || number >= array.Count)
			{
				throw new WorkflowRuntimeException("List index is out of range.");
			}

			return array[number]?.DeepClone();
		}

		if (expression is UnarySyntax unary)
		{
			return await this.EvaluateUnaryAsync(unary, scope, cancellationToken);
		}

		if (expression is BinarySyntax binary)
		{
			return await this.EvaluateBinaryAsync(binary, scope, cancellationToken);
		}

		if (expression is CallSyntax call)
		{
			return await this.EvaluateCallAsync(call, scope, cancellationToken);
		}

		if (expression is ArraySyntax arraySyntax)
		{
			var array = new JsonArray();
			foreach (var item in arraySyntax.Items)
			{
				var value = await this.EvaluateAsync(item, scope, cancellationToken);
				array.Add(value);
			}

			return array;
		}

		if (expression is ObjectSyntax obj)
		{
			var result = new JsonObject();
			foreach (var item in obj.Fields)
			{
				var value = await this.EvaluateAsync(item.Value, scope, cancellationToken);
				result[item.Key] = value;
			}

			return result;
		}

		throw new WorkflowRuntimeException("Unknown expression node.");
	}

	private JsonNode? ReadName(string name, IReadOnlyDictionary<string, JsonNode?> scope)
	{
		if (scope.TryGetValue(name, out var value))
		{
			return value?.DeepClone();
		}

		var import = this.FindImportedValue(name);
		if (import is not null)
		{
			return import.Value?.DeepClone();
		}

		throw new WorkflowRuntimeException($"Unknown value '{name}'.");
	}

	private async Task<JsonNode?> EvaluateMemberAsync(
		MemberSyntax member,
		IReadOnlyDictionary<string, JsonNode?> scope,
		CancellationToken cancellationToken
	)
	{
		if (member.Target is NameSyntax moduleName)
		{
			var path = $"{moduleName.Name}.{member.Member}";
			var import = this.FindImportedValue(path);
			if (import is not null)
			{
				return import.Value?.DeepClone();
			}
		}

		var target = await this.EvaluateAsync(member.Target, scope, cancellationToken);
		if (target is not JsonObject obj)
		{
			throw new WorkflowRuntimeException("Member access needs an object.");
		}

		if (!obj.TryGetPropertyValue(member.Member, out var value))
		{
			throw new WorkflowRuntimeException($"Missing member '{member.Member}'.");
		}

		return value?.DeepClone();
	}

	private ModuleExport? FindImportedValue(string name)
	{
		if (this.workflow.Imports.TryGetValue(name, out var direct))
		{
			var kind = direct.Export?.Kind;
			if (kind is ModuleExportKind.Constant or ModuleExportKind.Value)
			{
				return direct.Export;
			}
		}

		var dot = name.IndexOf('.', StringComparison.Ordinal);
		if (dot < 0)
		{
			return null;
		}

		var prefix = name[..dot];
		var member = name[(dot + 1)..];
		if (!this.workflow.Imports.TryGetValue(prefix, out var binding))
		{
			return null;
		}

		var export = binding.Module?.Exports.FirstOrDefault(item => item.Name == member);
		if (export?.Kind is ModuleExportKind.Constant or ModuleExportKind.Value)
		{
			return export;
		}

		return null;
	}

	private async Task<JsonNode?> EvaluateStringAsync(
		StringSyntax syntax,
		IReadOnlyDictionary<string, JsonNode?> scope,
		CancellationToken cancellationToken
	)
	{
		var text = new StringBuilder();
		foreach (var part in syntax.Parts)
		{
			if (part.Text is not null)
			{
				text.Append(part.Text);
				continue;
			}

			var value = await this.EvaluateAsync(part.Expression!, scope, cancellationToken);
			text.Append(ToText(value));
		}

		return JsonValue.Create(text.ToString());
	}

	private async Task<JsonNode?> EvaluateUnaryAsync(
		UnarySyntax unary,
		IReadOnlyDictionary<string, JsonNode?> scope,
		CancellationToken cancellationToken
	)
	{
		var value = await this.EvaluateAsync(unary.Operand, scope, cancellationToken);
		if (unary.Operator == "!")
		{
			return JsonValue.Create(!ReadBool(value));
		}

		var kind = this.workflow.ExpressionTypes[unary.Operand].Kind;
		if (kind == WorkflowTypeKind.F32)
		{
			var number = ReadFloat(value);
			var result = unary.Operator == "-" ? -number : number;

			return JsonValue.Create(result);
		}

		var integer = ReadInt(value);
		var intResult = unary.Operator == "-" ? -integer : integer;

		return JsonValue.Create(intResult);
	}

	private async Task<JsonNode?> EvaluateBinaryAsync(
		BinarySyntax binary,
		IReadOnlyDictionary<string, JsonNode?> scope,
		CancellationToken cancellationToken
	)
	{
		var left = await this.EvaluateAsync(binary.Left, scope, cancellationToken);
		if (binary.Operator == "and" && !ReadBool(left))
		{
			return JsonValue.Create(false);
		}

		if (binary.Operator == "or" && ReadBool(left))
		{
			return JsonValue.Create(true);
		}

		var right = await this.EvaluateAsync(binary.Right, scope, cancellationToken);
		if (binary.Operator == "and" || binary.Operator == "or")
		{
			return JsonValue.Create(ReadBool(right));
		}

		if (binary.Operator == "==")
		{
			return JsonValue.Create(JsonNode.DeepEquals(left, right));
		}

		if (binary.Operator == "!=")
		{
			return JsonValue.Create(!JsonNode.DeepEquals(left, right));
		}

		var kind = this.workflow.ExpressionTypes[binary.Left].Kind;
		if (kind == WorkflowTypeKind.Text)
		{
			return EvaluateTextBinary(binary.Operator, left, right);
		}

		if (kind == WorkflowTypeKind.F32)
		{
			return EvaluateFloatBinary(binary.Operator, left, right);
		}

		return EvaluateIntBinary(binary.Operator, left, right);
	}

	private static JsonValue EvaluateTextBinary(string operation, JsonNode? left, JsonNode? right)
	{
		var first = ToText(left);
		var second = ToText(right);
		if (operation == "+")
		{
			return JsonValue.Create(first + second)!;
		}

		var comparison = StringComparer.Ordinal.Compare(first, second);
		var result = Compare(operation, comparison);

		return JsonValue.Create(result)!;
	}

	private static JsonValue EvaluateFloatBinary(string operation, JsonNode? left, JsonNode? right)
	{
		var first = ReadFloat(left);
		var second = ReadFloat(right);
		if (operation is "<" or "<=" or ">" or ">=")
		{
			var comparison = first.CompareTo(second);

			return JsonValue.Create(Compare(operation, comparison))!;
		}

		var value = operation switch
		{
			"+" => first + second,
			"-" => first - second,
			"*" => first * second,
			"/" => first / second,
			"%" => first % second,
			_ => throw new WorkflowRuntimeException($"Unknown operator '{operation}'."),
		};

		return JsonValue.Create(value)!;
	}

	private static JsonValue EvaluateIntBinary(string operation, JsonNode? left, JsonNode? right)
	{
		var first = ReadInt(left);
		var second = ReadInt(right);
		if (operation is "<" or "<=" or ">" or ">=")
		{
			var comparison = first.CompareTo(second);

			return JsonValue.Create(Compare(operation, comparison))!;
		}

		var value = operation switch
		{
			"+" => checked(first + second),
			"-" => checked(first - second),
			"*" => checked(first * second),
			"/" => first / second,
			"%" => first % second,
			_ => throw new WorkflowRuntimeException($"Unknown operator '{operation}'."),
		};

		return JsonValue.Create(value)!;
	}

	private async Task<JsonNode?> EvaluateCallAsync(
		CallSyntax call,
		IReadOnlyDictionary<string, JsonNode?> scope,
		CancellationToken cancellationToken
	)
	{
		var function = this.workflow.Functions[call];
		var input = new JsonObject();
		for (var index = 0; index < call.Arguments.Count; index++)
		{
			var name = function.Input.Fields[index].Name;
			var value = await this.EvaluateAsync(call.Arguments[index], scope, cancellationToken);
			input[name] = value;
		}

		if (function.Local is not null)
		{
			return await this.EvaluateLocalFunctionAsync(function, input, cancellationToken);
		}

		var result = await this.host.InvokeFunctionAsync(
			function,
			input,
			this.runId,
			this.progress,
			cancellationToken
		);
		var validator = new WorkflowValueValidator();
		var validated = validator.Validate(function.Output, result, $"function {function.Name}");

		return validated;
	}

	private async Task<JsonNode?> EvaluateLocalFunctionAsync(
		BoundFunction function,
		JsonObject input,
		CancellationToken cancellationToken
	)
	{
		var variables = new Dictionary<string, JsonNode?>(StringComparer.Ordinal);
		foreach (var parameter in function.Input.Fields)
		{
			variables[parameter.Name] = input[parameter.Name]?.DeepClone();
		}

		var result = await this.EvaluateFunctionBodyAsync(
			function.Local!.Body,
			variables,
			cancellationToken
		);
		var validator = new WorkflowValueValidator();
		var validated = validator.Validate(
			function.Output,
			result.Value,
			$"function {function.Name} output"
		);

		return validated;
	}

	private async Task<WorkflowReturn> EvaluateFunctionBodyAsync(
		IReadOnlyList<StatementSyntax> statements,
		Dictionary<string, JsonNode?> scope,
		CancellationToken cancellationToken
	)
	{
		foreach (var statement in statements)
		{
			if (statement is LetSyntax let)
			{
				var value = await this.EvaluateAsync(let.Value!, scope, cancellationToken);
				scope[let.Name] = value;
			}
			else if (statement is ReturnSyntax returned)
			{
				if (returned.Value is null)
				{
					return new WorkflowReturn(true, null);
				}

				var value = await this.EvaluateAsync(returned.Value, scope, cancellationToken);

				return new WorkflowReturn(true, value);
			}
			else if (statement is IfSyntax condition)
			{
				var value = await this.EvaluateAsync(condition.Condition, scope, cancellationToken);
				var branch = ReadBool(value) ? condition.Then : condition.Else;
				var childScope = new Dictionary<string, JsonNode?>(scope, StringComparer.Ordinal);
				var branchResult = await this.EvaluateFunctionBodyAsync(
					branch,
					childScope,
					cancellationToken
				);
				if (branchResult.HasReturn)
				{
					return branchResult;
				}
			}
		}

		return new WorkflowReturn(false, null);
	}

	private static bool Compare(string operation, int comparison)
	{
		return operation switch
		{
			"<" => comparison < 0,
			"<=" => comparison <= 0,
			">" => comparison > 0,
			">=" => comparison >= 0,
			_ => throw new WorkflowRuntimeException($"Unknown comparison '{operation}'."),
		};
	}

	public static string ToText(JsonNode? node)
	{
		if (node is null)
		{
			return "null";
		}

		if (node is JsonValue value && value.GetValueKind() == System.Text.Json.JsonValueKind.String)
		{
			return value.GetValue<string>();
		}

		return node.ToJsonString();
	}

	private static bool ReadBool(JsonNode? node)
	{
		return node?.GetValue<bool>() ?? false;
	}

	private static int ReadInt(JsonNode? node)
	{
		var text = node?.ToJsonString() ?? "0";

		return int.Parse(text, CultureInfo.InvariantCulture);
	}

	private static float ReadFloat(JsonNode? node)
	{
		var text = node?.ToJsonString() ?? "0";

		return float.Parse(text, CultureInfo.InvariantCulture);
	}

	private static JsonNode? ToNode(object? value)
	{
		return value switch
		{
			null => null,
			JsonNode node => node.DeepClone(),
			string text => JsonValue.Create(text),
			bool boolean => JsonValue.Create(boolean),
			int number => JsonValue.Create(number),
			float number => JsonValue.Create(number),
			_ => throw new WorkflowRuntimeException("Unsupported literal value."),
		};
	}
}
