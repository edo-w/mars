using Mars.Workflow.App.Language;
using NUnit.Framework;
using Assert = NUnit.Framework.Legacy.ClassicAssert;

namespace Mars.Workflow.Tests.App.Language;

public class WorkflowParserTests
{
	[Test]
	public void DefaultsMissingWorkflowBlockToEmptyProperties()
	{
		var source = "run 'echo hello'\n";
		var lexer = new WorkflowLexer(source, "example.mars");
		var tokens = lexer.Lex();
		var parser = new WorkflowParser(tokens, "example.mars");

		var document = parser.Parse();

		Assert.IsEmpty(parser.Diagnostics);
		Assert.IsNotNull(document.Properties);
		Assert.IsNull(document.Properties!.Input);
		Assert.IsNull(document.Properties.Output);
		Assert.AreEqual(1, document.Statements.Count);
	}

	[Test]
	public void ParsesPropertiesAndFileScopeSteps()
	{
		var source = """
			workflow {
				input {
					name string = 'world'
				}
			}
			let greeting = 'hello {name}'
			run 'echo hello'
			""";
		var lexer = new WorkflowLexer(source, "example.mars");
		var tokens = lexer.Lex();
		var parser = new WorkflowParser(tokens, "example.mars");

		var document = parser.Parse();

		Assert.IsEmpty(lexer.Diagnostics);
		Assert.IsEmpty(parser.Diagnostics);
		Assert.IsNotNull(document.Properties);
		Assert.AreEqual(2, document.Statements.Count);
	}

	[Test]
	public void EscapedOpeningBraceRemainsLiteral()
	{
		var source = "workflow {}\nlet text = '\\{}'\n";
		var lexer = new WorkflowLexer(source, "example.mars");
		var tokens = lexer.Lex();
		var parser = new WorkflowParser(tokens, "example.mars");

		var document = parser.Parse();
		var statement = (LetSyntax)document.Statements[0];
		var value = (StringSyntax)statement.Value!;

		Assert.IsEmpty(parser.Diagnostics);
		Assert.AreEqual("{}", value.Parts[0].Text);
	}

	[Test]
	public void RejectsSecondWorkflowBlock()
	{
		var source = "workflow {}\nworkflow {}\n";
		var lexer = new WorkflowLexer(source, "example.mars");
		var tokens = lexer.Lex();
		var parser = new WorkflowParser(tokens, "example.mars");

		parser.Parse();

		Assert.IsTrue(parser.Diagnostics.Any(item => item.Code == "WF100"));
	}

	[Test]
	public void ParsesNestedStringInsideInterpolation()
	{
		var source = "workflow {}\nlet text = 'value {('x' + 'y')}'\n";
		var lexer = new WorkflowLexer(source, "example.mars");
		var tokens = lexer.Lex();
		var parser = new WorkflowParser(tokens, "example.mars");

		var document = parser.Parse();

		Assert.IsEmpty(lexer.Diagnostics);
		Assert.IsEmpty(parser.Diagnostics);
		Assert.AreEqual(1, document.Statements.Count);
	}

	[Test]
	public void ParsesRelativeWorkflowCall()
	{
		var source = "workflow {}\ncall ./child.mars\n";
		var lexer = new WorkflowLexer(source, "example.mars");
		var tokens = lexer.Lex();
		var parser = new WorkflowParser(tokens, "example.mars");

		var document = parser.Parse();
		var call = (StepSyntax)document.Statements[0];

		Assert.IsEmpty(parser.Diagnostics);
		Assert.AreEqual("./child.mars", call.Target);
	}

	[Test]
	public void ReportsIntegerOverflowAsDiagnostic()
	{
		var source = "workflow {}\nlet value = 2147483649\n";
		var lexer = new WorkflowLexer(source, "example.mars");
		var tokens = lexer.Lex();
		var parser = new WorkflowParser(tokens, "example.mars");

		parser.Parse();

		Assert.IsTrue(parser.Diagnostics.Any(item => item.Code == "WF116"));
	}
}
