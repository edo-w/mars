using System.CommandLine;
using System.CommandLine.Parsing;
using Microsoft.Extensions.DependencyInjection;

namespace Mars.Cli.Commands;

public class KvGetFileCommand : Command
{
	private readonly IServiceProvider container;
	private readonly Option<string> environmentOption;
	private readonly Argument<string> keyArgument;
	private readonly Argument<string> pathArgument;
	private readonly Option<int?> versionOption;

	public KvGetFileCommand(IServiceProvider container, Option<string> environmentOption)
		: base("get-file", "Write a binary value to a new file")
	{
		this.container = container;
		this.environmentOption = environmentOption;
		this.keyArgument = new Argument<string>("key");
		this.pathArgument = new Argument<string>("output-path");
		this.versionOption = new Option<int?>("--version");

		this.Arguments.Add(this.keyArgument);
		this.Arguments.Add(this.pathArgument);
		this.Options.Add(this.versionOption);

		this.SetAction(this.HandleAsync);
	}

	private async Task<int> HandleAsync(
		ParseResult parseResult,
		CancellationToken cancellationToken
	)
	{
		var key = parseResult.GetValue(this.keyArgument)!;
		var path = parseResult.GetValue(this.pathArgument)!;
		var version = parseResult.GetValue(this.versionOption);
		var environment = parseResult.GetValue(this.environmentOption);

		var input = new KvGetFileCommandInput(key, path, version, environment);

		var output = parseResult.InvocationConfiguration.Output;
		var error = parseResult.InvocationConfiguration.Error;
		var context = new CommandContext<KvGetFileCommandInput>(
			input,
			output,
			error,
			cancellationToken
		);

		var handler = this.container.GetRequiredService<KvGetFileCommandHandler>();

		return await handler.HandleAsync(context);
	}
}

public record KvGetFileCommandInput(string Key, string OutputPath, int? Version, string? Environment);
