using Mars.Core.App.Environment;
using Mars.Core.App.Node;

namespace Mars.Cli.Commands;

public class NodePropertySetCommandHandler
{
	private readonly IEnvironmentService environments;
	private readonly INodeService nodes;

	public NodePropertySetCommandHandler(IEnvironmentService environments, INodeService nodes)
	{
		this.environments = environments;
		this.nodes = nodes;
	}

	public async Task<int> HandleAsync(CommandContext<NodePropertySetCommandInput> context)
	{
		var environment = await this.environments.ResolveAsync(context.Input.Environment);
		var node = await this.nodes.ResolveAsync(environment.Id, context.Input.NameOrId);

		await this.nodes.SetPropertyAsync(
			environment.Id,
			node.Id,
			context.Input.Key,
			context.Input.Value
		);

		return 0;
	}
}
