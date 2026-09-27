using Mars.Cli.Lib;
using Mars.Core.App.Environment;
using Mars.Core.App.Node;

namespace Mars.Cli.Commands;

public class NodeListCommandHandler
{
	private readonly IEnvironmentService environments;
	private readonly INodeService nodes;

	public NodeListCommandHandler(IEnvironmentService environments, INodeService nodes)
	{
		this.environments = environments;
		this.nodes = nodes;
	}

	public async Task<int> HandleAsync(CommandContext<NodeListCommandInput> context)
	{
		var environment = await this.environments.ResolveAsync(context.Input.Environment);

		string[]? tags = null;
		if (context.Input.Tag is not null)
		{
			tags = context.Input.Tag.Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);
		}

		var nodes = await this.nodes.ListAsync(environment.Id, tags);
		var table = new CliTable();

		foreach (var node in nodes)
		{
			var nodeTags = string.Join(',', node.Tags);
			var id = node.Id.ToString();
			var hostname = node.Hostname ?? "";
			var publicIp = node.PublicIp ?? "";
			var privateIp = node.PrivateIp ?? "";
			table.AddRow(id, node.Name, hostname, publicIp, privateIp, node.Status, nodeTags);
		}

		await table.WriteAsync(context.Output);

		return 0;
	}
}
