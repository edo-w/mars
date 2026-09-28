using System.CommandLine;
using System.CommandLine.Parsing;
using Microsoft.Extensions.DependencyInjection;

namespace Mars.Cli.Commands;

public class WfGraphCommand : Command
{
	private readonly IServiceProvider container;
	private readonly Argument<string> pathArgument;
	private readonly Option<string> formatOption;

	public WfGraphCommand(IServiceProvider container) : base("graph", "Print a workflow graph")
	{
		this.container = container;
		this.pathArgument = new Argument<string>("workflow-path");
		this.formatOption = new Option<string>("--format")
		{
			Description = "Graph format: dot or json",
			DefaultValueFactory = _ => "dot",
		};
		this.Arguments.Add(this.pathArgument);
		this.Options.Add(this.formatOption);
		this.SetAction(this.HandleAsync);
	}

	private async Task<int> HandleAsync(ParseResult parse, CancellationToken cancellationToken)
	{
		var path = parse.GetValue(this.pathArgument)!;
		var format = parse.GetValue(this.formatOption)!;
		var input = new WfGraphCommandInput(path, format);
		var context = new CommandContext<WfGraphCommandInput>(
			input,
			parse.InvocationConfiguration.Output,
			parse.InvocationConfiguration.Error,
			cancellationToken
		);
		var handler = this.container.GetRequiredService<WfGraphCommandHandler>();

		return await handler.HandleAsync(context);
	}
}

public record WfGraphCommandInput(string Path, string Format);
