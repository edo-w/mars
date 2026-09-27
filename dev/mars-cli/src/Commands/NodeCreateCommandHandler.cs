using Mars.Core.App.Environment;
using Mars.Core.App.Node;

namespace Mars.Cli.Commands;

public class NodeCreateCommandHandler
{
	private readonly IEnvironmentService environments;
	private readonly INodeService nodes;

	public NodeCreateCommandHandler(IEnvironmentService environments, INodeService nodes)
	{
		this.environments = environments;
		this.nodes = nodes;
	}

	public async Task<int> HandleAsync(CommandContext<NodeCreateCommandInput> context)
	{
		var environment = await this.environments.ResolveAsync(context.Input.Environment);

		var node = await this.nodes.CreateAsync(environment.Id, context.Input.Name, context.Input.PublicIp);

		await context.Output.WriteLineAsync($"{node.Id} {node.Name}");

		return 0;
	}
}
