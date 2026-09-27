using System.CommandLine;
using System.CommandLine.Parsing;
using Microsoft.Extensions.DependencyInjection;

namespace Mars.Cli.Commands;

public class NodeShowCommand : Command
{
	private readonly IServiceProvider container;
	private readonly Option<string> environmentOption;
	private readonly Argument<string> nameOrIdArgument;

	public NodeShowCommand(IServiceProvider container, Option<string> environmentOption)
		: base("show", "Show a node")
	{
		this.container = container;
		this.environmentOption = environmentOption;
		this.nameOrIdArgument = new Argument<string>("name-or-id");

		this.Arguments.Add(this.nameOrIdArgument);

		this.SetAction(this.HandleAsync);
	}

	private async Task<int> HandleAsync(
		ParseResult parseResult,
		CancellationToken cancellationToken
	)
	{
		var nameOrId = parseResult.GetValue(this.nameOrIdArgument)!;
		var environment = parseResult.GetValue(this.environmentOption);

		var input = new NodeShowCommandInput(nameOrId, environment);

		var output = parseResult.InvocationConfiguration.Output;
		var error = parseResult.InvocationConfiguration.Error;
		var context = new CommandContext<NodeShowCommandInput>(
			input,
			output,
			error,
			cancellationToken
		);

		var handler = this.container.GetRequiredService<NodeShowCommandHandler>();

		return await handler.HandleAsync(context);
	}
}

public record NodeShowCommandInput(string NameOrId, string? Environment);
