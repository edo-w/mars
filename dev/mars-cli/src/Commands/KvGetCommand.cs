using System.CommandLine;
using System.CommandLine.Parsing;
using Microsoft.Extensions.DependencyInjection;

namespace Mars.Cli.Commands;

public class KvGetCommand : Command
{
	private readonly IServiceProvider container;
	private readonly Option<string> environmentOption;
	private readonly Argument<string> keyArgument;
	private readonly Option<int?> versionOption;
	private readonly Option<bool> rawOption;

	public KvGetCommand(IServiceProvider container, Option<string> environmentOption)
		: base("get", "Read a KV value")
	{
		this.container = container;
		this.environmentOption = environmentOption;
		this.keyArgument = new Argument<string>("key");
		this.versionOption = new Option<int?>("--version");
		this.rawOption = new Option<bool>("--raw");

		this.Arguments.Add(this.keyArgument);
		this.Options.Add(this.versionOption);
		this.Options.Add(this.rawOption);

		this.SetAction(this.HandleAsync);
	}

	private async Task<int> HandleAsync(
		ParseResult parseResult,
		CancellationToken cancellationToken
	)
	{
		var key = parseResult.GetValue(this.keyArgument)!;
		var version = parseResult.GetValue(this.versionOption);
		var raw = parseResult.GetValue(this.rawOption);
		var environment = parseResult.GetValue(this.environmentOption);

		var input = new KvGetCommandInput(key, version, raw, environment);

		var output = parseResult.InvocationConfiguration.Output;
		var error = parseResult.InvocationConfiguration.Error;
		var context = new CommandContext<KvGetCommandInput>(
			input,
			output,
			error,
			cancellationToken
		);

		var handler = this.container.GetRequiredService<KvGetCommandHandler>();

		return await handler.HandleAsync(context);
	}
}

public record KvGetCommandInput(string Key, int? Version, bool Raw, string? Environment);
