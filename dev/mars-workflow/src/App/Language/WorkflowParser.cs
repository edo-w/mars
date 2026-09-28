using System.Globalization;

namespace Mars.Workflow.App.Language;

public class WorkflowParser
{
	private readonly IReadOnlyList<WorkflowToken> tokens;
	private readonly List<WorkflowDiagnostic> diagnostics = [];
	private readonly string path;
	private int position;

	public WorkflowParser(IReadOnlyList<WorkflowToken> tokens, string path)
	{
		this.tokens = tokens;
		this.path = path;
	}

	public IReadOnlyList<WorkflowDiagnostic> Diagnostics => this.diagnostics;

	public WorkflowDocument Parse()
	{
		var document = new WorkflowDocument(this.path);
		this.SkipSeparators();

		while (!this.Is(TokenKind.End))
		{
			var startPosition = this.position;

			try
			{
				if (this.MatchWord("use"))
				{
					document.Imports.Add(this.ParseUse());
				}
				else if (this.MatchWord("shape"))
				{
					document.Shapes.Add(this.ParseShape());
				}
				else if (this.MatchWord("fn"))
				{
					document.Functions.Add(this.ParseFunction());
				}
				else if (this.MatchWord("const"))
				{
					document.Values.Add(this.ParseValue(true));
				}
				else if (this.MatchWord("value"))
				{
					document.Values.Add(this.ParseValue(false));
				}
				else if (this.MatchWord("workflow"))
				{
					var properties = this.ParseProperties();
					if (document.Properties is not null)
					{
						this.Report("WF100", "Only one workflow block is allowed per file.", properties.Span);
					}
					else
					{
						document.Properties = properties;
					}
				}
				else
				{
					document.Statements.Add(this.ParseStatement());
				}
			}
			catch (WorkflowParseException)
			{
				this.Synchronize();
			}

			if (this.position == startPosition)
			{
				this.Advance();
			}

			this.SkipSeparators();
		}

		if (document.Properties is null)
		{
			document.Properties = new WorkflowProperties(this.Current.Span);
		}

		return document;
	}

	public ExpressionSyntax ParseStandaloneExpression()
	{
		this.SkipSeparators();
		var expression = this.ParseExpression();
		this.SkipSeparators();

		if (!this.Is(TokenKind.End))
		{
			this.Report("WF102", "Unexpected text after expression.", this.Current.Span);
		}

		return expression;
	}

	private UseSyntax ParseUse()
	{
		var start = this.Previous.Span;
		var path = this.ParsePath();
		var mode = UseMode.Module;
		string? alias = null;
		var names = new List<string>();

		if (this.MatchWord("as"))
		{
			mode = UseMode.Alias;
			alias = this.ExpectIdentifier("Expected import alias.").Text;
		}
		else if (this.Match(TokenKind.Star))
		{
			mode = UseMode.Wildcard;
		}
		else if (this.Match(TokenKind.LeftBrace))
		{
			mode = UseMode.Selective;
			this.SkipSeparators();

			while (!this.Is(TokenKind.RightBrace) && !this.Is(TokenKind.End))
			{
				names.Add(this.ExpectIdentifier("Expected imported name.").Text);
				if (!this.Match(TokenKind.Comma))
				{
					break;
				}
				this.SkipSeparators();
			}

			this.Expect(TokenKind.RightBrace, "Expected '}' after imported names.");
		}

		return new UseSyntax(path, mode, alias, names, start);
	}

	private string ParsePath()
	{
		var parts = new List<string>();
		if (this.Match(TokenKind.Dot))
		{
			parts.Add(".");
			if (this.Match(TokenKind.Dot))
			{
				parts.Add(".");
			}

			this.Expect(TokenKind.Slash, "Expected '/' after relative path prefix.");
			parts.Add("/");
		}

		var first = this.ExpectIdentifier("Expected module or symbol path.");
		parts.Add(first.Text);

		while (this.Is(TokenKind.Slash) || this.Is(TokenKind.Dot))
		{
			var separator = this.Advance().Text;
			var part = this.ExpectIdentifier("Expected path segment.");
			parts.Add(separator);
			parts.Add(part.Text);
		}

		return string.Concat(parts);
	}

