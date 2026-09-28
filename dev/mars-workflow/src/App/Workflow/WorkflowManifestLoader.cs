using Mars.Workflow.App.Runtime;
using YamlDotNet.RepresentationModel;

namespace Mars.Workflow.App.Workflow;

public class WorkflowManifestLoader
{
	public static WorkflowManifest? Find(string workflowPath)
	{
		var fullPath = Path.GetFullPath(workflowPath);
		var directory = new DirectoryInfo(Path.GetDirectoryName(fullPath)!);
		string? standaloneManifestPath = null;
		while (directory is not null)
		{
			var manifestPath = Path.Combine(directory.FullName, "mars-workflow.yml");
			var configPath = Path.Combine(directory.FullName, "mars.yml");
			if (File.Exists(configPath))
			{
				if (File.Exists(manifestPath))
				{
					return Read(manifestPath);
				}

				return null;
			}

			if (standaloneManifestPath is null && File.Exists(manifestPath))
			{
				standaloneManifestPath = manifestPath;
			}

			if (directory.Name.Equals(".mars", StringComparison.OrdinalIgnoreCase))
			{
				// Local state is separate from the enclosing app source tree.
				break;
			}

			directory = directory.Parent;
		}

		if (standaloneManifestPath is null)
		{
			return null;
		}

		return Read(standaloneManifestPath);
	}

	private static WorkflowManifest Read(string path)
	{
		var yaml = File.ReadAllText(path);
		var stream = new YamlStream();
		using var reader = new StringReader(yaml);
		stream.Load(reader);

		if (stream.Documents.Count != 1
			|| stream.Documents[0].RootNode is not YamlMappingNode root)
		{
			throw new WorkflowRuntimeException("mars-workflow.yml must contain one mapping.");
		}

		var version = ReadScalar(root, "version");
		if (version != "1")
		{
			throw new WorkflowRuntimeException("mars-workflow.yml requires version: 1.");
		}

		var modules = new List<WorkflowModuleEntry>();
		var paths = new HashSet<string>(StringComparer.Ordinal);
		var moduleKey = new YamlScalarNode("modules");
		root.Children.TryGetValue(moduleKey, out var moduleNode);
		if (moduleNode is null)
		{
			return new WorkflowManifest(path, modules);
		}

		if (moduleNode is not YamlSequenceNode sequence)
		{
			throw new WorkflowRuntimeException("modules must be a YAML sequence.");
		}

		foreach (var node in sequence.Children)
		{
			if (node is not YamlMappingNode mapping)
			{
				throw new WorkflowRuntimeException("Each module must be a mapping.");
			}

			var modulePath = ReadScalar(mapping, "path");
			var command = ReadScalar(mapping, "command");
			if (!paths.Add(modulePath))
			{
				throw new WorkflowRuntimeException($"Duplicate module '{modulePath}'.");
			}

			var arguments = new List<string>();
			var argsKey = new YamlScalarNode("args");
			mapping.Children.TryGetValue(argsKey, out var argsNode);
			if (argsNode is YamlSequenceNode args)
			{
				foreach (var argument in args.Children)
				{
					if (argument is not YamlScalarNode scalar || scalar.Value is null)
					{
						throw new WorkflowRuntimeException("Module args must be strings.");
					}

					arguments.Add(ResolveArgument(scalar.Value, Path.GetDirectoryName(path)!));
				}
			}
			else if (argsNode is not null)
			{
				throw new WorkflowRuntimeException("Module args must be a sequence.");
			}

			var resolvedCommand = ResolveArgument(command, Path.GetDirectoryName(path)!);
			modules.Add(new WorkflowModuleEntry(modulePath, resolvedCommand, arguments));
		}

		return new WorkflowManifest(path, modules);
	}

	private static string ResolveArgument(string value, string root)
	{
		var isRelative = value.StartsWith("./", StringComparison.Ordinal)
			|| value.StartsWith("../", StringComparison.Ordinal)
			|| value.StartsWith(".\\", StringComparison.Ordinal)
			|| value.StartsWith("..\\", StringComparison.Ordinal);
		if (isRelative)
		{
			return Path.GetFullPath(value, root);
		}

		return value;
	}

	private static string ReadScalar(YamlMappingNode mapping, string name)
	{
		var key = new YamlScalarNode(name);
		if (!mapping.Children.TryGetValue(key, out var node)
			|| node is not YamlScalarNode scalar || scalar.Value is null)
		{
			throw new WorkflowRuntimeException($"Manifest needs scalar '{name}'.");
		}

		return scalar.Value;
	}
}
