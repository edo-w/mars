using System.Text;
using Mars.Cli.Lib;
using Mars.Core.App.Environment;
using Mars.Core.App.Kv;
using Mars.Core.Lib;

namespace Mars.Cli.Commands;

public class KvGetCommandHandler
{
	private readonly IEnvironmentService environments;
	private readonly IKvService kv;
	private readonly IBinaryOutput binaryOutput;

	public KvGetCommandHandler(
		IEnvironmentService environments,
		IKvService kv,
		IBinaryOutput binaryOutput
	)
	{
		this.environments = environments;
		this.kv = kv;
		this.binaryOutput = binaryOutput;
	}

	public async Task<int> HandleAsync(CommandContext<KvGetCommandInput> context)
	{
		var environment = await this.environments.ResolveAsync(context.Input.Environment);

		var entry = await this.kv.GetAsync(environment.Id, context.Input.Key, context.Input.Version);
		if (entry is null)
		{
			throw new NotFoundException($"KV key '{context.Input.Key}' not found.");
		}

		if (context.Input.Raw)
		{
			await this.binaryOutput.WriteAsync(entry.Value, context.CancellationToken);

			return 0;
		}

		if (entry.Type != "text")
		{
			throw new UnprocessableException($"KV key '{context.Input.Key}' contains a file value. Use the file workflow to read it.");
		}

		var value = Encoding.UTF8.GetString(entry.Value);

		await context.Output.WriteLineAsync(value);

		return 0;
	}
}
