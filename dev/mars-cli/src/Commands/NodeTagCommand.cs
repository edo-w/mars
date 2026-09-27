using System.CommandLine;

namespace Mars.Cli.Commands;

public class NodeTagCommand : Command
{
	public NodeTagCommand(IServiceProvider container, Option<string> environmentOption)
		: base("tag", "Manage node tags")
	{
		var nodeTagAddCommand = new NodeTagAddCommand(container, environmentOption);
		this.Subcommands.Add(nodeTagAddCommand);

		var nodeTagRemoveCommand = new NodeTagRemoveCommand(container, environmentOption);
		this.Subcommands.Add(nodeTagRemoveCommand);
	}
}