	private ShapeSyntax ParseShape()
	{
		var start = this.Previous.Span;
		var name = this.ExpectIdentifier("Expected shape name.").Text;
		var fields = this.ParseFields();

		return new ShapeSyntax(name, fields, start);
	}

	private List<FieldSyntax> ParseFields()
	{
		this.Expect(TokenKind.LeftBrace, "Expected '{' before fields.");
		var fields = new List<FieldSyntax>();
		this.SkipSeparators();

		while (!this.Is(TokenKind.RightBrace) && !this.Is(TokenKind.End))
		{
			var name = this.ExpectIdentifier("Expected field name.");
			var type = this.ParseType();
			ExpressionSyntax? defaultValue = null;

			if (this.Match(TokenKind.Assign))
			{
				defaultValue = this.ParseExpression();
			}

			fields.Add(new FieldSyntax(name.Text, type, defaultValue, name.Span));
			this.RequireSeparatorOrEnd();
			this.SkipSeparators();
		}

		this.Expect(TokenKind.RightBrace, "Expected '}' after fields.");

		return fields;
	}

	private TypeSyntax ParseType()
	{
		var name = this.ExpectIdentifier("Expected type name.");
		var isList = false;
		var isOptional = false;

		if (this.Match(TokenKind.LeftBracket))
		{
			this.Expect(TokenKind.RightBracket, "Expected ']' in list type.");
			isList = true;
		}

		if (this.Match(TokenKind.Question))
		{
			isOptional = true;
		}

		return new TypeSyntax(name.Text, isList, isOptional, name.Span);
	}

	private FunctionSyntax ParseFunction()
	{
		var start = this.Previous.Span;
		var name = this.ExpectIdentifier("Expected function name.").Text;
		this.Expect(TokenKind.LeftParen, "Expected '(' after function name.");
		var parameters = new List<FieldSyntax>();

		while (!this.Is(TokenKind.RightParen) && !this.Is(TokenKind.End))
		{
			var parameter = this.ExpectIdentifier("Expected parameter name.");
			var type = this.ParseType();
			parameters.Add(new FieldSyntax(parameter.Text, type, null, parameter.Span));

			if (!this.Match(TokenKind.Comma))
			{
				break;
			}
		}

		this.Expect(TokenKind.RightParen, "Expected ')' after parameters.");
		var output = this.ParseType();
		var body = this.ParseStatementsBlock();

		return new FunctionSyntax(name, parameters, output, body, start);
	}

	private ValueDeclarationSyntax ParseValue(bool isConstant)
	{
		var start = this.Previous.Span;
		var name = this.ExpectIdentifier("Expected value name.").Text;
		this.Expect(TokenKind.Assign, "Expected '=' after value name.");
		var value = this.ParseExpression();

		return new ValueDeclarationSyntax(name, isConstant, value, start);
	}

	private WorkflowProperties ParseProperties()
	{
		var properties = new WorkflowProperties(this.Previous.Span);
		this.Expect(TokenKind.LeftBrace, "Expected '{' after workflow.");
		this.SkipSeparators();

		while (!this.Is(TokenKind.RightBrace) && !this.Is(TokenKind.End))
		{
			if (this.MatchWord("input"))
			{
				properties.Input = this.ParseShapeReference();
			}
			else if (this.MatchWord("output"))
			{
				properties.Output = this.ParseShapeReference();
			}
			else if (this.MatchWord("env"))
			{
				this.ReadAssignments(properties.Environment);
			}
			else if (this.MatchWord("workdir"))
			{
				this.Expect(TokenKind.Assign, "Expected '=' after workdir.");
				properties.Workdir = this.ParseExpression();
			}
			else
			{
				this.Fail("WF103", "Only workflow properties belong inside workflow { ... }.");
			}

			this.RequireSeparatorOrEnd();
			this.SkipSeparators();
		}

		this.Expect(TokenKind.RightBrace, "Expected '}' after workflow properties.");

		return properties;
	}

