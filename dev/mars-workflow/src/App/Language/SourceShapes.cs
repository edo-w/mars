namespace Mars.Workflow.App.Language;

public readonly record struct SourceSpan(
	string Path,
	int Offset,
	int Length,
	int Line,
	int Column
);

public class WorkflowDiagnostic
{
	public WorkflowDiagnostic(string code, string message, SourceSpan span)
	{
		this.Code = code;
		this.Message = message;
		this.Span = span;
	}

	public string Code { get; }
	public string Message { get; }
	public SourceSpan Span { get; }
}

public enum TokenKind
{
	End,
	NewLine,
	Identifier,
	Number,
	StringLiteral,
	LeftBrace,
	RightBrace,
	LeftParen,
	RightParen,
	LeftBracket,
	RightBracket,
	Comma,
	Dot,
	Semicolon,
	Assign,
	Question,
	Plus,
	Minus,
	Star,
	Slash,
	Percent,
	Bang,
	EqualEqual,
	BangEqual,
	Less,
	LessEqual,
	Greater,
	GreaterEqual,
}

public readonly record struct WorkflowToken(
	TokenKind Kind,
	string Text,
	SourceSpan Span
);
