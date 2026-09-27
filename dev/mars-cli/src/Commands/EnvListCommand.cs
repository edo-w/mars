using System.CommandLine;
using System.CommandLine.Parsing;
using Microsoft.Extensions.DependencyInjection;

namespace Mars.Cli.Commands;

public class EnvListCommand : Command
{
	private readonly IServiceProvider container;

	public EnvListCommand(IServiceProvider container)
		: base("list", "List environments")
	{
		this.container = container;
		this.Aliases.Add("ls");

		this.SetAction(this.HandleAsync);
	}

	private async Task<int> HandleAsync(
		ParseResult parseResult,
		CancellationToken cancellationToken
	)
	{

		var input = new EnvListCommandInput();

		var output = parseResult.InvocationConfiguration.Output;
		var error = parseResult.InvocationConfiguration.Error;
		var context = new CommandContext<EnvListCommandInput>(
			input,
			output,
			error,
			cancellationToken
		);

		var handler = this.container.GetRequiredService<EnvListCommandHandler>();

		return await handler.HandleAsync(context);
	}
}

public record EnvListCommandInput();
