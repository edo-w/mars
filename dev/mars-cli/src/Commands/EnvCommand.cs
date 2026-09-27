using System.CommandLine;

namespace Mars.Cli.Commands;

public class EnvCommand : Command
{
	public EnvCommand(IServiceProvider container, Option<string> environmentOption)
		: base("env", "Manage app environments")
	{
		var envCreateCommand = new EnvCreateCommand(container);
		this.Subcommands.Add(envCreateCommand);

		var envListCommand = new EnvListCommand(container);
		this.Subcommands.Add(envListCommand);

		var envShowCommand = new EnvShowCommand(container, environmentOption);
		this.Subcommands.Add(envShowCommand);

		var envSelectCommand = new EnvSelectCommand(container);
		this.Subcommands.Add(envSelectCommand);

		var envDeleteCommand = new EnvDeleteCommand(container);
		this.Subcommands.Add(envDeleteCommand);

		var envPropertyCommand = new EnvPropertyCommand(container);
		this.Subcommands.Add(envPropertyCommand);
	}
}
