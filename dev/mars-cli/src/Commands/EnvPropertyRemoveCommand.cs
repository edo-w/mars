using System.CommandLine;
using System.CommandLine.Parsing;
using Microsoft.Extensions.DependencyInjection;

namespace Mars.Cli.Commands;

public class EnvPropertyRemoveCommand : Command
{
	private readonly IServiceProvider container;
	private readonly Argument<string> fullNameArgument;
	private readonly Argument<string> keyArgument;

	public EnvPropertyRemoveCommand(IServiceProvider container)
		: base("remove", "Remove an environment property")
	{
		this.container = container;
		this.fullNameArgument = new Argument<string>("namespace/name");
		this.keyArgument = new Argument<string>("key");

		this.Arguments.Add(this.fullNameArgument);
		this.Arguments.Add(this.keyArgument);

		this.SetAction(this.HandleAsync);
	}

	private async Task<int> HandleAsync(
		ParseResult parseResult,
		CancellationToken cancellationToken
	)
	{
		var fullName = parseResult.GetValue(this.fullNameArgument)!;
		var key = parseResult.GetValue(this.keyArgument)!;

		var input = new EnvPropertyRemoveCommandInput(fullName, key);

		var output = parseResult.InvocationConfiguration.Output;
		var error = parseResult.InvocationConfiguration.Error;
		var context = new CommandContext<EnvPropertyRemoveCommandInput>(
			input,
			output,
			error,
			cancellationToken
		);

		var handler = this.container.GetRequiredService<EnvPropertyRemoveCommandHandler>();

		return await handler.HandleAsync(context);
	}
}

public record EnvPropertyRemoveCommandInput(string FullName, string Key);
