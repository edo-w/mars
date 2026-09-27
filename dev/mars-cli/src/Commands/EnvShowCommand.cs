using System.CommandLine;
using System.CommandLine.Parsing;
using Microsoft.Extensions.DependencyInjection;

namespace Mars.Cli.Commands;

public class EnvShowCommand : Command
{
	private readonly IServiceProvider container;
	private readonly Option<string> environmentOption;

	public EnvShowCommand(IServiceProvider container, Option<string> environmentOption)
		: base("show", "Show an environment")
	{
		this.container = container;
		this.environmentOption = environmentOption;

		this.SetAction(this.HandleAsync);
	}

	private async Task<int> HandleAsync(
		ParseResult parseResult,
		CancellationToken cancellationToken
	)
	{
		var fullName = parseResult.GetValue(this.environmentOption);

		var input = new EnvShowCommandInput(fullName);

		var output = parseResult.InvocationConfiguration.Output;
		var error = parseResult.InvocationConfiguration.Error;
		var context = new CommandContext<EnvShowCommandInput>(
			input,
			output,
			error,
			cancellationToken
		);

		var handler = this.container.GetRequiredService<EnvShowCommandHandler>();

		return await handler.HandleAsync(context);
	}
}

public record EnvShowCommandInput(string? FullName);
