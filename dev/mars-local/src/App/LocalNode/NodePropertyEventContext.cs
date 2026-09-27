using System.Text.Json;

namespace Mars.Local.App.LocalNode;

public class NodePropertyEventContext
{
	public NodePropertyEventContext(Dictionary<string, JsonElement> items)
	{
		this.Items = items;
	}

	public Dictionary<string, JsonElement> Items { get; }
}
