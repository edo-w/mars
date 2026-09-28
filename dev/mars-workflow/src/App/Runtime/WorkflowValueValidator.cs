using System.Globalization;
using System.Text.Json.Nodes;
using Mars.Workflow.App.Language;
using Mars.Workflow.App.Types;

namespace Mars.Workflow.App.Runtime;

public class WorkflowValueValidator
{
	public JsonNode? Validate(
		WorkflowType type,
		JsonNode? value,
		string name,
		bool allowExtraFields = false
	)
	{
		if (type.Kind == WorkflowTypeKind.Void)
		{
			if (value is not null)
			{
				throw new WorkflowRuntimeException($"{name} must be void.");
			}

			return null;
		}

		if (type.Kind == WorkflowTypeKind.Optional && value is null)
		{
			return null;
		}

		if (value is null)
		{
			throw new WorkflowRuntimeException($"{name} is required.");
		}

		if (type.Kind == WorkflowTypeKind.Optional)
		{
			return this.Validate(type.Element!, value, name, allowExtraFields);
		}

		if (type.Kind == WorkflowTypeKind.Shape)
		{
			return this.ValidateShape(type, value, name, allowExtraFields);
		}

		if (type.Kind == WorkflowTypeKind.List)
		{
			return this.ValidateList(type, value, name);
		}

		ValidateScalar(type, value, name);
		if (type.Kind == WorkflowTypeKind.F32)
		{
			var text = value.ToJsonString();
			var number = float.Parse(text, CultureInfo.InvariantCulture);

			return JsonValue.Create(number);
		}

		return value.DeepClone();
	}

	private JsonObject ValidateShape(
		WorkflowType type,
		JsonNode value,
		string name,
		bool allowExtraFields
	)
	{
		if (value is not JsonObject obj)
		{
			throw new WorkflowRuntimeException($"{name} must be an object.");
		}

		var result = new JsonObject();
		foreach (var field in type.Fields)
		{
			var hasValue = obj.TryGetPropertyValue(field.Name, out var fieldValue);
			if (!hasValue && field.DefaultValue is not null)
			{
				fieldValue = ReadDefault(field.DefaultValue);
				hasValue = true;
			}

			if (!hasValue)
			{
				if (field.IsRequired)
				{
					throw new WorkflowRuntimeException($"{name}.{field.Name} is required.");
				}

				continue;
			}

			var validated = this.Validate(field.Type, fieldValue, $"{name}.{field.Name}", allowExtraFields);
			result[field.Name] = validated;
		}

		if (!allowExtraFields)
		{
			foreach (var property in obj)
			{
				var isKnown = type.Fields.Any(field => field.Name == property.Key);
				if (!isKnown)
				{
					throw new WorkflowRuntimeException($"{name}.{property.Key} is not declared.");
				}
			}
		}

		return result;
	}

	private JsonArray ValidateList(WorkflowType type, JsonNode value, string name)
	{
		if (value is not JsonArray array)
		{
			throw new WorkflowRuntimeException($"{name} must be a list.");
		}

		var result = new JsonArray();
		for (var index = 0; index < array.Count; index++)
		{
			var validated = this.Validate(type.Element!, array[index], $"{name}[{index}]");
			result.Add(validated);
		}

		return result;
	}

	private static void ValidateScalar(WorkflowType type, JsonNode value, string name)
	{
		if (value is not JsonValue scalar)
		{
			throw new WorkflowRuntimeException($"{name} must be a scalar value.");
		}

		var kind = scalar.GetValueKind();
		var isText = type.Kind is WorkflowTypeKind.Text or WorkflowTypeKind.Path
			or WorkflowTypeKind.Url or WorkflowTypeKind.Datetime;
		if (isText && kind != System.Text.Json.JsonValueKind.String)
		{
			throw new WorkflowRuntimeException($"{name} must be text.");
		}

		if (type.Kind == WorkflowTypeKind.Url)
		{
			var text = scalar.GetValue<string>();
			if (!Uri.TryCreate(text, UriKind.Absolute, out _))
			{
				throw new WorkflowRuntimeException($"{name} must be an absolute URL.");
			}
		}

		if (type.Kind == WorkflowTypeKind.Datetime)
		{
			var text = scalar.GetValue<string>();
			var hasUtcSuffix = text.EndsWith('Z');
			var hasTime = text.Contains('T', StringComparison.Ordinal);
			var parses = DateTimeOffset.TryParse(
				text,
				CultureInfo.InvariantCulture,
				DateTimeStyles.RoundtripKind,
				out _
			);
			var valid = hasUtcSuffix && hasTime && parses;
			if (!valid)
			{
				throw new WorkflowRuntimeException($"{name} must be an RFC 3339 datetime.");
			}
		}

		if (type.Kind == WorkflowTypeKind.Bool)
		{
			var valid = kind is System.Text.Json.JsonValueKind.True or System.Text.Json.JsonValueKind.False;
			if (!valid)
			{
				throw new WorkflowRuntimeException($"{name} must be bool.");
			}
		}

		if (type.Kind is WorkflowTypeKind.I32 or WorkflowTypeKind.Duration)
		{
			var isNumber = kind == System.Text.Json.JsonValueKind.Number;
			var isInteger = long.TryParse(
				value.ToJsonString(),
				NumberStyles.Integer,
				CultureInfo.InvariantCulture,
				out var number
			);
			var inRange = type.Kind == WorkflowTypeKind.Duration
				|| number is >= int.MinValue and <= int.MaxValue;
			if (!isNumber || !isInteger || !inRange)
			{
				throw new WorkflowRuntimeException($"{name} must be an integer in range.");
			}
		}

		if (type.Kind == WorkflowTypeKind.F32)
		{
			var isNumber = kind == System.Text.Json.JsonValueKind.Number;
			var valid = float.TryParse(
				value.ToJsonString(),
				NumberStyles.Float,
				CultureInfo.InvariantCulture,
				out var number
			);
			if (!isNumber || !valid || !float.IsFinite(number))
			{
				throw new WorkflowRuntimeException($"{name} must be a finite f32.");
			}
		}
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
			_ => null,
		};
	}

	private static JsonNode? ReadDefault(ExpressionSyntax expression)
	{
		if (expression is LiteralSyntax literal)
		{
			return ToNode(literal.Value);
		}

		if (expression is StringSyntax text)
		{
			var hasExpressions = text.Parts.Any(part => part.Expression is not null);
			if (hasExpressions)
			{
				throw new WorkflowRuntimeException("Field defaults cannot use interpolation.");
			}

			var value = string.Concat(text.Parts.Select(part => part.Text));

			return JsonValue.Create(value);
		}

		if (expression is UnarySyntax unary && unary.Operand is LiteralSyntax operand)
		{
			if (operand.Value is int integer)
			{
				var value = unary.Operator == "-" ? -integer : integer;

				return JsonValue.Create(value);
			}

			if (operand.Value is float number)
			{
				var value = unary.Operator == "-" ? -number : number;

				return JsonValue.Create(value);
			}
		}

		if (expression is ArraySyntax array)
		{
			var result = new JsonArray();
			foreach (var item in array.Items)
			{
				result.Add(ReadDefault(item));
			}

			return result;
		}

		if (expression is ObjectSyntax obj)
		{
			var result = new JsonObject();
			foreach (var field in obj.Fields)
			{
				result[field.Key] = ReadDefault(field.Value);
			}

			return result;
		}

		throw new WorkflowRuntimeException("Field defaults must be constant values.");
	}
}
