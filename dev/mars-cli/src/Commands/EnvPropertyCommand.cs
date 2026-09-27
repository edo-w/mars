using System.CommandLine;

namespace Mars.Cli.Commands;

public class EnvPropertyCommand : Command
{
	public EnvPropertyCommand(IServiceProvider container)
		: base("property", "Manage environment properties")
	{
		var envPropertySetCommand = new EnvPropertySetCommand(container);
		this.Subcommands.Add(envPropertySetCommand);

		var envPropertyRemoveCommand = new EnvPropertyRemoveCommand(container);
		this.Subcommands.Add(envPropertyRemoveCommand);
	}
}
