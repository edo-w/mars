using System.Text.Json;
using Mars.Cli.Lib;
using Mars.Core.App.Environment;
using Mars.Core.App.Node;

namespace Mars.Cli.Commands;

public class NodeShowCommandHandler
{
	private readonly IEnvironmentService environments;
	private readonly INodeService nodes;

	public NodeShowCommandHandler(IEnvironmentService environments, INodeService nodes)
	{
		this.environments = environments;
		this.nodes = nodes;
	}

	public async Task<int> HandleAsync(CommandContext<NodeShowCommandInput> context)
	{
		var environment = await this.environments.ResolveAsync(context.Input.Environment);
		var node = await this.nodes.ResolveAsync(environment.Id, context.Input.NameOrId);
		var createDate = CliDateFormatter.ForShow(node.CreateDate);
		var updateDate = CliDateFormatter.ForShow(node.UpdateDate);
		var tags = string.Join(",", node.Tags);
		var table = new CliTable();
		table.AddRow("node_id:", node.Id.ToString());
		table.AddRow("name:", node.Name);
		table.AddRow("status:", node.Status);
		table.AddRow("tags:", tags);
		table.AddRow("hostname:", node.Hostname ?? "");
		table.AddRow("public_ip:", node.PublicIp ?? "");
		table.AddRow("private_ip:", node.PrivateIp ?? "");
		table.AddRow("create_date:", createDate);
		table.AddRow("update_date:", updateDate);

		foreach (var property in node.Properties)
		{
			string value;
			if (property.Value.ValueKind == JsonValueKind.String)
			{
				value = property.Value.GetString() ?? "";
			}
			else
			{
				value = property.Value.GetRawText();
			}

			var label = $"{property.Key}:";
			table.AddRow(label, value);
		}

		await table.WriteAsync(context.Output);

		return 0;
	}
}
