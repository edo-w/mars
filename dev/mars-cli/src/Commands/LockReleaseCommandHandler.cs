using Mars.Core.App.Environment;
using Mars.Core.App.Lock;
using Mars.Core.Lib;

namespace Mars.Cli.Commands;

public class LockReleaseCommandHandler
{
	private readonly IEnvironmentService environments;
	private readonly ILockService locks;

	public LockReleaseCommandHandler(IEnvironmentService environments, ILockService locks)
	{
		this.environments = environments;
		this.locks = locks;
	}

	public async Task<int> HandleAsync(CommandContext<LockReleaseCommandInput> context)
	{
		var environment = await this.environments.ResolveAsync(context.Input.Environment);

		var lease = new LockLease(
			environment.Id,
			context.Input.Name,
			context.Input.Owner,
			context.Input.Token,
			DateTimeOffset.MinValue
		);
		var released = await this.locks.ReleaseAsync(lease);
		if (!released)
		{
			throw new ConflictException($"Lock '{context.Input.Name}' was not found or its token does not match.");
		}

		return 0;
	}
}
