using System.CommandLine;
using System.CommandLine.Parsing;
using Microsoft.Extensions.DependencyInjection;

namespace Mars.Cli.Commands;

public class SshCaRemoveCommand : Command
{
	private readonly IServiceProvider container;
	private readonly Option<string> environmentOption;
	private readonly Argument<string> nameArgument;

	public SshCaRemoveCommand(IServiceProvider container, Option<string> environmentOption)
		: base("remove", "Remove an SSH CA")
	{
		this.container = container;
		this.environmentOption = environmentOption;
		this.nameArgument = new Argument<string>("name");
		this.Aliases.Add("rm");

		this.Arguments.Add(this.nameArgument);

		this.SetAction(this.HandleAsync);
	}

	private async Task<int> HandleAsync(
		ParseResult parseResult,
		CancellationToken cancellationToken
	)
	{
		var name = parseResult.GetValue(this.nameArgument)!;
		var environment = parseResult.GetValue(this.environmentOption);

		var input = new SshCaRemoveCommandInput(name, environment);

		var output = parseResult.InvocationConfiguration.Output;
		var error = parseResult.InvocationConfiguration.Error;
		var context = new CommandContext<SshCaRemoveCommandInput>(
			input,
			output,
			error,
			cancellationToken
		);

		var handler = this.container.GetRequiredService<SshCaRemoveCommandHandler>();

		return await handler.HandleAsync(context);
	}
}

public record SshCaRemoveCommandInput(string Name, string? Environment);