	private ShapeReferenceSyntax ParseShapeReference()
	{
		var start = this.Previous.Span;
		if (this.Match(TokenKind.Assign))
		{
			var name = this.ParsePath();

			return new ShapeReferenceSyntax(name, [], start);
		}

		var fields = this.ParseFields();

		return new ShapeReferenceSyntax(null, fields, start);
	}

	private StatementSyntax ParseStatement()
	{
		if (this.MatchWord("let"))
		{
			var start = this.Previous.Span;
			var name = this.ExpectIdentifier("Expected local name.").Text;
			this.Expect(TokenKind.Assign, "Expected '=' after local name.");

			if (this.IsStepStart())
			{
				var step = this.ParseStep();

				return new LetSyntax(name, null, step, start);
			}

			var value = this.ParseExpression();

			return new LetSyntax(name, value, null, start);
		}

		if (this.MatchWord("if"))
		{
			return this.ParseIf();
		}

		if (this.MatchWord("return"))
		{
			var start = this.Previous.Span;
			var hasValue = !this.IsSeparator() && !this.Is(TokenKind.RightBrace);
			var value = hasValue ? this.ParseExpression() : null;

			return new ReturnSyntax(value, start);
		}

		if (this.IsStepStart())
		{
			return this.ParseStep();
		}

		this.Fail("WF104", "Expected a workflow statement.");
		throw new WorkflowParseException();
	}

	private IfSyntax ParseIf()
	{
		var start = this.Previous.Span;
		var condition = this.ParseExpression();
		var thenBody = this.ParseStatementsBlock();
		IReadOnlyList<StatementSyntax> elseBody = [];
		var afterThen = this.position;
		this.SkipSeparators();

		if (this.MatchWord("else"))
		{
			elseBody = this.ParseStatementsBlock();
		}
		else
		{
			this.position = afterThen;
		}

		return new IfSyntax(condition, thenBody, elseBody, start);
	}

	private List<StatementSyntax> ParseStatementsBlock()
	{
		this.Expect(TokenKind.LeftBrace, "Expected '{' before statements.");
		var statements = new List<StatementSyntax>();
		this.SkipSeparators();

		while (!this.Is(TokenKind.RightBrace) && !this.Is(TokenKind.End))
		{
			statements.Add(this.ParseStatement());
			this.RequireSeparatorOrEnd();
			this.SkipSeparators();
		}

		this.Expect(TokenKind.RightBrace, "Expected '}' after statements.");

		return statements;
	}

	private StepSyntax ParseStep()
	{
		var keyword = this.Advance();
		var kind = keyword.Text switch
		{
			"run" => StepKind.Run,
			"task" => StepKind.Task,
			_ => StepKind.Call,
		};
		string target;
		string? title = null;
		ExpressionSyntax? inputCommand = null;

		if (kind == StepKind.Call)
		{
			target = this.ParsePath();
		}
		else
		{
			var stringToken = this.Expect(TokenKind.StringLiteral, "Expected a quoted step title or command.");
			var value = this.ParseString(stringToken);
			title = value.Parts.Count == 1 && value.Parts[0].Text is not null
				? value.Parts[0].Text
				: stringToken.Text;
			target = kind == StepKind.Run ? "mars.run" : "";
			if (kind == StepKind.Run)
			{
				inputCommand = value;
			}
		}

		var input = new Dictionary<string, ExpressionSyntax>(StringComparer.Ordinal);
		var environment = new Dictionary<string, ExpressionSyntax>(StringComparer.Ordinal);
		ExpressionSyntax? workdir = null;

		if (this.Match(TokenKind.LeftBrace))
		{
			this.SkipSeparators();

			while (!this.Is(TokenKind.RightBrace) && !this.Is(TokenKind.End))
			{
				if (kind == StepKind.Task && this.MatchWord("use"))
				{
					target = this.ParsePath();
				}
				else if (this.MatchWord("input"))
				{
					this.ReadAssignments(input);
				}
				else if (this.MatchWord("env"))
				{
					this.ReadAssignments(environment);
				}
				else if (this.MatchWord("workdir"))
				{
					this.Expect(TokenKind.Assign, "Expected '=' after workdir.");
					workdir = this.ParseExpression();
				}
				else
				{
					this.Fail("WF106", "Unknown step option.");
				}

				this.RequireSeparatorOrEnd();
				this.SkipSeparators();
			}

			this.Expect(TokenKind.RightBrace, "Expected '}' after step options.");
		}

		if (kind == StepKind.Task && target.Length == 0)
		{
			this.Report("WF107", "Task step needs a use target.", keyword.Span);
		}

		if (kind == StepKind.Run)
		{
			input.Add("command", inputCommand!);
		}

		return new StepSyntax(kind, target, title, input, environment, workdir, keyword.Span);
	}

