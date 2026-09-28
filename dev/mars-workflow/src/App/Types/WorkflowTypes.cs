using Mars.Workflow.App.Language;

namespace Mars.Workflow.App.Types;

public enum WorkflowTypeKind
{
	Unknown,
	Void,
	Null,
	Text,
	Bool,
	I32,
	F32,
	Datetime,
	Duration,
	Path,
	Url,
	List,
	Optional,
	Shape,
}

public class WorkflowField
{
	public WorkflowField(string name, WorkflowType type, ExpressionSyntax? defaultValue = null)
	{
		this.Name = name;
		this.Type = type;
		this.DefaultValue = defaultValue;
	}

	public string Name { get; }
	public WorkflowType Type { get; }
	public ExpressionSyntax? DefaultValue { get; }
	public bool IsRequired => this.Type.Kind != WorkflowTypeKind.Optional && this.DefaultValue is null;
}

public class WorkflowType
{
	public WorkflowType(
		WorkflowTypeKind kind,
		string? name = null,
		WorkflowType? element = null,
		IReadOnlyList<WorkflowField>? fields = null
	)
	{
		this.Kind = kind;
		this.Name = name;
		this.Element = element;
		this.Fields = fields ?? [];
	}

	public WorkflowTypeKind Kind { get; }
	public string? Name { get; }
	public WorkflowType? Element { get; }
	public IReadOnlyList<WorkflowField> Fields { get; }

	public static WorkflowType Unknown { get; } = new(WorkflowTypeKind.Unknown);
	public static WorkflowType Void { get; } = new(WorkflowTypeKind.Void);
	public static WorkflowType Null { get; } = new(WorkflowTypeKind.Null);
	public static WorkflowType Text { get; } = new(WorkflowTypeKind.Text);
	public static WorkflowType Bool { get; } = new(WorkflowTypeKind.Bool);
	public static WorkflowType I32 { get; } = new(WorkflowTypeKind.I32);
	public static WorkflowType F32 { get; } = new(WorkflowTypeKind.F32);
	public static WorkflowType Path { get; } = new(WorkflowTypeKind.Path);
	public static WorkflowType Url { get; } = new(WorkflowTypeKind.Url);
	public static WorkflowType Datetime { get; } = new(WorkflowTypeKind.Datetime);
	public static WorkflowType Duration { get; } = new(WorkflowTypeKind.Duration);

	public static WorkflowType ListOf(WorkflowType element)
	{
		return new WorkflowType(WorkflowTypeKind.List, element: element);
	}

	public static WorkflowType OptionalOf(WorkflowType element)
	{
		return new WorkflowType(WorkflowTypeKind.Optional, element: element);
	}

	public static WorkflowType ShapeOf(string? name, IReadOnlyList<WorkflowField> fields)
	{
		return new WorkflowType(WorkflowTypeKind.Shape, name: name, fields: fields);
	}

	public static WorkflowType? Primitive(string name)
	{
		return name switch
		{
			"void" => Void,
			"string" => Text,
			"bool" => Bool,
			"i32" => I32,
			"f32" => F32,
			"path" => Path,
			"url" => Url,
			"datetime" => Datetime,
			"duration" => Duration,
			_ => null,
		};
	}

	public static bool Accepts(WorkflowType target, WorkflowType source, bool allowExtraFields = true)
	{
		if (target.Kind == WorkflowTypeKind.Unknown || source.Kind == WorkflowTypeKind.Unknown)
		{
			return true;
		}

		if (target.Kind == WorkflowTypeKind.Optional)
		{
			if (source.Kind == WorkflowTypeKind.Null)
			{
				return true;
			}

			var targetElement = target.Element;
			if (targetElement is null)
			{
				return false;
			}

			if (source.Kind == WorkflowTypeKind.Optional)
			{
				var sourceElement = source.Element;
				if (sourceElement is null)
				{
					return false;
				}

				return Accepts(targetElement, sourceElement, allowExtraFields);
			}

			return Accepts(targetElement, source, allowExtraFields);
		}

		if (target.Kind != source.Kind)
		{
			return false;
		}

		if (target.Kind == WorkflowTypeKind.List)
		{
			var targetElement = target.Element;
			var sourceElement = source.Element;
			if (targetElement is null || sourceElement is null)
			{
				return false;
			}

			return Accepts(targetElement, sourceElement, allowExtraFields);
		}

		if (target.Kind != WorkflowTypeKind.Shape)
		{
			return true;
		}

		foreach (var targetField in target.Fields)
		{
			var sourceField = source.Fields.FirstOrDefault(
				field => field.Name == targetField.Name
			);
			if (sourceField is null)
			{
				if (targetField.IsRequired)
				{
					return false;
				}

				continue;
			}

			if (!Accepts(targetField.Type, sourceField.Type, allowExtraFields))
			{
				return false;
			}
		}

		if (!allowExtraFields)
		{
			foreach (var sourceField in source.Fields)
			{
				var isKnown = target.Fields.Any(field => field.Name == sourceField.Name);
				if (!isKnown)
				{
					return false;
				}
			}
		}

		return true;
	}
}
