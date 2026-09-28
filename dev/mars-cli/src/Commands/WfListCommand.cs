using System.CommandLine;
using System.CommandLine.Parsing;
using Microsoft.Extensions.DependencyInjection;

namespace Mars.Cli.Commands;

public class WfListCommand : Command
{
	private readonly IServiceProvider container;

	public WfListCommand(IServiceProvider container)
		: base("list", "List workflow runs")
	{
		this.container = container;
		this.Aliases.Add("ls");
		this.SetAction(this.HandleAsync);
	}

	private async Task<int> HandleAsync(ParseResult parse, CancellationToken cancellationToken)
	{
		var input = new WfListCommandInput();
		var context = new CommandContext<WfListCommandInput>(
			input,
			parse.InvocationConfiguration.Output,
			parse.InvocationConfiguration.Error,
			cancellationToken
		);
		var handler = this.container.GetRequiredService<WfListCommandHandler>();

		return await handler.HandleAsync(context);
	}
}

public record WfListCommandInput;
