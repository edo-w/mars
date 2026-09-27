using System.Globalization;
using System.Net;
using System.Net.Sockets;
using System.Text.Json;
using System.Text.RegularExpressions;
using Mars.Core.App.Config;
using Mars.Core.App.Node;
using Mars.Core.Lib;
using Mars.Local.Db;
using Mars.Local.Lib;

namespace Mars.Local.App.LocalNode;

public class LocalNodeService : INodeService
{
	private static readonly Regex PropertyPattern = new(
		"^[a-z0-9_-]+(?:\\.[a-z0-9_-]+)*$",
		RegexOptions.Compiled | RegexOptions.CultureInvariant
	);
	private static readonly Regex TagPattern = new(
		"^[a-z0-9_-]+$",
		RegexOptions.Compiled | RegexOptions.CultureInvariant
	);
	private static readonly Regex NumberPattern = new(
		"^-?[0-9]+(?:\\.[0-9]+)?$",
		RegexOptions.Compiled | RegexOptions.CultureInvariant
	);
	private readonly LocalNodeRepo repo;
	private readonly IVTimer timer;

	public LocalNodeService(LocalNodeRepo repo, IVTimer timer)
	{
		this.repo = repo;
		this.timer = timer;
	}

	public Task<Node> CreateAsync(Guid environmentId, string name, string? publicIp = null)
	{
		var validatedName = Config.ValidateName(name);
		if (publicIp is not null)
		{
			var parsed = IPAddress.TryParse(publicIp, out var address);
			var isIpv4 = parsed && address?.AddressFamily == AddressFamily.InterNetwork;
			if (!isIpv4)
			{
				throw new BadRequestException($"Node public IP '{publicIp}' must be IPv4.");
			}
		}

		var now = this.timer.UtcNow;
		var model = new NodeModel
		{
			Id = Guid.CreateVersion7(),
			EnvironmentId = environmentId,
			Name = validatedName,
			PublicIp = publicIp,
			Status = "new",
			CreateDate = now.ToString("O"),
			UpdateDate = now.ToString("O"),
		};
		var eventValues = new Dictionary<string, string>
		{
			["id"] = model.Id.ToString(),
			["name"] = validatedName,
			["public_ip"] = publicIp ?? "",
		};
		var context = Context(eventValues);

		this.repo.Create(model, context);

		var properties = new Dictionary<string, JsonElement>();
		var node = new Node(model.Id, validatedName, publicIp, null, null,
			model.Status, now, now, properties, []);

		return Task.FromResult(node);
	}

	public Task<Node?> GetAsync(Guid environmentId, Guid nodeId)
	{
		var detail = this.repo.Get(environmentId, nodeId);
		if (detail is null)
		{
			return Task.FromResult<Node?>(null);
		}

		var node = ToShape(detail);

		return Task.FromResult<Node?>(node);
	}

	public Task<Node> ResolveAsync(Guid environmentId, string nameOrId)
	{
		NodeDetailViewModel? detail;
		var isId = Guid.TryParse(nameOrId, out var nodeId);
		if (isId)
		{
			detail = this.repo.Get(environmentId, nodeId);
		}
		else
		{
			var validatedName = Config.ValidateName(nameOrId);
			detail = this.repo.GetByName(environmentId, validatedName);
		}

		if (detail is null)
		{
			throw new NotFoundException($"Node '{nameOrId}' not found in this environment.");
		}

		var node = ToShape(detail);

		return Task.FromResult(node);
	}

	public Task<IReadOnlyList<Node>> ListAsync(Guid environmentId, IReadOnlyList<string>? tags = null)
	{
		var normalizedTags = new List<string>();
		if (tags is not null)
		{
			foreach (var tag in tags)
			{
				var normalized = NormalizeTag(tag);
				if (!normalizedTags.Contains(normalized, StringComparer.Ordinal))
				{
					normalizedTags.Add(normalized);
				}
			}
		}

		var details = this.repo.List(environmentId, normalizedTags);
		var nodes = new List<Node>(details.Count);
		foreach (var detail in details)
		{
			var node = ToShape(detail);
			nodes.Add(node);
		}

		return Task.FromResult<IReadOnlyList<Node>>(nodes);
	}

