using System.CommandLine;
using System.CommandLine.Parsing;
using Microsoft.Extensions.DependencyInjection;

namespace Mars.Cli.Commands;

public class NodeStatusCommand : Command
{
	private readonly IServiceProvider container;
	private readonly Option<string> environmentOption;
	private readonly Argument<string> nameOrIdArgument;
	private readonly Argument<string> statusArgument;

	public NodeStatusCommand(IServiceProvider container, Option<string> environmentOption)
		: base("status", "Set node status")
	{
		this.container = container;
		this.environmentOption = environmentOption;
		this.nameOrIdArgument = new Argument<string>("name-or-id");
		this.statusArgument = new Argument<string>("status");
		this.Aliases.Add("set-status");

		this.Arguments.Add(this.nameOrIdArgument);
		this.Arguments.Add(this.statusArgument);

		this.SetAction(this.HandleAsync);
	}

	private async Task<int> HandleAsync(
		ParseResult parseResult,
		CancellationToken cancellationToken
	)
	{
		var nameOrId = parseResult.GetValue(this.nameOrIdArgument)!;
		var status = parseResult.GetValue(this.statusArgument)!;
		var environment = parseResult.GetValue(this.environmentOption);

		var input = new NodeStatusCommandInput(nameOrId, status, environment);

		var output = parseResult.InvocationConfiguration.Output;
		var error = parseResult.InvocationConfiguration.Error;
		var context = new CommandContext<NodeStatusCommandInput>(
			input,
			output,
			error,
			cancellationToken
		);

		var handler = this.container.GetRequiredService<NodeStatusCommandHandler>();

		return await handler.HandleAsync(context);
	}
}

public record NodeStatusCommandInput(string NameOrId, string Status, string? Environment);
