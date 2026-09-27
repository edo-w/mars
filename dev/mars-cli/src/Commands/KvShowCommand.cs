using System.CommandLine;
using System.CommandLine.Parsing;
using Microsoft.Extensions.DependencyInjection;

namespace Mars.Cli.Commands;

public class KvShowCommand : Command
{
	private readonly IServiceProvider container;
	private readonly Option<string> environmentOption;
	private readonly Argument<string> keyArgument;

	public KvShowCommand(IServiceProvider container, Option<string> environmentOption)
		: base("show", "Show the latest KV version metadata")
	{
		this.container = container;
		this.environmentOption = environmentOption;
		this.keyArgument = new Argument<string>("key");

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
		var input = new KvShowCommandInput(key, environment);

		var output = parseResult.InvocationConfiguration.Output;
		var error = parseResult.InvocationConfiguration.Error;
		var context = new CommandContext<KvShowCommandInput>(
			input,
			output,
			error,
			cancellationToken
		);

		var handler = this.container.GetRequiredService<KvShowCommandHandler>();

		return await handler.HandleAsync(context);
	}
}

public record KvShowCommandInput(string Key, string? Environment);
