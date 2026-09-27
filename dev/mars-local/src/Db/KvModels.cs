namespace Mars.Local.Db;

public class KvModel
{
	public Guid Id { get; set; }
	public Guid EnvironmentId { get; set; }
	public string KeyPath { get; set; } = "";
	public int Version { get; set; }
	public string Type { get; set; } = "";
	public bool IsSecret { get; set; }
	public byte[]? Value { get; set; }
	public long Size { get; set; }
	public byte[]? Nonce { get; set; }
	public byte[]? Tag { get; set; }
	public string CreateDate { get; set; } = "";
}

public class KvSummaryViewModel
{
	public Guid Id { get; set; }
	public string KeyPath { get; set; } = "";
	public int Version { get; set; }
	public string Type { get; set; } = "";
	public bool IsSecret { get; set; }
	public long Size { get; set; }
	public string CreateDate { get; set; } = "";
	public string UpdateDate { get; set; } = "";
}
