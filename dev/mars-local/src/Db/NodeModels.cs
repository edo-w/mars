namespace Mars.Local.Db;

public class NodeModel
{
	public Guid Id { get; set; }
	public Guid EnvironmentId { get; set; }
	public string Name { get; set; } = "";
	public string? PublicIp { get; set; }
	public string? Hostname { get; set; }
	public string? PrivateIp { get; set; }
	public string Status { get; set; } = "";
	public string CreateDate { get; set; } = "";
	public string UpdateDate { get; set; } = "";
}

public class NodePropertyModel
{
	public Guid NodeId { get; set; }
	public string Key { get; set; } = "";
	public string ValueJson { get; set; } = "";
}

public class NodeTagModel
{
	public Guid NodeId { get; set; }
	public string Tag { get; set; } = "";
}

public class NodeEventModel
{
	public Guid Id { get; set; }
	public Guid EnvironmentId { get; set; }
	public Guid NodeId { get; set; }
	public string Action { get; set; } = "";
	public string ContextJson { get; set; } = "{}";
	public string CreateDate { get; set; } = "";
}

public class NodeDetailViewModel
{
	public NodeModel Node { get; set; } = new();
	public IReadOnlyList<NodePropertyModel> Properties { get; set; } = [];
	public IReadOnlyList<NodeTagModel> Tags { get; set; } = [];
}
