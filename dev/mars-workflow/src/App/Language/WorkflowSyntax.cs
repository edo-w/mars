namespace Mars.Workflow.App.Language;

public class WorkflowDocument
{
	public WorkflowDocument(string path)
	{
		this.Path = path;
	}

	public string Path { get; }
	public WorkflowProperties? Properties { get; set; }
	public List<UseSyntax> Imports { get; } = [];
	public List<ShapeSyntax> Shapes { get; } = [];
	public List<FunctionSyntax> Functions { get; } = [];
	public List<ValueDeclarationSyntax> Values { get; } = [];
	public List<StatementSyntax> Statements { get; } = [];
}

public class WorkflowProperties
{
	public WorkflowProperties(SourceSpan span)
	{
		this.Span = span;
	}

	public SourceSpan Span { get; }
	public ShapeReferenceSyntax? Input { get; set; }
	public ShapeReferenceSyntax? Output { get; set; }
	public ExpressionSyntax? Workdir { get; set; }
	public Dictionary<string, ExpressionSyntax> Environment { get; } = new(StringComparer.Ordinal);
}

public enum UseMode
{
	Module,
	Alias,
	Wildcard,
	Selective,
}

public record UseSyntax(
	string ModulePath,
	UseMode Mode,
	string? Alias,
	IReadOnlyList<string> Names,
	SourceSpan Span
);

public record ShapeReferenceSyntax(
	string? Name,
	IReadOnlyList<FieldSyntax> Fields,
	SourceSpan Span
);

public record ShapeSyntax(
	string Name,
	IReadOnlyList<FieldSyntax> Fields,
	SourceSpan Span
);

public record FieldSyntax(
	string Name,
	TypeSyntax Type,
	ExpressionSyntax? Default,
	SourceSpan Span
);

public record TypeSyntax(
	string Name,
	bool IsList,
	bool IsOptional,
	SourceSpan Span
);

public record FunctionSyntax(
	string Name,
	IReadOnlyList<FieldSyntax> Parameters,
	TypeSyntax Output,
	IReadOnlyList<StatementSyntax> Body,
	SourceSpan Span
);

public record ValueDeclarationSyntax(
	string Name,
	bool IsConstant,
	ExpressionSyntax Value,
	SourceSpan Span
);

public abstract record StatementSyntax(SourceSpan Span);

public record LetSyntax(
	string Name,
	ExpressionSyntax? Value,
	StepSyntax? Step,
	SourceSpan Location
) : StatementSyntax(Location);

public record StepSyntax(
	StepKind Kind,
	string Target,
	string? Title,
	Dictionary<string, ExpressionSyntax> Input,
	Dictionary<string, ExpressionSyntax> Environment,
	ExpressionSyntax? Workdir,
	SourceSpan Location
) : StatementSyntax(Location);

public enum StepKind
{
	Run,
	Task,
	Call,
}

public record IfSyntax(
	ExpressionSyntax Condition,
	IReadOnlyList<StatementSyntax> Then,
	IReadOnlyList<StatementSyntax> Else,
	SourceSpan Location
) : StatementSyntax(Location);

public record ReturnSyntax(
	ExpressionSyntax? Value,
	SourceSpan Location
) : StatementSyntax(Location);

public abstract record ExpressionSyntax(SourceSpan Span);

public record LiteralSyntax(object? Value, SourceSpan Location) : ExpressionSyntax(Location);
public record NameSyntax(string Name, SourceSpan Location) : ExpressionSyntax(Location);
public record UnarySyntax(string Operator, ExpressionSyntax Operand, SourceSpan Location) : ExpressionSyntax(Location);
public record BinarySyntax(ExpressionSyntax Left, string Operator, ExpressionSyntax Right, SourceSpan Location) : ExpressionSyntax(Location);
public record CallSyntax(ExpressionSyntax Target, IReadOnlyList<ExpressionSyntax> Arguments, SourceSpan Location) : ExpressionSyntax(Location);
public record MemberSyntax(ExpressionSyntax Target, string Member, SourceSpan Location) : ExpressionSyntax(Location);
public record IndexSyntax(ExpressionSyntax Target, ExpressionSyntax Index, SourceSpan Location) : ExpressionSyntax(Location);
public record ArraySyntax(IReadOnlyList<ExpressionSyntax> Items, SourceSpan Location) : ExpressionSyntax(Location);
public record ObjectSyntax(Dictionary<string, ExpressionSyntax> Fields, SourceSpan Location) : ExpressionSyntax(Location);
public record StringSyntax(IReadOnlyList<StringPartSyntax> Parts, SourceSpan Location) : ExpressionSyntax(Location);
public record StringPartSyntax(string? Text, ExpressionSyntax? Expression);
