using System.CommandLine;
using System.CommandLine.Parsing;
using Microsoft.Extensions.DependencyInjection;

namespace Mars.Cli.Commands;

public class NodeTagRemoveCommand : Command
{
	private readonly IServiceProvider container;
	private readonly Option<string> environmentOption;
	private readonly Argument<string> nameOrIdArgument;
	private readonly Argument<string> tagArgument;

	public NodeTagRemoveCommand(IServiceProvider container, Option<string> environmentOption)
		: base("remove", "Remove a node tag")
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

		var input = new NodeTagRemoveCommandInput(nameOrId, tag, environment);

		var output = parseResult.InvocationConfiguration.Output;
		var error = parseResult.InvocationConfiguration.Error;
		var context = new CommandContext<NodeTagRemoveCommandInput>(
			input,
			output,
			error,
			cancellationToken
		);

		var handler = this.container.GetRequiredService<NodeTagRemoveCommandHandler>();

		return await handler.HandleAsync(context);
	}
}

public record NodeTagRemoveCommandInput(string NameOrId, string Tag, string? Environment);
