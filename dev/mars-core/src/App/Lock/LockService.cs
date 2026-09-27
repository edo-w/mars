namespace Mars.Core.App.Lock;

public interface ILockService
{
	Task<LockLease?> AcquireAsync(Guid environmentId, string name, string owner, TimeSpan ttl);
	Task<LockLease?> RenewAsync(LockLease lease, TimeSpan ttl);
	Task<bool> ReleaseAsync(LockLease lease);
}