	private void ReadAssignments(Dictionary<string, ExpressionSyntax> destination)
	{
		this.Expect(TokenKind.LeftBrace, "Expected '{' before assignments.");
		this.SkipSeparators();

		while (!this.Is(TokenKind.RightBrace) && !this.Is(TokenKind.End))
		{
			var name = this.ExpectIdentifier("Expected property name.");
			this.Expect(TokenKind.Assign, "Expected '=' after property name.");
			var value = this.ParseExpression();

			if (!destination.TryAdd(name.Text, value))
			{
				this.Report("WF108", $"Duplicate property '{name.Text}'.", name.Span);
			}

			this.RequireSeparatorOrEnd();
			this.SkipSeparators();
		}

		this.Expect(TokenKind.RightBrace, "Expected '}' after assignments.");
	}

	private ExpressionSyntax ParseExpression(int minimumPrecedence = 0)
	{
		var left = this.ParseUnary();

		while (true)
		{
			var precedence = GetPrecedence(this.Current);
			if (precedence < minimumPrecedence)
			{
				break;
			}

			var operatorToken = this.Advance();
			var right = this.ParseExpression(precedence + 1);
			left = new BinarySyntax(left, operatorToken.Text, right, operatorToken.Span);
		}

		return left;
	}

	private ExpressionSyntax ParseUnary()
	{
		var isUnary = this.Is(TokenKind.Bang) || this.Is(TokenKind.Minus)
			|| this.Is(TokenKind.Plus);
		if (isUnary)
		{
			var operatorToken = this.Advance();
			var isMinimumInteger = operatorToken.Kind == TokenKind.Minus
				&& this.Is(TokenKind.Number) && this.Current.Text == "2147483648";
			if (isMinimumInteger)
			{
				this.Advance();

				return new LiteralSyntax(int.MinValue, operatorToken.Span);
			}

			var operand = this.ParseUnary();

			return new UnarySyntax(operatorToken.Text, operand, operatorToken.Span);
		}

		var expression = this.ParsePrimary();

		while (true)
		{
			if (this.Match(TokenKind.Dot))
			{
				var member = this.ExpectIdentifier("Expected member name.");
				expression = new MemberSyntax(expression, member.Text, member.Span);
				continue;
			}

			if (this.Match(TokenKind.LeftBracket))
			{
				var index = this.ParseExpression();
				this.Expect(TokenKind.RightBracket, "Expected ']' after index.");
				expression = new IndexSyntax(expression, index, expression.Span);
				continue;
			}

			if (this.Match(TokenKind.LeftParen))
			{
				var arguments = new List<ExpressionSyntax>();
				while (!this.Is(TokenKind.RightParen) && !this.Is(TokenKind.End))
				{
					arguments.Add(this.ParseExpression());
					if (!this.Match(TokenKind.Comma))
					{
						break;
					}
				}

				this.Expect(TokenKind.RightParen, "Expected ')' after arguments.");
				expression = new CallSyntax(expression, arguments, expression.Span);
				continue;
			}

			break;
		}

		return expression;
	}

