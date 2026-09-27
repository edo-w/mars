using Mars.Core.App.Environment;
using Mars.Core.App.Kv;
using Mars.Core.Lib;

namespace Mars.Cli.Commands;

public class KvGetFileCommandHandler
{
	private readonly IEnvironmentService environments;
	private readonly IKvService kv;
	private readonly IVfs vfs;

	public KvGetFileCommandHandler(IEnvironmentService environments, IKvService kv, IVfs vfs)
	{
		this.environments = environments;
		this.kv = kv;
		this.vfs = vfs;
	}

	public async Task<int> HandleAsync(CommandContext<KvGetFileCommandInput> context)
	{
		var environment = await this.environments.ResolveAsync(context.Input.Environment);

		var entry = await this.kv.GetAsync(environment.Id, context.Input.Key, context.Input.Version);
		if (entry is null)
		{
			throw new NotFoundException($"KV key '{context.Input.Key}' not found.");
		}

		if (entry.Type != "file")
		{
			throw new UnprocessableException($"KV key '{context.Input.Key}' contains text. Use 'kv get' to read it.");
		}

		var path = Path.GetFullPath(context.Input.OutputPath);
		var created = false;
		try
		{
			await using var file = this.vfs.CreateNewFile(path, entry.IsSecret);
			created = true;
			await file.WriteAsync(entry.Value, context.CancellationToken);
		}
		catch
		{
			if (created)
			{
				this.vfs.DeleteFile(path);
			}

			throw;
		}

		await context.Output.WriteLineAsync(path);

		return 0;
	}
}
