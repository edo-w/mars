using System.CommandLine;
using System.CommandLine.Parsing;
using Microsoft.Extensions.DependencyInjection;

namespace Mars.Cli.Commands;

public class KvRemoveCommand : Command
{
	private readonly IServiceProvider container;
	private readonly Option<string> environmentOption;
	private readonly Argument<string> keyArgument;

	public KvRemoveCommand(IServiceProvider container, Option<string> environmentOption)
		: base("remove", "Remove a key and its versions")
	{
		this.container = container;
		this.environmentOption = environmentOption;
		this.keyArgument = new Argument<string>("key");
		this.Aliases.Add("rm");

		this.Arguments.Add(this.keyArgument);

		this.SetAction(this.HandleAsync);
	}

	private async Task<int> HandleAsync(
		ParseResult parseResult,
		CancellationToken cancellationToken
	)
	{
		var key = parseResult.GetValue(this.keyArgument)!;
		var environment = parseResult.GetValue(this.environmentOption);

		var input = new KvRemoveCommandInput(key, environment);

		var output = parseResult.InvocationConfiguration.Output;
		var error = parseResult.InvocationConfiguration.Error;
		var context = new CommandContext<KvRemoveCommandInput>(
			input,
			output,
			error,
			cancellationToken
		);

		var handler = this.container.GetRequiredService<KvRemoveCommandHandler>();

		return await handler.HandleAsync(context);
	}
}

public record KvRemoveCommandInput(string Key, string? Environment);