	private ExpressionSyntax ParsePrimary()
	{
		var token = this.Advance();

		if (token.Kind == TokenKind.StringLiteral)
		{
			return this.ParseString(token);
		}

		if (token.Kind == TokenKind.Number)
		{
			var isFloat = token.Text.Contains('.', StringComparison.Ordinal);
			if (isFloat)
			{
				var valid = float.TryParse(
					token.Text,
					NumberStyles.Float,
					CultureInfo.InvariantCulture,
					out var value
				);
				if (!valid || !float.IsFinite(value))
				{
					this.Report("WF115", "Number is outside the f32 range.", token.Span);
					value = 0;
				}

				return new LiteralSyntax(value, token.Span);
			}

			var isInteger = int.TryParse(
				token.Text,
				NumberStyles.Integer,
				CultureInfo.InvariantCulture,
				out var integer
			);
			if (!isInteger)
			{
				this.Report("WF116", "Number is outside the i32 range.", token.Span);
				integer = 0;
			}

			return new LiteralSyntax(integer, token.Span);
		}

		if (token.Kind == TokenKind.Identifier)
		{
			if (token.Text == "true" || token.Text == "false")
			{
				return new LiteralSyntax(token.Text == "true", token.Span);
			}

			if (token.Text == "null")
			{
				return new LiteralSyntax(null, token.Span);
			}

			return new NameSyntax(token.Text, token.Span);
		}

		if (token.Kind == TokenKind.LeftParen)
		{
			var expression = this.ParseExpression();
			this.Expect(TokenKind.RightParen, "Expected ')' after expression.");

			return expression;
		}

		if (token.Kind == TokenKind.LeftBracket)
		{
			var items = this.ParseExpressionList(TokenKind.RightBracket);

			return new ArraySyntax(items, token.Span);
		}

		if (token.Kind == TokenKind.LeftBrace)
		{
			var fields = new Dictionary<string, ExpressionSyntax>(StringComparer.Ordinal);
			this.SkipSeparators();

			while (!this.Is(TokenKind.RightBrace) && !this.Is(TokenKind.End))
			{
				var name = this.ExpectIdentifier("Expected object field.");
				this.Expect(TokenKind.Assign, "Expected '=' after object field.");
				var value = this.ParseExpression();
				fields.Add(name.Text, value);
				this.RequireSeparatorOrEnd();
				this.SkipSeparators();
			}

			this.Expect(TokenKind.RightBrace, "Expected '}' after object.");

			return new ObjectSyntax(fields, token.Span);
		}

		this.Report("WF109", "Expected expression.", token.Span);
		throw new WorkflowParseException();
	}

	private List<ExpressionSyntax> ParseExpressionList(TokenKind end)
	{
		var items = new List<ExpressionSyntax>();
		this.SkipSeparators();

		while (!this.Is(end) && !this.Is(TokenKind.End))
		{
			items.Add(this.ParseExpression());
			if (!this.Match(TokenKind.Comma))
			{
				break;
			}
			this.SkipSeparators();
		}

		this.Expect(end, "Expected closing delimiter.");

		return items;
	}

	private StringSyntax ParseString(WorkflowToken token)
	{
		var content = token.Text[1..^1];
		var parts = new List<StringPartSyntax>();
		var text = new System.Text.StringBuilder();

		for (var index = 0; index < content.Length; index++)
		{
			var current = content[index];
			if (current == '\\')
			{
				index++;
				if (index >= content.Length)
				{
					this.Report("WF110", "Unfinished string escape.", token.Span);
					break;
				}

				var escaped = content[index] switch
				{
					'{' => '{',
					'\\' => '\\',
					'\'' => '\'',
					'n' => '\n',
					'r' => '\r',
					't' => '\t',
					_ => '\0',
				};

				if (escaped == '\0')
				{
					this.Report("WF111", "Unknown string escape.", token.Span);
					continue;
				}

				text.Append(escaped);
				continue;
			}

			if (current != '{')
			{
				text.Append(current);
				continue;
			}

			if (text.Length > 0)
			{
				parts.Add(new StringPartSyntax(text.ToString(), null));
				text.Clear();
			}

			var start = index + 1;
			var end = FindInterpolationEnd(content, start);
			if (end < 0)
			{
				this.Report("WF112", "Unclosed string interpolation.", token.Span);
				break;
			}

			var expressionText = content[start..end];
			var lexer = new WorkflowLexer(expressionText, this.path);
			var expressionTokens = lexer.Lex();
			var parser = new WorkflowParser(expressionTokens, this.path);
			var expression = parser.ParseStandaloneExpression();
			this.diagnostics.AddRange(lexer.Diagnostics);
			this.diagnostics.AddRange(parser.Diagnostics);
			parts.Add(new StringPartSyntax(null, expression));
			index = end;
		}

		if (text.Length > 0 || parts.Count == 0)
		{
			parts.Add(new StringPartSyntax(text.ToString(), null));
		}

		return new StringSyntax(parts, token.Span);
	}

