using Mars.Core.App.Environment;
using Mars.Core.App.Node;

namespace Mars.Cli.Commands;

public class NodeTagRemoveCommandHandler
{
	private readonly IEnvironmentService environments;
	private readonly INodeService nodes;

	public NodeTagRemoveCommandHandler(IEnvironmentService environments, INodeService nodes)
	{
		this.environments = environments;
		this.nodes = nodes;
	}

	public async Task<int> HandleAsync(CommandContext<NodeTagRemoveCommandInput> context)
	{
		var environment = await this.environments.ResolveAsync(context.Input.Environment);
		var node = await this.nodes.ResolveAsync(environment.Id, context.Input.NameOrId);

		await this.nodes.RemoveTagAsync(environment.Id, node.Id, context.Input.Tag);

		return 0;
	}
}
