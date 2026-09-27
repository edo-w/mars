using System.CommandLine;
using System.CommandLine.Parsing;
using Microsoft.Extensions.DependencyInjection;

namespace Mars.Cli.Commands;

public class KvSetCommand : Command
{
	private readonly IServiceProvider container;
	private readonly Option<string> environmentOption;
	private readonly Argument<string> keyArgument;
	private readonly Option<string> valueOption;
	private readonly Option<string> fileOption;
	private readonly Option<bool> inputOption;
	private readonly Option<bool> secretOption;

	public KvSetCommand(IServiceProvider container, Option<string> environmentOption)
		: base("set", "Store a KV value from text, a file, or stdin")
	{
		this.container = container;
		this.environmentOption = environmentOption;
		this.keyArgument = new Argument<string>("key");
		this.valueOption = new Option<string>("--value");
		this.fileOption = new Option<string>("--file");
		this.inputOption = new Option<bool>("--input");
		this.secretOption = new Option<bool>("--secret");

		this.Arguments.Add(this.keyArgument);
		this.Options.Add(this.valueOption);
		this.Options.Add(this.fileOption);
		this.Options.Add(this.inputOption);
		this.Options.Add(this.secretOption);

		this.SetAction(this.HandleAsync);
	}

	private async Task<int> HandleAsync(
		ParseResult parseResult,
		CancellationToken cancellationToken
	)
	{
		var key = parseResult.GetValue(this.keyArgument)!;
		var value = parseResult.GetValue(this.valueOption);
		var file = parseResult.GetValue(this.fileOption);
		var inputFromStdin = parseResult.GetValue(this.inputOption);
		var secret = parseResult.GetValue(this.secretOption);
		var environment = parseResult.GetValue(this.environmentOption);

		var input = new KvSetCommandInput(key, value, file, inputFromStdin, secret, environment);

		var output = parseResult.InvocationConfiguration.Output;
		var error = parseResult.InvocationConfiguration.Error;
		var context = new CommandContext<KvSetCommandInput>(
			input,
			output,
			error,
			cancellationToken
		);

		var handler = this.container.GetRequiredService<KvSetCommandHandler>();

		return await handler.HandleAsync(context);
	}
}

public record KvSetCommandInput(
	string Key,
	string? Value,
	string? FilePath,
	bool InputFromStdin,
	bool Secret,
	string? Environment
);
