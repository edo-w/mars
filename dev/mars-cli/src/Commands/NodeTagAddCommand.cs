using System.CommandLine;
using System.CommandLine.Parsing;
using Microsoft.Extensions.DependencyInjection;

namespace Mars.Cli.Commands;

public class NodeTagAddCommand : Command
{
	private readonly IServiceProvider container;
	private readonly Option<string> environmentOption;
	private readonly Argument<string> nameOrIdArgument;
	private readonly Argument<string> tagArgument;

	public NodeTagAddCommand(IServiceProvider container, Option<string> environmentOption)
		: base("add", "Add a node tag")
	{
		this.container = container;
		this.environmentOption = environmentOption;
		this.nameOrIdArgument = new Argument<string>("name-or-id");
		this.tagArgument = new Argument<string>("tag");

		this.Arguments.Add(this.nameOrIdArgument);
		this.Arguments.Add(this.tagArgument);

		this.SetAction(this.HandleAsync);
	}

	private async Task<int> HandleAsync(
		ParseResult parseResult,
		CancellationToken cancellationToken
	)
	{
		var nameOrId = parseResult.GetValue(this.nameOrIdArgument)!;
		var tag = parseResult.GetValue(this.tagArgument)!;
		var environment = parseResult.GetValue(this.environmentOption);

		var input = new NodeTagAddCommandInput(nameOrId, tag, environment);

		var output = parseResult.InvocationConfiguration.Output;
		var error = parseResult.InvocationConfiguration.Error;
		var context = new CommandContext<NodeTagAddCommandInput>(
			input,
			output,
			error,
			cancellationToken
		);

		var handler = this.container.GetRequiredService<NodeTagAddCommandHandler>();

		return await handler.HandleAsync(context);
	}
}

public record NodeTagAddCommandInput(string NameOrId, string Tag, string? Environment);
