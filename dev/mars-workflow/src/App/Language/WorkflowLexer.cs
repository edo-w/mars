namespace Mars.Workflow.App.Language;

public class WorkflowLexer
{
	private readonly string source;
	private readonly string path;
	private readonly List<WorkflowToken> tokens = [];
	private readonly List<WorkflowDiagnostic> diagnostics = [];
	private int offset;
	private int line = 1;
	private int column = 1;

	public WorkflowLexer(string source, string path)
	{
		this.source = source;
		this.path = path;
	}

	public IReadOnlyList<WorkflowDiagnostic> Diagnostics => this.diagnostics;

	public IReadOnlyList<WorkflowToken> Lex()
	{
		while (this.offset < this.source.Length)
		{
			var current = this.source[this.offset];

			if (current is ' ' or '\t' or '\r')
			{
				this.Advance();
				continue;
			}

			if (current == '\n')
			{
				this.ReadSingle(TokenKind.NewLine);
				continue;
			}

			if (this.StartsWith("//"))
			{
				this.SkipLineComment();
				continue;
			}

			if (this.StartsWith("/*"))
			{
				this.SkipBlockComment();
				continue;
			}

			if (char.IsLetter(current) || current == '_')
			{
				this.ReadIdentifier();
				continue;
			}

			if (char.IsDigit(current))
			{
				this.ReadNumber();
				continue;
			}

			if (current == '\'')
			{
				this.ReadString();
				continue;
			}

			this.ReadPunctuation();
		}

		var endSpan = new SourceSpan(this.path, this.offset, 0, this.line, this.column);
		this.tokens.Add(new WorkflowToken(TokenKind.End, "", endSpan));

		return this.tokens;
	}

	private void ReadIdentifier()
	{
		var start = this.Mark();

		while (this.offset < this.source.Length)
		{
			var current = this.source[this.offset];
			var isIdentifier = char.IsLetterOrDigit(current) || current == '_';
			if (!isIdentifier)
			{
				break;
			}

			this.Advance();
		}

		this.Add(TokenKind.Identifier, start);
	}

	private void ReadNumber()
	{
		var start = this.Mark();
		var hasDot = false;

		while (this.offset < this.source.Length)
		{
			var current = this.source[this.offset];
			if (char.IsDigit(current))
			{
				this.Advance();
				continue;
			}

			var hasFraction = current == '.' && !hasDot;
			if (!hasFraction)
			{
				break;
			}

			var nextIsDigit = this.offset + 1 < this.source.Length
				&& char.IsDigit(this.source[this.offset + 1]);
			if (!nextIsDigit)
			{
				break;
			}

			hasDot = true;
			this.Advance();
		}

		this.Add(TokenKind.Number, start);
	}

	private void ReadString()
	{
		var start = this.Mark();
		this.Advance();
		var escaped = false;
		var interpolationDepth = 0;
		var insideInterpolationString = false;

		while (this.offset < this.source.Length)
		{
			var current = this.source[this.offset];
			if (current == '\n')
			{
				break;
			}

			this.Advance();
			if (current == '\\' && !escaped)
			{
				escaped = true;
				continue;
			}

			if (escaped)
			{
				escaped = false;
				continue;
			}

			if (interpolationDepth > 0)
			{
				if (current == '\'')
				{
					insideInterpolationString = !insideInterpolationString;
				}
				else if (!insideInterpolationString && current == '{')
				{
					interpolationDepth++;
				}
				else if (!insideInterpolationString && current == '}')
				{
					interpolationDepth--;
				}

				continue;
			}

			if (current == '{')
			{
				interpolationDepth = 1;
				continue;
			}

			if (current == '\'')
			{
				this.Add(TokenKind.StringLiteral, start);
				return;
			}
		}

		var span = this.CreateSpan(start);
		this.diagnostics.Add(new WorkflowDiagnostic("WF001", "Unterminated string.", span));
	}

	private void ReadPunctuation()
	{
		var start = this.Mark();
		var kind = this.source[this.offset] switch
		{
			'{' => TokenKind.LeftBrace,
			'}' => TokenKind.RightBrace,
			'(' => TokenKind.LeftParen,
			')' => TokenKind.RightParen,
			'[' => TokenKind.LeftBracket,
			']' => TokenKind.RightBracket,
			',' => TokenKind.Comma,
			'.' => TokenKind.Dot,
			';' => TokenKind.Semicolon,
			'?' => TokenKind.Question,
			'+' => TokenKind.Plus,
			'-' => TokenKind.Minus,
			'*' => TokenKind.Star,
			'/' => TokenKind.Slash,
			'%' => TokenKind.Percent,
			'!' => TokenKind.Bang,
			'=' => TokenKind.Assign,
			'<' => TokenKind.Less,
			'>' => TokenKind.Greater,
			_ => TokenKind.End,
		};

		this.Advance();
		if (kind == TokenKind.End)
		{
			var invalid = this.source[start.Offset];
			var span = this.CreateSpan(start);
			this.diagnostics.Add(new WorkflowDiagnostic("WF002", $"Unexpected character '{invalid}'.", span));
			return;
		}

		var hasEquals = this.offset < this.source.Length && this.source[this.offset] == '=';
		if (hasEquals)
		{
			kind = kind switch
			{
				TokenKind.Assign => TokenKind.EqualEqual,
				TokenKind.Bang => TokenKind.BangEqual,
				TokenKind.Less => TokenKind.LessEqual,
				TokenKind.Greater => TokenKind.GreaterEqual,
				_ => kind,
			};

			if (kind is TokenKind.EqualEqual or TokenKind.BangEqual
				or TokenKind.LessEqual or TokenKind.GreaterEqual)
			{
				this.Advance();
			}
		}

		this.Add(kind, start);
	}

	private void ReadSingle(TokenKind kind)
	{
		var start = this.Mark();
		this.Advance();
		this.Add(kind, start);
	}

	private void SkipLineComment()
	{
		while (this.offset < this.source.Length && this.source[this.offset] != '\n')
		{
			this.Advance();
		}
	}

	private void SkipBlockComment()
	{
		var start = this.Mark();
		this.Advance();
		this.Advance();

		while (this.offset < this.source.Length)
		{
			if (this.StartsWith("*/"))
			{
				this.Advance();
				this.Advance();
				return;
			}

			this.Advance();
		}

		var span = this.CreateSpan(start);
		this.diagnostics.Add(new WorkflowDiagnostic("WF003", "Unterminated block comment.", span));
	}

	private bool StartsWith(string value)
	{
		var remaining = this.source.AsSpan(this.offset);

		return remaining.StartsWith(value, StringComparison.Ordinal);
	}

	private LexerPosition Mark()
	{
		return new LexerPosition(this.offset, this.line, this.column);
	}

	private void Add(TokenKind kind, LexerPosition start)
	{
		var span = this.CreateSpan(start);
		var text = this.source[start.Offset..this.offset];
		this.tokens.Add(new WorkflowToken(kind, text, span));
	}

	private SourceSpan CreateSpan(LexerPosition start)
	{
		return new SourceSpan(this.path, start.Offset, this.offset - start.Offset, start.Line, start.Column);
	}

	private void Advance()
	{
		var current = this.source[this.offset];
		this.offset++;

		if (current == '\n')
		{
			this.line++;
			this.column = 1;
		}
		else
		{
			this.column++;
		}
	}
}

internal record struct LexerPosition(int Offset, int Line, int Column);
