using Mars.Core.App.Environment;
using Mars.Core.App.Lock;
using Mars.Core.Lib;

namespace Mars.Cli.Commands;

public class LockAcquireCommandHandler
{
	private readonly IEnvironmentService environments;
	private readonly ILockService locks;

	public LockAcquireCommandHandler(IEnvironmentService environments, ILockService locks)
	{
		this.environments = environments;
		this.locks = locks;
	}

	public async Task<int> HandleAsync(CommandContext<LockAcquireCommandInput> context)
	{
		var environment = await this.environments.ResolveAsync(context.Input.Environment);

		var seconds = context.Input.Seconds == 0 ? 60 : context.Input.Seconds;
		var duration = TimeSpan.FromSeconds(seconds);
		var lease = await this.locks.AcquireAsync(
			environment.Id,
			context.Input.Name,
			context.Input.Owner,
			duration
		);
		if (lease is null)
		{
			throw new ConflictException($"Lock '{context.Input.Name}' is held by another owner.");
		}

		await context.Output.WriteLineAsync($"{lease.Token} {lease.ExpireDate:O}");

		return 0;
	}
}
