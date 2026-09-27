using System.CommandLine;

namespace Mars.Cli.Commands;

public class SshCaCommand : Command
{
	public SshCaCommand(IServiceProvider container, Option<string> environmentOption)
		: base("sshca", "Manage SSH certificate authorities")
	{
		var sshCaCreateCommand = new SshCaCreateCommand(container, environmentOption);
		this.Subcommands.Add(sshCaCreateCommand);

		var sshCaListCommand = new SshCaListCommand(container, environmentOption);
		this.Subcommands.Add(sshCaListCommand);

		var sshCaShowCommand = new SshCaShowCommand(container, environmentOption);
		this.Subcommands.Add(sshCaShowCommand);

		var sshCaRemoveCommand = new SshCaRemoveCommand(container, environmentOption);
		this.Subcommands.Add(sshCaRemoveCommand);

		var sshCaIssueCommand = new SshCaIssueCommand(container, environmentOption);
		this.Subcommands.Add(sshCaIssueCommand);
	}
}
