using System.CommandLine;

namespace Mars.Cli.Commands;

public class WfCommand : Command
{
	public WfCommand(IServiceProvider container)
		: base("wf", "Compile, inspect, and run Mars workflows")
	{
		this.Subcommands.Add(new WfRunCommand(container));
		this.Subcommands.Add(new WfListCommand(container));
		this.Subcommands.Add(new WfLogsCommand(container));
		this.Subcommands.Add(new WfCheckCommand(container));
		this.Subcommands.Add(new WfGraphCommand(container));
	}
}
