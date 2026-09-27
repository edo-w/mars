using System.CommandLine;
using Mars.Cli.Commands;

namespace Mars.Cli.Boot;

public static class CliCommands
{
	public static RootCommand Create(IServiceProvider container)
	{
		var root = new RootCommand("Mars developer automation");
		var environment = new Option<string>("--env")
		{
			Recursive = true,
			Description = "Use namespace/name for this command instead of the selected environment",
		};
		var debug = new Option<bool>("--debug")
		{
			Recursive = true,
			Description = "Print full exception details when a command fails",
		};

		root.Options.Add(environment);
		root.Options.Add(debug);
		var initCommand = new InitCommand(container);
		root.Subcommands.Add(initCommand);
		var pathCommand = new PathCommand(container);
		root.Subcommands.Add(pathCommand);

		var envCommand = new EnvCommand(container, environment);
		root.Subcommands.Add(envCommand);

		var kvCommand = new KvCommand(container, environment);
		root.Subcommands.Add(kvCommand);

		var sshCaCommand = new SshCaCommand(container, environment);
		root.Subcommands.Add(sshCaCommand);

		var nodeCommand = new NodeCommand(container, environment);
		root.Subcommands.Add(nodeCommand);

		var lockCommand = new LockCommand(container, environment);
		root.Subcommands.Add(lockCommand);

		return root;
	}
}
