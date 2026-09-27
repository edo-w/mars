using System.Text;
using Mars.Core.App.Environment;
using Mars.Core.App.SshCa;
using Mars.Core.Lib;

namespace Mars.Cli.Commands;

public class SshCaRemoveCommandHandler
{
	private readonly IEnvironmentService environments;
	private readonly ISshCaService sshCa;
	private readonly IVProcess process;

	public SshCaRemoveCommandHandler(
		IEnvironmentService environments,
		ISshCaService sshCa,
		IVProcess process
	)
	{
		this.environments = environments;
		this.sshCa = sshCa;
		this.process = process;
	}

	public async Task<int> HandleAsync(CommandContext<SshCaRemoveCommandInput> context)
	{
		var environment = await this.environments.ResolveAsync(context.Input.Environment);
		var ca = await this.sshCa.GetAsync(environment.Id, context.Input.Name);
		if (ca is null)
		{
			throw new NotFoundException($"SSH CA '{context.Input.Name}' not found.");
		}

		await context.Output.WriteLineAsync($"Remove SSH CA '{ca.Name}' from {environment.FullName}?");
		await context.Output.WriteLineAsync("The CA private key, public key, and encrypted passphrase will be removed.");
		await context.Output.WriteLineAsync($"Type '{ca.Name}' to confirm:");

		var standardInput = this.process.OpenStandardInput();
		using var reader = new StreamReader(standardInput, Encoding.UTF8,
			detectEncodingFromByteOrderMarks: false, bufferSize: 1024, leaveOpen: true);
		var confirmation = await reader.ReadLineAsync(context.CancellationToken);
		if (confirmation != ca.Name)
		{
			await context.Error.WriteLineAsync("SSH CA removal cancelled: name did not match.");

			return 1;
		}

		await this.sshCa.DeleteAsync(environment.Id, context.Input.Name);

		return 0;
	}
}
