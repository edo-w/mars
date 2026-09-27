using Mars.Core.App.Environment;
using Mars.Core.App.Node;

namespace Mars.Cli.Commands;

public class NodeStatusCommandHandler
{
	private readonly IEnvironmentService environments;
	private readonly INodeService nodes;

	public NodeStatusCommandHandler(IEnvironmentService environments, INodeService nodes)
	{
		this.environments = environments;
		this.nodes = nodes;
	}

	public async Task<int> HandleAsync(CommandContext<NodeStatusCommandInput> context)
	{
		var environment = await this.environments.ResolveAsync(context.Input.Environment);
		var node = await this.nodes.ResolveAsync(environment.Id, context.Input.NameOrId);

		await this.nodes.SetStatusAsync(environment.Id, node.Id, context.Input.Status);

		return 0;
	}
}