	private static int FindInterpolationEnd(string content, int start)
	{
		var depth = 0;
		var insideString = false;
		var escaped = false;

		for (var index = start; index < content.Length; index++)
		{
			var current = content[index];
			if (insideString)
			{
				if (current == '\\' && !escaped)
				{
					escaped = true;
					continue;
				}

				if (current == '\'' && !escaped)
				{
					insideString = false;
				}

				escaped = false;
				continue;
			}

			if (current == '\'')
			{
				insideString = true;
				continue;
			}

			if (current == '{')
			{
				depth++;
				continue;
			}

			if (current == '}' && depth == 0)
			{
				return index;
			}

			if (current == '}')
			{
				depth--;
			}
		}

		return -1;
	}

	private static int GetPrecedence(WorkflowToken token)
	{
		if (token.Kind == TokenKind.Identifier)
		{
			return token.Text switch
			{
				"or" => 1,
				"and" => 2,
				_ => -1,
			};
		}

		return token.Kind switch
		{
			TokenKind.EqualEqual or TokenKind.BangEqual => 3,
			TokenKind.Less or TokenKind.LessEqual or TokenKind.Greater or TokenKind.GreaterEqual => 4,
			TokenKind.Plus or TokenKind.Minus => 5,
			TokenKind.Star or TokenKind.Slash or TokenKind.Percent => 6,
			_ => -1,
		};
	}

	private void RequireSeparatorOrEnd()
	{
		var atEnd = this.IsSeparator() || this.Is(TokenKind.RightBrace)
			|| this.Is(TokenKind.End);
		if (!atEnd)
		{
			this.Fail("WF113", "Expected a line break or ';'.");
		}
	}

	private void SkipSeparators()
	{
		while (this.IsSeparator())
		{
			this.Advance();
		}
	}

	private bool IsSeparator()
	{
		return this.Is(TokenKind.NewLine) || this.Is(TokenKind.Semicolon)
			|| this.Is(TokenKind.Comma);
	}

	private bool IsStepStart()
	{
		return this.IsWord("run") || this.IsWord("task") || this.IsWord("call");
	}

	private bool IsWord(string value)
	{
		return this.Current.Kind == TokenKind.Identifier && this.Current.Text == value;
	}

	private bool MatchWord(string value)
	{
		if (!this.IsWord(value))
		{
			return false;
		}

		this.Advance();

		return true;
	}

	private bool Is(TokenKind kind)
	{
		return this.Current.Kind == kind;
	}

	private bool Match(TokenKind kind)
	{
		if (!this.Is(kind))
		{
			return false;
		}

		this.Advance();

		return true;
	}

	private WorkflowToken ExpectIdentifier(string message)
	{
		return this.Expect(TokenKind.Identifier, message);
	}

	private WorkflowToken Expect(TokenKind kind, string message)
	{
		if (this.Is(kind))
		{
			return this.Advance();
		}

		this.Fail("WF114", message);
		throw new WorkflowParseException();
	}

	private void Fail(string code, string message)
	{
		this.Report(code, message, this.Current.Span);
		throw new WorkflowParseException();
	}

	private void Report(string code, string message, SourceSpan span)
	{
		this.diagnostics.Add(new WorkflowDiagnostic(code, message, span));
	}

	private void Synchronize()
	{
		while (!this.Is(TokenKind.End) && !this.Is(TokenKind.NewLine))
		{
			this.Advance();
		}
	}

	private WorkflowToken Advance()
	{
		var token = this.Current;
		if (this.position < this.tokens.Count - 1)
		{
			this.position++;
		}

		return token;
	}

	private WorkflowToken Current => this.tokens[this.position];
	private WorkflowToken Previous => this.tokens[this.position - 1];
}

public class WorkflowParseException : Exception;
