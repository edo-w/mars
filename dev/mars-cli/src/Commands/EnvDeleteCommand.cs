using System.CommandLine;
using System.CommandLine.Parsing;
using Microsoft.Extensions.DependencyInjection;

namespace Mars.Cli.Commands;

public class EnvDeleteCommand : Command
{
	private readonly IServiceProvider container;
	private readonly Argument<string> fullNameArgument;

	public EnvDeleteCommand(IServiceProvider container)
		: base("delete", "Delete an environment and its data")
	{
		this.container = container;
		this.fullNameArgument = new Argument<string>("namespace/name");

		this.Arguments.Add(this.fullNameArgument);

		this.SetAction(this.HandleAsync);
	}

	private async Task<int> HandleAsync(
		ParseResult parseResult,
		CancellationToken cancellationToken
	)
	{
		var fullName = parseResult.GetValue(this.fullNameArgument)!;

		var input = new EnvDeleteCommandInput(fullName);

		var output = parseResult.InvocationConfiguration.Output;
		var error = parseResult.InvocationConfiguration.Error;
		var context = new CommandContext<EnvDeleteCommandInput>(
			input,
			output,
			error,
			cancellationToken
		);

		var handler = this.container.GetRequiredService<EnvDeleteCommandHandler>();

		return await handler.HandleAsync(context);
	}
}

public record EnvDeleteCommandInput(string FullName);
