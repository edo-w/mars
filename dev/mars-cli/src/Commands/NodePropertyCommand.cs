using System.CommandLine;

namespace Mars.Cli.Commands;

public class NodePropertyCommand : Command
{
	public NodePropertyCommand(IServiceProvider container, Option<string> environmentOption)
		: base("property", "Manage node properties")
	{
		var nodePropertyGetCommand = new NodePropertyGetCommand(container, environmentOption);
		this.Subcommands.Add(nodePropertyGetCommand);

		var nodePropertySetCommand = new NodePropertySetCommand(container, environmentOption);
		this.Subcommands.Add(nodePropertySetCommand);

		var nodePropertyRemoveCommand = new NodePropertyRemoveCommand(container, environmentOption);
		this.Subcommands.Add(nodePropertyRemoveCommand);
	}
}
