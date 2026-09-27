using System.Globalization;
using Mars.Core.App.Environment;
using Mars.Core.App.SshCa;
using Mars.Core.Lib;

namespace Mars.Cli.Commands;

public class SshCaIssueCommandHandler
{
	private readonly IEnvironmentService environments;
	private readonly ISshCaService sshCa;
	private readonly IVfs vfs;
	private readonly IVProcess process;
	private readonly IVTimer timer;

	public SshCaIssueCommandHandler(
		IEnvironmentService environments,
		ISshCaService sshCa,
		IVfs vfs,
		IVProcess process,
		IVTimer timer
	)
	{
		this.environments = environments;
		this.sshCa = sshCa;
		this.vfs = vfs;
		this.process = process;
		this.timer = timer;
	}

	public async Task<int> HandleAsync(CommandContext<SshCaIssueCommandInput> context)
	{
		var environment = await this.environments.ResolveAsync(context.Input.Environment);

		var currentDirectory = this.process.CurrentDirectory;
		var outputPath = context.Input.OutputPath;
		if (outputPath is null)
		{
			var timestamp = this.timer.UtcNow.ToString("yyyyMMddHHmmss", CultureInfo.InvariantCulture);
			var fileName = $"{context.Input.Name}_{timestamp}";
			outputPath = Path.Combine(currentDirectory, fileName);
		}

		var privatePath = Path.GetFullPath(outputPath, currentDirectory);
		var certificatePath = privatePath + "-cert.pub";
		var privateKeyExists = this.vfs.FileExists(privatePath);
		var certificateExists = this.vfs.FileExists(certificatePath);
		if (privateKeyExists || certificateExists)
		{
			throw new ConflictException($"SSH identity output '{privatePath}' or '{certificatePath}' already exists.");
		}

		var issued = await this.sshCa.IssueAsync(
			environment.Id,
			context.Input.Name,
			context.Input.Identity,
			context.Input.User
		);

		var privateCreated = false;
		var certificateCreated = false;
		try
		{
			await using (var keyFile = this.vfs.CreateNewFile(privatePath, privateFile: true))
			{
				privateCreated = true;
				await using var writer = new StreamWriter(keyFile);
				await writer.WriteAsync(issued.PrivateKey);
			}

			await using (var certificateFile = this.vfs.CreateNewFile(certificatePath, privateFile: false))
			{
				certificateCreated = true;
				await using var writer = new StreamWriter(certificateFile);
				await writer.WriteAsync(issued.Certificate);
			}
		}
		catch
		{
			if (privateCreated)
			{
				this.vfs.DeleteFile(privatePath);
			}

			if (certificateCreated)
			{
				this.vfs.DeleteFile(certificatePath);
			}

			throw;
		}

		await context.Output.WriteLineAsync(privatePath);
		await context.Output.WriteLineAsync(certificatePath);

		return 0;
	}
}
