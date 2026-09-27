namespace Mars.Core.App.Kv;

public static class KvLimits
{
	public const int MaxInlineValueBytes = 16 * 1024;
}

public class KvEntry
{
	public KvEntry(Guid id, string key, int version, string type, bool isSecret, byte[] value, DateTimeOffset createDate)
	{
		this.Id = id;
		this.Key = key;
		this.Version = version;
		this.Type = type;
		this.IsSecret = isSecret;
		this.Value = value;
		this.CreateDate = createDate;
	}

	public Guid Id { get; }
	public string Key { get; }
	public int Version { get; }
	public string Type { get; }
	public bool IsSecret { get; }
	public byte[] Value { get; }
	public DateTimeOffset CreateDate { get; }
}

public class KvSummary
{
	public KvSummary(
		Guid id,
		string key,
		int version,
		string type,
		bool isSecret,
		long size,
		DateTimeOffset createDate,
		DateTimeOffset updateDate
	)
	{
		this.Id = id;
		this.Key = key;
		this.Version = version;
		this.Type = type;
		this.IsSecret = isSecret;
		this.Size = size;
		this.CreateDate = createDate;
		this.UpdateDate = updateDate;
	}

	public Guid Id { get; }
	public string Key { get; }
	public int Version { get; }
	public string Type { get; }
	public bool IsSecret { get; }
	public long Size { get; }
	public DateTimeOffset CreateDate { get; }
	public DateTimeOffset UpdateDate { get; }
}
