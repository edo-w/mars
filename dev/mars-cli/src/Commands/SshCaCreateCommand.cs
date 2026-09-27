using System.CommandLine;
using System.CommandLine.Parsing;
using Microsoft.Extensions.DependencyInjection;

namespace Mars.Cli.Commands;

public class SshCaCreateCommand : Command
{
	private readonly IServiceProvider container;
	private readonly Option<string> environmentOption;
	private readonly Argument<string> nameArgument;

	public SshCaCreateCommand(IServiceProvider container, Option<string> environmentOption)
		: base("create", "Create a protected SSH CA")
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

		var input = new SshCaCreateCommandInput(name, environment);

		var output = parseResult.InvocationConfiguration.Output;
		var error = parseResult.InvocationConfiguration.Error;
		var context = new CommandContext<SshCaCreateCommandInput>(
			input,
			output,
			error,
			cancellationToken
		);

		var handler = this.container.GetRequiredService<SshCaCreateCommandHandler>();

		return await handler.HandleAsync(context);
	}
}

public record SshCaCreateCommandInput(string Name, string? Environment);