	public Task DeleteAsync(Guid environmentId, Guid nodeId)
	{
		var detail = this.repo.Get(environmentId, nodeId);
		if (detail is null)
		{
			throw new NotFoundException($"Node '{nodeId}' not found.");
		}

		var eventValues = new Dictionary<string, string>
		{
			["id"] = nodeId.ToString(),
			["name"] = detail.Node.Name,
			["public_ip"] = detail.Node.PublicIp ?? "",
		};
		var context = Context(eventValues);

		this.repo.Delete(environmentId, nodeId, context);

		return Task.CompletedTask;
	}

	public Task SetStatusAsync(Guid environmentId, Guid nodeId, string status)
	{
		var allowed = status is "new" or "bootstrap" or "ready" or "fail";
		if (!allowed)
		{
			throw new BadRequestException($"Node status '{status}' must be new, bootstrap, ready, or fail.");
		}

		var current = this.repo.Get(environmentId, nodeId);
		if (current is null)
		{
			throw new NotFoundException($"Node '{nodeId}' not found.");
		}

		var eventValues = new Dictionary<string, string>
		{
			["prev"] = current.Node.Status,
			["new"] = status,
		};
		var context = Context(eventValues);

		this.repo.SetStatus(environmentId, nodeId, status, context);

		return Task.CompletedTask;
	}

	public Task SetPropertyAsync(Guid environmentId, Guid nodeId, string key, string value)
	{
		ValidateProperty(key);
		EnsureMutableProperty(key);

		var propertyValue = ParseValue(value);
		var context = PropertyContext(key, propertyValue);

		var model = new NodePropertyModel
		{
			NodeId = nodeId,
			Key = key,
			ValueJson = propertyValue.GetRawText(),
		};

		this.repo.SetProperty(environmentId, model, context);

		return Task.CompletedTask;
	}

	public Task<JsonElement?> GetPropertyAsync(Guid environmentId, Guid nodeId, string key)
	{
		ValidateProperty(key);

		var detail = this.repo.Get(environmentId, nodeId);
		if (detail is null)
		{
			throw new NotFoundException($"Node '{nodeId}' not found.");
		}

		var isBuiltIn = IsBuiltInProperty(key);
		if (isBuiltIn)
		{
			string? builtInValue = key switch
			{
				"id" => detail.Node.Id.ToString(),
				"name" => detail.Node.Name,
				"status" => detail.Node.Status,
				"hostname" => detail.Node.Hostname,
				"private_ip" => detail.Node.PrivateIp,
				"public_ip" => detail.Node.PublicIp,
				_ => throw new AppException($"Unknown built-in node property '{key}'."),
			};
			JsonElement? value = StringValue(builtInValue);

			return Task.FromResult(value);
		}

		var property = detail.Properties.FirstOrDefault(item => item.Key == key);
		if (property is null)
		{
			return Task.FromResult<JsonElement?>(null);
		}

		using var document = JsonDocument.Parse(property.ValueJson);
		var parsed = document.RootElement.Clone();
		JsonElement? result = parsed;

		return Task.FromResult(result);
	}

	public Task RemovePropertyAsync(Guid environmentId, Guid nodeId, string key)
	{
		ValidateProperty(key);
		EnsureMutableProperty(key);

		using var nullDocument = JsonDocument.Parse("null");
		var context = PropertyContext(key, nullDocument.RootElement);

		this.repo.RemoveProperty(environmentId, nodeId, key, context);

		return Task.CompletedTask;
	}

	public Task AddTagAsync(Guid environmentId, Guid nodeId, string tag)
	{
		var validatedTag = NormalizeTag(tag);
		var model = new NodeTagModel
		{
			NodeId = nodeId,
			Tag = validatedTag,
		};
		var eventValues = new Dictionary<string, string> { ["tag"] = validatedTag };
		var context = Context(eventValues);

		this.repo.AddTag(environmentId, model, context);

		return Task.CompletedTask;
	}

	public Task RemoveTagAsync(Guid environmentId, Guid nodeId, string tag)
	{
		var validatedTag = NormalizeTag(tag);
		var eventValues = new Dictionary<string, string> { ["tag"] = validatedTag };
		var context = Context(eventValues);

		this.repo.RemoveTag(environmentId, nodeId, validatedTag, context);

		return Task.CompletedTask;
	}

