using Mars.Core.App.Environment;
using Mars.Core.App.Kv;
using Mars.Core.Lib;

namespace Mars.Cli.Commands;

public class KvRemoveCommandHandler
{
	private readonly IEnvironmentService environments;
	private readonly IKvService kv;

	public KvRemoveCommandHandler(IEnvironmentService environments, IKvService kv)
	{
		this.environments = environments;
		this.kv = kv;
	}

	public async Task<int> HandleAsync(CommandContext<KvRemoveCommandInput> context)
	{
		var environment = await this.environments.ResolveAsync(context.Input.Environment);

		var deleted = await this.kv.DeleteAsync(environment.Id, context.Input.Key);
		if (!deleted)
		{
			throw new NotFoundException($"KV key '{context.Input.Key}' not found.");
		}

		return 0;
	}
}
