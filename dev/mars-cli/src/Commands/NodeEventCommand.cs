using System.CommandLine;
using System.CommandLine.Parsing;
using Microsoft.Extensions.DependencyInjection;

namespace Mars.Cli.Commands;

public class NodeEventCommand : Command
{
	private readonly IServiceProvider container;
	private readonly Option<string> environmentOption;
	private readonly Option<Guid?> nodeOption;

	public NodeEventCommand(IServiceProvider container, Option<string> environmentOption)
		: base("event", "List node events")
	{
		this.container = container;
		this.environmentOption = environmentOption;
		this.nodeOption = new Option<Guid?>("--node");

		this.Options.Add(this.nodeOption);

		this.SetAction(this.HandleAsync);
	}

	private async Task<int> HandleAsync(
		ParseResult parseResult,
		CancellationToken cancellationToken
	)
	{
		var nodeId = parseResult.GetValue(this.nodeOption);
		var environment = parseResult.GetValue(this.environmentOption);

		var input = new NodeEventCommandInput(nodeId, environment);

		var output = parseResult.InvocationConfiguration.Output;
		var error = parseResult.InvocationConfiguration.Error;
		var context = new CommandContext<NodeEventCommandInput>(
			input,
			output,
			error,
			cancellationToken
		);

		var handler = this.container.GetRequiredService<NodeEventCommandHandler>();

		return await handler.HandleAsync(context);
	}
}

public record NodeEventCommandInput(Guid? NodeId, string? Environment);