	public Task<IReadOnlyList<NodeEvent>> ListEventsAsync(Guid environmentId, Guid? nodeId = null)
	{
		var models = this.repo.ListEvents(environmentId, nodeId);
		var events = new List<NodeEvent>(models.Count);
		foreach (var model in models)
		{
			var createDate = DateTimeOffset.Parse(model.CreateDate, CultureInfo.InvariantCulture);
			var nodeEvent = new NodeEvent(
				model.Id,
				model.NodeId,
				model.Action,
				model.ContextJson,
				createDate
			);
			events.Add(nodeEvent);
		}

		return Task.FromResult<IReadOnlyList<NodeEvent>>(events);
	}

	private static Node ToShape(NodeDetailViewModel detail)
	{
		var properties = new Dictionary<string, JsonElement>(StringComparer.Ordinal);
		foreach (var property in detail.Properties)
		{
			var isBuiltIn = IsBuiltInProperty(property.Key);
			if (isBuiltIn)
			{
				continue;
			}

			using var document = JsonDocument.Parse(property.ValueJson);
			var value = document.RootElement.Clone();
			properties.Add(property.Key, value);
		}

		var tags = new List<string>(detail.Tags.Count);
		foreach (var tag in detail.Tags)
		{
			tags.Add(tag.Tag);
		}

		var node = new Node(
			detail.Node.Id,
			detail.Node.Name,
			detail.Node.PublicIp,
			detail.Node.Hostname,
			detail.Node.PrivateIp,
			detail.Node.Status,
			DateTimeOffset.Parse(detail.Node.CreateDate, CultureInfo.InvariantCulture),
			DateTimeOffset.Parse(detail.Node.UpdateDate, CultureInfo.InvariantCulture),
			properties,
			tags
		);

		return node;
	}

	private static string Context(Dictionary<string, string> values)
	{
		var json = JsonSerializer.Serialize(values, LocalJsonContext.Default.DictionaryStringString);

		return json;
	}

	private static string PropertyContext(string key, JsonElement value)
	{
		var items = new Dictionary<string, JsonElement> { [key] = value };
		var context = new NodePropertyEventContext(items);
		var json = JsonSerializer.Serialize(context, LocalJsonContext.Default.NodePropertyEventContext);

		return json;
	}

	private static JsonElement StringValue(string? value)
	{
		var element = JsonSerializer.SerializeToElement(value, LocalJsonContext.Default.String);

		return element;
	}

	private static JsonElement ParseValue(string value)
	{
		var trimmed = value.Trim();
		var isBoolean = trimmed is "true" or "false";
		var isNumber = NumberPattern.IsMatch(trimmed);
		var validNumber = false;
		if (isNumber)
		{
			var parsed = double.TryParse(trimmed, NumberStyles.Float,
				CultureInfo.InvariantCulture, out var parsedNumber);
			if (parsed)
			{
				validNumber = double.IsFinite(parsedNumber);
			}
		}

		if (isBoolean || validNumber)
		{
			using var document = JsonDocument.Parse(trimmed);
			var parsed = document.RootElement.Clone();

			return parsed;
		}

		return StringValue(value);
	}

	private static string NormalizeTag(string tag)
	{
		var normalized = tag.ToLowerInvariant();
		if (!TagPattern.IsMatch(normalized))
		{
			throw new BadRequestException($"Invalid node tag '{tag}'.");
		}

		return normalized;
	}

	private static void ValidateProperty(string key)
	{
		if (!PropertyPattern.IsMatch(key))
		{
			throw new BadRequestException($"Invalid node property key '{key}'.");
		}
	}

	private static void EnsureMutableProperty(string key)
	{
		var isBuiltIn = IsBuiltInProperty(key);
		if (isBuiltIn)
		{
			throw new UnprocessableException($"Node property '{key}' is read-only.");
		}
	}

	private static bool IsBuiltInProperty(string key)
	{
		var isBuiltIn = key is "id" or "name" or "status" or "hostname" or "private_ip" or "public_ip";

		return isBuiltIn;
	}
}
