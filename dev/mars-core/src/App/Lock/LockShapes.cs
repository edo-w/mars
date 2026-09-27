namespace Mars.Core.App.Lock;

public class LockLease
{
	public LockLease(Guid environmentId, string name, string owner, Guid token, DateTimeOffset expireDate)
	{
		this.EnvironmentId = environmentId;
		this.Name = name;
		this.Owner = owner;
		this.Token = token;
		this.ExpireDate = expireDate;
	}

	public Guid EnvironmentId { get; }
	public string Name { get; }
	public string Owner { get; }
	public Guid Token { get; }
	public DateTimeOffset ExpireDate { get; }
}
