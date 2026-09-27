using Mars.Core.App.Environment;
using Mars.Core.App.Lock;
using Mars.Core.Lib;

namespace Mars.Cli.Commands;

public class LockRenewCommandHandler
{
	private readonly IEnvironmentService environments;
	private readonly ILockService locks;

	public LockRenewCommandHandler(IEnvironmentService environments, ILockService locks)
	{
		this.environments = environments;
		this.locks = locks;
	}

	public async Task<int> HandleAsync(CommandContext<LockRenewCommandInput> context)
	{
		var environment = await this.environments.ResolveAsync(context.Input.Environment);

		var lease = new LockLease(
			environment.Id,
			context.Input.Name,
			context.Input.Owner,
			context.Input.Token,
			DateTimeOffset.MinValue
		);
		var seconds = context.Input.Seconds == 0 ? 60 : context.Input.Seconds;
		var duration = TimeSpan.FromSeconds(seconds);
		var renewed = await this.locks.RenewAsync(lease, duration);
		if (renewed is null)
		{
			throw new ConflictException($"Lock '{context.Input.Name}' could not be renewed because it expired or its token does not match.");
		}

		await context.Output.WriteLineAsync($"{renewed.Token} {renewed.ExpireDate:O}");

		return 0;
	}
}
