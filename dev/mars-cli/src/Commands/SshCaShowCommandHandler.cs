using Mars.Core.App.Environment;
using Mars.Core.App.SshCa;
using Mars.Core.Lib;

namespace Mars.Cli.Commands;

public class SshCaShowCommandHandler
{
	private readonly IEnvironmentService environments;
	private readonly ISshCaService sshCa;

	public SshCaShowCommandHandler(IEnvironmentService environments, ISshCaService sshCa)
	{
		this.environments = environments;
		this.sshCa = sshCa;
	}

	public async Task<int> HandleAsync(CommandContext<SshCaShowCommandInput> context)
	{
		var environment = await this.environments.ResolveAsync(context.Input.Environment);

		var ca = await this.sshCa.GetAsync(environment.Id, context.Input.Name);
		if (ca is null)
		{
			throw new NotFoundException($"SSH CA '{context.Input.Name}' not found.");
		}

		var publicKey = ca.PublicKey.TrimEnd();

		await context.Output.WriteLineAsync(publicKey);

		return 0;
	}
}
