using System.CommandLine;

namespace Mars.Cli.Commands;

public class LockCommand : Command
{
	public LockCommand(IServiceProvider container, Option<string> environmentOption)
		: base("lock", "Manage environment leases")
	{
		var lockAcquireCommand = new LockAcquireCommand(container, environmentOption);
		this.Subcommands.Add(lockAcquireCommand);

		var lockRenewCommand = new LockRenewCommand(container, environmentOption);
		this.Subcommands.Add(lockRenewCommand);

		var lockReleaseCommand = new LockReleaseCommand(container, environmentOption);
		this.Subcommands.Add(lockReleaseCommand);
	}
}
