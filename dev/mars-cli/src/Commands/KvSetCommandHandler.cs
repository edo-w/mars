using System.Text;
using Mars.Core.App.Environment;
using Mars.Core.App.Kv;
using Mars.Core.Lib;

namespace Mars.Cli.Commands;

public class KvSetCommandHandler
{
	private readonly IEnvironmentService environments;
	private readonly IKvService kv;
	private readonly IVfs vfs;
	private readonly IVProcess process;

	public KvSetCommandHandler(
		IEnvironmentService environments,
		IKvService kv,
		IVfs vfs,
		IVProcess process
	)
	{
		this.environments = environments;
		this.kv = kv;
		this.vfs = vfs;
		this.process = process;
	}

	public async Task<int> HandleAsync(CommandContext<KvSetCommandInput> context)
	{
		var hasValue = context.Input.Value is not null;
		var hasFile = context.Input.FilePath is not null;
		var hasInput = context.Input.InputFromStdin;
		var sourceCount = 0;

		if (hasValue)
		{
			sourceCount++;
		}

		if (hasFile)
		{
			sourceCount++;
		}

		if (hasInput)
		{
			sourceCount++;
		}

		if (sourceCount != 1)
		{
			throw new BadRequestException("Set requires exactly one of --value, --file, or --input.");
		}

		var environment = await this.environments.ResolveAsync(context.Input.Environment);

		byte[] bytes;
		string type;
		if (context.Input.Value is not null)
		{
			bytes = Encoding.UTF8.GetBytes(context.Input.Value);
			type = "text";
		}
		else if (context.Input.FilePath is not null)
		{
			var path = Path.GetFullPath(context.Input.FilePath);
			bytes = await this.vfs.ReadBytesAsync(path, context.CancellationToken);
			type = "file";
		}
		else
		{
			using var stdin = this.process.OpenStandardInput();
			using var buffer = new MemoryStream();
			await stdin.CopyToAsync(buffer, context.CancellationToken);
			bytes = buffer.ToArray();
			type = "text";
		}

		var entry = await this.kv.SetAsync(environment.Id, context.Input.Key, bytes, type, context.Input.Secret);

		await context.Output.WriteLineAsync($"{entry.Key} v{entry.Version}");

		return 0;
	}
}
