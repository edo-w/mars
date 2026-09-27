using System.Text.Json;

namespace Mars.Core.App.Node;

public class Node
{
	public Node(
		Guid id,
		string name,
		string? publicIp,
		string? hostname,
		string? privateIp,
		string status,
		DateTimeOffset createDate,
		DateTimeOffset updateDate,
		IReadOnlyDictionary<string, JsonElement> properties,
		IReadOnlyList<string> tags
	)
	{
		this.Id = id;
		this.Name = name;
		this.PublicIp = publicIp;
		this.Hostname = hostname;
		this.PrivateIp = privateIp;
		this.Status = status;
		this.CreateDate = createDate;
		this.UpdateDate = updateDate;
		this.Properties = properties;
		this.Tags = tags;
	}

	public Guid Id { get; }
	public string Name { get; }
	public string? PublicIp { get; }
	public string? Hostname { get; }
	public string? PrivateIp { get; }
	public string Status { get; }
	public DateTimeOffset CreateDate { get; }
	public DateTimeOffset UpdateDate { get; }
	public IReadOnlyDictionary<string, JsonElement> Properties { get; }
	public IReadOnlyList<string> Tags { get; }
}

public class NodeEvent
{
	public NodeEvent(Guid id, Guid nodeId, string action, string context, DateTimeOffset createDate)
	{
		this.Id = id;
		this.NodeId = nodeId;
		this.Action = action;
		this.Context = context;
		this.CreateDate = createDate;
	}

	public Guid Id { get; }
	public Guid NodeId { get; }
	public string Action { get; }
	public string Context { get; }
	public DateTimeOffset CreateDate { get; }
}
