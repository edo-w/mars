using System.CommandLine;

namespace Mars.Cli.Commands;

public class NodeCommand : Command
{
	public NodeCommand(IServiceProvider container, Option<string> environmentOption)
		: base("node", "Manage node inventory")
	{
		var nodeCreateCommand = new NodeCreateCommand(container, environmentOption);
		this.Subcommands.Add(nodeCreateCommand);

		var nodeListCommand = new NodeListCommand(container, environmentOption);
		this.Subcommands.Add(nodeListCommand);

		var nodeShowCommand = new NodeShowCommand(container, environmentOption);
		this.Subcommands.Add(nodeShowCommand);

		var nodeRemoveCommand = new NodeRemoveCommand(container, environmentOption);
		this.Subcommands.Add(nodeRemoveCommand);

		var nodeStatusCommand = new NodeStatusCommand(container, environmentOption);
		this.Subcommands.Add(nodeStatusCommand);

		var nodePropertyCommand = new NodePropertyCommand(container, environmentOption);
		this.Subcommands.Add(nodePropertyCommand);

		var nodeTagCommand = new NodeTagCommand(container, environmentOption);
		this.Subcommands.Add(nodeTagCommand);

		var nodeEventCommand = new NodeEventCommand(container, environmentOption);
		this.Subcommands.Add(nodeEventCommand);
	}
}
