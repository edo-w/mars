using Mars.Core.Lib;
using YamlDotNet.Core;
using YamlDotNet.RepresentationModel;

namespace Mars.Core.App.Config;

public class ConfigService
{
	private readonly IVfs vfs;

	public ConfigService(IVfs vfs)
	{
		this.vfs = vfs;
	}

	public async Task<ConfigLocation> FindAsync(string startDirectory)
	{
		var location = await this.TryFindAsync(startDirectory);
		if (location is null)
		{
			throw new NotFoundException("No mars.yml found. Run 'mars init' first.");
		}

		return location;
	}

	public async Task<ConfigLocation?> TryFindAsync(string startDirectory)
	{
		var fullPath = Path.GetFullPath(startDirectory);
		DirectoryInfo? directory = new(fullPath);

		while (directory is not null)
		{
			var configPath = Path.Combine(directory.FullName, "mars.yml");

			if (this.vfs.FileExists(configPath))
			{
				var config = await this.ReadAsync(configPath);
				var location = new ConfigLocation(directory.FullName, config);

				return location;
			}

			directory = directory.Parent;
		}

		return null;
	}

	public async Task<Config> InitAsync(string directory, string name, string defaultNamespace)
	{
		var fullDirectory = Path.GetFullPath(directory);
		var path = Path.Combine(fullDirectory, "mars.yml");

		if (this.vfs.FileExists(path))
		{
			var existing = await this.ReadAsync(path);

			return existing;
		}

		var config = new Config(Guid.CreateVersion7(), name, defaultNamespace);
		var mapping = new YamlMappingNode
		{
			{ "mars_id", config.Id.ToString() },
			{ "name", config.Name },
			{ "namespace", config.DefaultNamespace },
		};
		var yamlDocument = new YamlDocument(mapping);
		var document = new YamlStream(yamlDocument);

		using var writer = new StringWriter();
		document.Save(writer, false);
		var yaml = writer.ToString();
		var documentEnd = $"...{writer.NewLine}";
		if (yaml.EndsWith(documentEnd, StringComparison.Ordinal))
		{
			yaml = yaml[..^documentEnd.Length];
		}

		await this.vfs.WriteTextAsync(path, yaml);

		return config;
	}

	public async Task<Config> ReadAsync(string path)
	{
		var yaml = await this.vfs.ReadTextAsync(path);
		var document = new YamlStream();
		using var reader = new StringReader(yaml);
		try
		{
			document.Load(reader);
		}
		catch (YamlException exception)
		{
			var error = new UnprocessableException("mars.yml contains invalid YAML.", exception);
			error.Data["path"] = path;

			throw error;
		}

		var hasOneDocument = document.Documents.Count == 1;

		if (!hasOneDocument)
		{
			throw new UnprocessableException("mars.yml must contain one mapping.");
		}

		var root = document.Documents[0].RootNode;

		if (root is not YamlMappingNode mapping)
		{
			throw new UnprocessableException("mars.yml must contain one mapping.");
		}

		var idText = ReadScalar(mapping, "mars_id");

		if (!Guid.TryParse(idText, out var id))
		{
			throw new UnprocessableException("mars.yml needs a valid UUIDv7 mars_id.");
		}

		var name = ReadScalar(mapping, "name");
		var defaultNamespace = ReadScalar(mapping, "namespace");
		var config = new Config(id, name, defaultNamespace);

		return config;
	}

	private static string ReadScalar(YamlMappingNode mapping, string key)
	{
		var scalarKey = new YamlScalarNode(key);
		var found = mapping.Children.TryGetValue(scalarKey, out var node);

		if (!found || node is not YamlScalarNode scalar)
		{
			throw new UnprocessableException($"mars.yml needs a scalar '{key}'.");
		}

		return scalar.Value ?? "";
	}
}
