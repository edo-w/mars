using Mars.Core.App.Lock;
using Mars.Core.Lib;
using Mars.Core.App.Config;
using Mars.Local.Db;

namespace Mars.Local.App.LocalLock;

public class LocalLockService : ILockService
{
	private readonly LocalLockRepo repo;
	private readonly IVTimer timer;

	public LocalLockService(LocalLockRepo repo, IVTimer timer)
	{
		this.repo = repo;
		this.timer = timer;
	}

	public Task<LockLease?> AcquireAsync(Guid environmentId, string name, string owner, TimeSpan ttl)
	{
		name = Config.ValidateName(name);
		var isOwnerEmpty = string.IsNullOrWhiteSpace(owner);
		var hasInvalidTtl = ttl <= TimeSpan.Zero;

		if (isOwnerEmpty || hasInvalidTtl)
		{
			throw new BadRequestException("A lock needs an owner and positive TTL.");
		}

		var now = this.timer.UtcNow;
		var model = new LeaseModel
		{
			Id = Guid.CreateVersion7(),
			EnvironmentId = environmentId,
			Name = name,
			Owner = owner,
			Token = Guid.CreateVersion7(),
			ExpireDate = now.Add(ttl),
		};

		var acquired = this.repo.Acquire(model, now);

		if (!acquired)
		{
			return Task.FromResult<LockLease?>(null);
		}

		var lease = ToShape(model);

		return Task.FromResult<LockLease?>(lease);
	}

	public Task<LockLease?> RenewAsync(LockLease lease, TimeSpan ttl)
	{
		if (ttl <= TimeSpan.Zero)
		{
			throw new BadRequestException("Lock TTL must be positive.");
		}

		var now = this.timer.UtcNow;
		var expireDate = now.Add(ttl);
		var model = ToModel(lease);
		var renewed = this.repo.Renew(model, expireDate, now);

		if (!renewed)
		{
			return Task.FromResult<LockLease?>(null);
		}

		var renewedLease = new LockLease(lease.EnvironmentId, lease.Name, lease.Owner, lease.Token, expireDate);

		return Task.FromResult<LockLease?>(renewedLease);
	}

	public Task<bool> ReleaseAsync(LockLease lease)
	{
		var model = ToModel(lease);
		var released = this.repo.Release(model);

		return Task.FromResult(released);
	}

	private static LockLease ToShape(LeaseModel model)
	{
		var lease = new LockLease(model.EnvironmentId, model.Name, model.Owner, model.Token, model.ExpireDate);
		return lease;
	}

	private static LeaseModel ToModel(LockLease lease)
	{
		var model = new LeaseModel
		{
			Id = Guid.Empty,
			EnvironmentId = lease.EnvironmentId,
			Name = lease.Name,
			Owner = lease.Owner,
			Token = lease.Token,
			ExpireDate = lease.ExpireDate,
		};

		return model;
	}
}
