namespace Mars.Local.Db;

public class LeaseModel
{
	public Guid Id { get; set; }
	public Guid EnvironmentId { get; set; }
	public string Name { get; set; } = "";
	public string Owner { get; set; } = "";
	public Guid Token { get; set; }
	public DateTimeOffset ExpireDate { get; set; }
}
