using Mars.Core.App.Environment;
using Mars.Core.App.SshCa;

namespace Mars.Cli.Commands;

public class SshCaListCommandHandler
{
	private readonly IEnvironmentService environments;
	private readonly ISshCaService sshCa;

	public SshCaListCommandHandler(IEnvironmentService environments, ISshCaService sshCa)
	{
		this.environments = environments;
		this.sshCa = sshCa;
	}

	public async Task<int> HandleAsync(CommandContext<SshCaListCommandInput> context)
	{
		var environment = await this.environments.ResolveAsync(context.Input.Environment);

		var authorities = await this.sshCa.ListAsync(environment.Id);
		foreach (var authority in authorities)
		{
			await context.Output.WriteLineAsync(authority.Name);
		}

		return 0;
	}
}
