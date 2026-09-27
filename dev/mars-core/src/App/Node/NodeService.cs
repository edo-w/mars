using System.Text.Json;

namespace Mars.Core.App.Node;

public interface INodeService
{
	Task<Node> CreateAsync(Guid environmentId, string name, string? publicIp = null);
	Task<Node?> GetAsync(Guid environmentId, Guid nodeId);
	Task<Node> ResolveAsync(Guid environmentId, string nameOrId);
	Task<IReadOnlyList<Node>> ListAsync(Guid environmentId, IReadOnlyList<string>? tags = null);
	Task DeleteAsync(Guid environmentId, Guid nodeId);
	Task SetStatusAsync(Guid environmentId, Guid nodeId, string status);
	Task SetPropertyAsync(Guid environmentId, Guid nodeId, string key, string value);
	Task<JsonElement?> GetPropertyAsync(Guid environmentId, Guid nodeId, string key);
	Task RemovePropertyAsync(Guid environmentId, Guid nodeId, string key);
	Task AddTagAsync(Guid environmentId, Guid nodeId, string tag);
	Task RemoveTagAsync(Guid environmentId, Guid nodeId, string tag);
	Task<IReadOnlyList<NodeEvent>> ListEventsAsync(Guid environmentId, Guid? nodeId = null);
}
