using System.CommandLine;

namespace Mars.Cli.Commands;

public class KvCommand : Command
{
	public KvCommand(IServiceProvider container, Option<string> environmentOption)
		: base("kv", "Manage environment key values")
	{
		var kvSetCommand = new KvSetCommand(container, environmentOption);
		this.Subcommands.Add(kvSetCommand);

		var kvGetCommand = new KvGetCommand(container, environmentOption);
		this.Subcommands.Add(kvGetCommand);

		var kvShowCommand = new KvShowCommand(container, environmentOption);
		this.Subcommands.Add(kvShowCommand);

		var kvGetFileCommand = new KvGetFileCommand(container, environmentOption);
		this.Subcommands.Add(kvGetFileCommand);

		var kvListCommand = new KvListCommand(container, environmentOption);
		this.Subcommands.Add(kvListCommand);

		var kvRemoveCommand = new KvRemoveCommand(container, environmentOption);
		this.Subcommands.Add(kvRemoveCommand);
	}
}
