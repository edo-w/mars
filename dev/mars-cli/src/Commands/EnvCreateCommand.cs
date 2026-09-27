using System.CommandLine;
using System.CommandLine.Parsing;
using Microsoft.Extensions.DependencyInjection;

namespace Mars.Cli.Commands;

public class EnvCreateCommand : Command
{
	private readonly IServiceProvider container;
	private readonly Argument<string> nameArgument;
	private readonly Option<string> namespaceOption;

	public EnvCreateCommand(IServiceProvider container)
		: base("create", "Create an environment")
	{
		this.container = container;
		this.nameArgument = new Argument<string>("name");
		this.namespaceOption = new Option<string>("--namespace");

		this.Arguments.Add(this.nameArgument);
		this.Options.Add(this.namespaceOption);

		this.SetAction(this.HandleAsync);
	}

	private async Task<int> HandleAsync(
		ParseResult parseResult,
		CancellationToken cancellationToken
	)
	{
		var name = parseResult.GetValue(this.nameArgument)!;
		var environmentNamespace = parseResult.GetValue(this.namespaceOption);

		var input = new EnvCreateCommandInput(name, environmentNamespace);

		var output = parseResult.InvocationConfiguration.Output;
		var error = parseResult.InvocationConfiguration.Error;
		var context = new CommandContext<EnvCreateCommandInput>(
			input,
			output,
			error,
			cancellationToken
		);

		var handler = this.container.GetRequiredService<EnvCreateCommandHandler>();

		return await handler.HandleAsync(context);
	}
}

public record EnvCreateCommandInput(string Name, string? Namespace);
