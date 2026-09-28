using System.CommandLine;
using System.CommandLine.Parsing;
using Microsoft.Extensions.DependencyInjection;

namespace Mars.Cli.Commands;

public class WfRunCommand : Command
{
	private readonly IServiceProvider container;
	private readonly Argument<string?> pathArgument;
	private readonly Option<string[]> inputOption;
	private readonly Option<string?> inputFileOption;
	private readonly Option<string?> inputJsonOption;

	public WfRunCommand(IServiceProvider container)
		: base("run", "Run a workflow file")
	{
		this.container = container;
		this.pathArgument = new Argument<string?>("workflow-path")
		{
			Arity = ArgumentArity.ZeroOrOne,
		};
		this.inputOption = new Option<string[]>("--input")
		{
			Description = "Set an input field with key=value; repeat for multiple fields",
		};
		this.inputOption.Aliases.Add("-i");
		this.inputFileOption = new Option<string?>("--input-file")
		{
			Description = "Read workflow input as JSON from a file",
		};
		this.inputJsonOption = new Option<string?>("--input-json")
		{
			Description = "Provide the whole workflow input as JSON",
		};

		this.Arguments.Add(this.pathArgument);
		this.Options.Add(this.inputOption);
		this.Options.Add(this.inputFileOption);
		this.Options.Add(this.inputJsonOption);
		this.SetAction(this.HandleAsync);
	}

	private async Task<int> HandleAsync(ParseResult parse, CancellationToken cancellationToken)
	{
		var path = parse.GetValue(this.pathArgument) ?? "workflow.mwf";
		var pairs = parse.GetValue(this.inputOption) ?? [];
		var inputFile = parse.GetValue(this.inputFileOption);
		var inputJson = parse.GetValue(this.inputJsonOption);
		var input = new WfRunCommandInput(path, inputFile, inputJson, pairs);
		var context = new CommandContext<WfRunCommandInput>(
			input,
			parse.InvocationConfiguration.Output,
			parse.InvocationConfiguration.Error,
			cancellationToken
		);
		var handler = this.container.GetRequiredService<WfRunCommandHandler>();

		return await handler.HandleAsync(context);
	}
}

public record WfRunCommandInput(
	string Path,
	string? InputFile,
	string? InputJson,
	IReadOnlyList<string> InputPairs
);
