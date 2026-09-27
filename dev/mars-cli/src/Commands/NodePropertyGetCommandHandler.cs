using System.Text.Json;
using Mars.Core.App.Environment;
using Mars.Core.App.Node;
using Mars.Core.Lib;

namespace Mars.Cli.Commands;

public class NodePropertyGetCommandHandler
{
	private readonly IEnvironmentService environments;
	private readonly INodeService nodes;

	public NodePropertyGetCommandHandler(IEnvironmentService environments, INodeService nodes)
	{
		this.environments = environments;
		this.nodes = nodes;
	}

	public async Task<int> HandleAsync(CommandContext<NodePropertyGetCommandInput> context)
	{
		var environment = await this.environments.ResolveAsync(context.Input.Environment);
		var node = await this.nodes.ResolveAsync(environment.Id, context.Input.NameOrId);
		var value = await this.nodes.GetPropertyAsync(environment.Id, node.Id, context.Input.Key);

		if (value is null)
		{
			throw new NotFoundException($"Property '{context.Input.Key}' was not found on node '{context.Input.NameOrId}'.");
		}

		string output;
		if (value.Value.ValueKind == JsonValueKind.String)
		{
			output = value.Value.GetString() ?? "";
		}
		else
		{
			output = value.Value.GetRawText();
		}

		await context.Output.WriteLineAsync(output);

		return 0;
	}
}
