using System.CommandLine;
using System.CommandLine.Parsing;
using Microsoft.Extensions.DependencyInjection;

namespace Mars.Cli.Commands;

public class SshCaShowCommand : Command
{
	private readonly IServiceProvider container;
	private readonly Option<string> environmentOption;
	private readonly Argument<string> nameArgument;

	public SshCaShowCommand(IServiceProvider container, Option<string> environmentOption)
		: base("show", "Show an SSH CA public key")
	{
		this.container = container;
		this.environmentOption = environmentOption;
		this.nameArgument = new Argument<string>("name")
		{
			Arity = ArgumentArity.ZeroOrOne,
		};

		this.Arguments.Add(this.nameArgument);

		this.SetAction(this.HandleAsync);
	}

	private async Task<int> HandleAsync(
		ParseResult parseResult,
		CancellationToken cancellationToken
	)
	{
		var parsedName = parseResult.GetValue(this.nameArgument);
		var name = parsedName ?? "default";
		var environment = parseResult.GetValue(this.environmentOption);

		var input = new SshCaShowCommandInput(name, environment);

		var output = parseResult.InvocationConfiguration.Output;
		var error = parseResult.InvocationConfiguration.Error;
		var context = new CommandContext<SshCaShowCommandInput>(
			input,
			output,
			error,
			cancellationToken
		);

		var handler = this.container.GetRequiredService<SshCaShowCommandHandler>();

		return await handler.HandleAsync(context);
	}
}

public record SshCaShowCommandInput(string Name, string? Environment);
