using Mars.Core.App.Environment;
using Mars.Core.App.Node;

namespace Mars.Cli.Commands;

public class NodeRemoveCommandHandler
{
	private readonly IEnvironmentService environments;
	private readonly INodeService nodes;

	public NodeRemoveCommandHandler(IEnvironmentService environments, INodeService nodes)
	{
		this.environments = environments;
		this.nodes = nodes;
	}

	public async Task<int> HandleAsync(CommandContext<NodeRemoveCommandInput> context)
	{
		var environment = await this.environments.ResolveAsync(context.Input.Environment);
		var node = await this.nodes.ResolveAsync(environment.Id, context.Input.NameOrId);

		await this.nodes.DeleteAsync(environment.Id, node.Id);

		return 0;
	}
}
