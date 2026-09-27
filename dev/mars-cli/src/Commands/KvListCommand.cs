using System.CommandLine;
using System.CommandLine.Parsing;
using Microsoft.Extensions.DependencyInjection;

namespace Mars.Cli.Commands;

public class KvListCommand : Command
{
	private readonly IServiceProvider container;
	private readonly Option<string> environmentOption;
	private readonly Argument<string?> prefixArgument;

	public KvListCommand(IServiceProvider container, Option<string> environmentOption)
		: base("list", "List latest key versions")
	{
		this.container = container;
		this.environmentOption = environmentOption;
		this.prefixArgument = new Argument<string?>("key-path")
		{
			Arity = ArgumentArity.ZeroOrOne,
		};

		this.Arguments.Add(this.prefixArgument);
		this.Aliases.Add("ls");

		this.SetAction(this.HandleAsync);
	}

	private async Task<int> HandleAsync(
		ParseResult parseResult,
		CancellationToken cancellationToken
	)
	{
		var prefix = parseResult.GetValue(this.prefixArgument);
		var environment = parseResult.GetValue(this.environmentOption);

		var input = new KvListCommandInput(prefix, environment);

		var output = parseResult.InvocationConfiguration.Output;
		var error = parseResult.InvocationConfiguration.Error;
		var context = new CommandContext<KvListCommandInput>(
			input,
			output,
			error,
			cancellationToken
		);

		var handler = this.container.GetRequiredService<KvListCommandHandler>();

		return await handler.HandleAsync(context);
	}
}

public record KvListCommandInput(string? Prefix, string? Environment);
