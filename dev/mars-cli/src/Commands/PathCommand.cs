using System.CommandLine;
using System.CommandLine.Parsing;
using Microsoft.Extensions.DependencyInjection;

namespace Mars.Cli.Commands;

public class PathCommand : Command
{
	private readonly IServiceProvider container;

	public PathCommand(IServiceProvider container)
		: base("path", "Show existing Mars config and state paths")
	{
		this.container = container;
		this.SetAction(this.HandleAsync);
	}

	private async Task<int> HandleAsync(
		ParseResult parseResult,
		CancellationToken cancellationToken
	)
	{
		var input = new PathCommandInput();
		var output = parseResult.InvocationConfiguration.Output;
		var error = parseResult.InvocationConfiguration.Error;
		var context = new CommandContext<PathCommandInput>(
			input,
			output,
			error,
			cancellationToken
		);
		var handler = this.container.GetRequiredService<PathCommandHandler>();

		return await handler.HandleAsync(context);
	}
}

public record PathCommandInput;
