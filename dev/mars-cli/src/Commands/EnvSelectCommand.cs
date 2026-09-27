using System.CommandLine;
using System.CommandLine.Parsing;
using Microsoft.Extensions.DependencyInjection;

namespace Mars.Cli.Commands;

public class EnvSelectCommand : Command
{
	private readonly IServiceProvider container;
	private readonly Argument<string> nameArgument;

	public EnvSelectCommand(IServiceProvider container)
		: base("select", "Select the current environment")
	{
		this.container = container;
		this.nameArgument = new Argument<string>("name")
		{
			Description = "Environment name or namespace/name",
		};

		this.Arguments.Add(this.nameArgument);

		this.SetAction(this.HandleAsync);
	}

	private async Task<int> HandleAsync(
		ParseResult parseResult,
		CancellationToken cancellationToken
	)
	{
		var name = parseResult.GetValue(this.nameArgument)!;

		var input = new EnvSelectCommandInput(name);

		var output = parseResult.InvocationConfiguration.Output;
		var error = parseResult.InvocationConfiguration.Error;
		var context = new CommandContext<EnvSelectCommandInput>(
			input,
			output,
			error,
			cancellationToken
		);

		var handler = this.container.GetRequiredService<EnvSelectCommandHandler>();

		return await handler.HandleAsync(context);
	}
}

public record EnvSelectCommandInput(string Name);
