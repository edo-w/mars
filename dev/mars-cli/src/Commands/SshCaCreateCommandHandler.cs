using Mars.Core.App.Environment;
using Mars.Core.App.SshCa;

namespace Mars.Cli.Commands;

public class SshCaCreateCommandHandler
{
	private readonly IEnvironmentService environments;
	private readonly ISshCaService sshCa;

	public SshCaCreateCommandHandler(IEnvironmentService environments, ISshCaService sshCa)
	{
		this.environments = environments;
		this.sshCa = sshCa;
	}

	public async Task<int> HandleAsync(CommandContext<SshCaCreateCommandInput> context)
	{
		var environment = await this.environments.ResolveAsync(context.Input.Environment);

		var ca = await this.sshCa.CreateAsync(environment.Id, context.Input.Name);
		var publicKey = ca.PublicKey.TrimEnd();

		await context.Output.WriteLineAsync(publicKey);

		return 0;
	}
}
