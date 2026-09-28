using System.CommandLine;
using System.CommandLine.Parsing;
using Microsoft.Extensions.DependencyInjection;

namespace Mars.Cli.Commands;

public class WfCheckCommand : Command
{
	private readonly IServiceProvider container;
	private readonly Argument<string> pathArgument;

	public WfCheckCommand(IServiceProvider container) : base("check", "Check a workflow without running it")
	{
		this.container = container;
		this.pathArgument = new Argument<string>("workflow-path");
		this.Arguments.Add(this.pathArgument);
		this.SetAction(this.HandleAsync);
	}

	private async Task<int> HandleAsync(ParseResult parse, CancellationToken cancellationToken)
	{
		var path = parse.GetValue(this.pathArgument)!;
		var input = new WfCheckCommandInput(path);
		var context = new CommandContext<WfCheckCommandInput>(
			input,
			parse.InvocationConfiguration.Output,
			parse.InvocationConfiguration.Error,
			cancellationToken
		);
		var handler = this.container.GetRequiredService<WfCheckCommandHandler>();

		return await handler.HandleAsync(context);
	}
}

public record WfCheckCommandInput(string Path);
