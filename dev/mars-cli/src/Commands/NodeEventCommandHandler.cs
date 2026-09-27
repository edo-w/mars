using Mars.Cli.Lib;
using Mars.Core.App.Environment;
using Mars.Core.App.Node;

namespace Mars.Cli.Commands;

public class NodeEventCommandHandler
{
	private readonly IEnvironmentService environments;
	private readonly INodeService nodes;

	public NodeEventCommandHandler(IEnvironmentService environments, INodeService nodes)
	{
		this.environments = environments;
		this.nodes = nodes;
	}

	public async Task<int> HandleAsync(CommandContext<NodeEventCommandInput> context)
	{
		var environment = await this.environments.ResolveAsync(context.Input.Environment);

		var events = await this.nodes.ListEventsAsync(environment.Id, context.Input.NodeId);
		var table = new CliTable();

		foreach (var nodeEvent in events)
		{
			var id = nodeEvent.Id.ToString();
			var nodeId = nodeEvent.NodeId.ToString();
			table.AddRow(id, nodeId, nodeEvent.Action, nodeEvent.Context);
		}

		await table.WriteAsync(context.Output);

		return 0;
	}
}
