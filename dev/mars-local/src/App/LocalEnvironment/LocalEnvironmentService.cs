using System.Text.Json;
using Mars.Core.App.Environment;
using Mars.Core.App.Config;
using Mars.Local.Db;
using Mars.Local.Lib;
using Mars.Core.Lib;
using Environment = Mars.Core.App.Environment.Environment;

namespace Mars.Local.App.LocalEnvironment;

public class LocalEnvironmentService : IEnvironmentService
{
	private readonly Config config;
	private readonly LocalEnvironmentRepo repo;
	private readonly LocalEnvironmentSelectionStore selection;

	public LocalEnvironmentService(
		Config config,
		LocalEnvironmentRepo repo,
		LocalEnvironmentSelectionStore selection
	)
	{
		this.config = config;
		this.repo = repo;
		this.selection = selection;
	}

	public Task<Environment> CreateAsync(string name, string? environmentNamespace = null)
	{
		var selectedNamespace = environmentNamespace ?? this.config.DefaultNamespace;
		var validatedName = Config.ValidateName(name);
		var validatedNamespace = Config.ValidateName(selectedNamespace);

		var model = new EnvironmentModel
		{
			Id = Guid.CreateVersion7(),
			Name = validatedName,
			Namespace = validatedNamespace,
		};

		this.repo.Create(model);

		var environment = ToShape(model);

		return Task.FromResult(environment);
	}

	public Task<IReadOnlyList<Environment>> ListAsync()
	{
		var models = this.repo.List();
		var environments = models.Select(ToShape).ToArray();

		return Task.FromResult<IReadOnlyList<Environment>>(environments);
	}

	public Task<Environment?> GetAsync(string fullName)
	{
		var parsedName = ParseFullName(fullName);
		var model = this.repo.Get(parsedName.Namespace, parsedName.Name);

		if (model is null)
		{
			return Task.FromResult<Environment?>(null);
		}

		var environment = ToShape(model);

		return Task.FromResult<Environment?>(environment);
	}

	public async Task<Environment> ResolveAsync(string? fullName = null)
	{
		Environment? environment;
		if (fullName is null)
		{
			environment = await this.GetSelectedAsync();
		}
		else
		{
			environment = await this.GetAsync(fullName);
		}

		if (environment is null)
		{
			var message = fullName is null
				? "No environment selected."
				: $"Environment '{fullName}' not found.";
			throw new NotFoundException(message);
		}

		return environment;
	}

	public async Task<Environment> SelectAsync(string name)
	{
		Environment environment;
		if (name.Contains('/'))
		{
			environment = await this.ResolveAsync(name);
		}
		else
		{
			var validatedName = Config.ValidateName(name);
			var matches = this.repo.GetByName(validatedName);

			if (matches.Count == 0)
			{
				throw new NotFoundException($"Environment '{name}' not found.");
			}

			if (matches.Count > 1)
			{
				var fullNames = matches.Select(model => $"{model.Namespace}/{model.Name}");
				var options = string.Join(", ", fullNames);
				var error = new ConflictException($"Environment name '{name}' matches multiple namespaces. Use namespace/name.");
				error.Data["matches"] = options;

				throw error;
			}

			environment = ToShape(matches[0]);
		}

		this.selection.Write(environment.FullName);

		return environment;
	}

	public async Task<Environment?> GetSelectedAsync()
	{
		var fullName = this.selection.Read();

		if (fullName is null)
		{
			return null;
		}

		var environment = await this.GetAsync(fullName);

		return environment;
	}

	public async Task DeleteAsync(string fullName)
	{
		var environment = await this.ResolveAsync(fullName);

		this.repo.Delete(environment.Id);
		this.selection.ClearIfSelected(environment.FullName);
	}

	public async Task SetPropertyAsync(string fullName, string key, string value)
	{
		ValidatePropertyKey(key);

		var environment = await this.ResolveAsync(fullName);

		this.repo.UpdateProperties(environment.Id, json =>
		{
			var properties = ReadProperties(json);
			properties[key] = value;
			var updatedJson = JsonSerializer.Serialize(properties, LocalJsonContext.Default.DictionaryStringString);

			return updatedJson;
		});
	}

	public async Task RemovePropertyAsync(string fullName, string key)
	{
		ValidatePropertyKey(key);

		var environment = await this.ResolveAsync(fullName);

		this.repo.UpdateProperties(environment.Id, json =>
		{
			var properties = ReadProperties(json);
			properties.Remove(key);
			var updatedJson = JsonSerializer.Serialize(properties, LocalJsonContext.Default.DictionaryStringString);

			return updatedJson;
		});
	}

	private static Environment ToShape(EnvironmentModel model)
	{
		var properties = ReadProperties(model.PropertiesJson);
		var environment = new Environment(model.Id, model.Name, model.Namespace, properties);

		return environment;
	}

	private static Dictionary<string, string> ReadProperties(string json)
	{
		var properties = JsonSerializer.Deserialize(json, LocalJsonContext.Default.DictionaryStringString);

		return properties ?? [];
	}

	private static EnvironmentName ParseFullName(string fullName)
	{
		var parts = fullName.Split('/', 2);

		if (parts.Length != 2)
		{
			var error = new BadRequestException("Environment must be written as namespace/name.");
			error.Data["environment"] = fullName;

			throw error;
		}

		var environmentNamespace = Config.ValidateName(parts[0]);
		var name = Config.ValidateName(parts[1]);
		var parsedName = new EnvironmentName(environmentNamespace, name);

		return parsedName;
	}

	private static void ValidatePropertyKey(string key)
	{
		var isEmpty = string.IsNullOrWhiteSpace(key);
		var hasValidFormat = System.Text.RegularExpressions.Regex.IsMatch(key, "^[a-z][a-z0-9_.-]*$");

		if (isEmpty || !hasValidFormat)
		{
			throw new BadRequestException($"Invalid environment property key '{key}'.");
		}
	}

}
