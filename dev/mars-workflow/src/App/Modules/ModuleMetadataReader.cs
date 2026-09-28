using System.Text.Json.Nodes;
using Mars.Workflow.App.Runtime;
using Mars.Workflow.App.Types;

namespace Mars.Workflow.App.Modules;

public class ModuleMetadataReader
{
	public WorkflowModule Read(JsonNode? output)
	{
		var root = RequireObject(output, "describe output");
		var modulePath = RequireString(root, "module");
		var outputs = new Dictionary<string, JsonNode?>(StringComparer.Ordinal)
		{
			[modulePath] = output,
		};
		var modules = this.ReadAll(outputs);

		return modules[modulePath];
	}

	public IReadOnlyDictionary<string, WorkflowModule> ReadAll(
		IReadOnlyDictionary<string, JsonNode?> outputs
	)
	{
		var moduleExports = new Dictionary<string, JsonArray>(StringComparer.Ordinal);
		var shapeDefinitions = new Dictionary<string, JsonObject>(StringComparer.Ordinal);
		var resolvedShapes = new Dictionary<string, WorkflowType>(StringComparer.Ordinal);
		var resolvingShapes = new HashSet<string>(StringComparer.Ordinal);

		CollectDefinitions(outputs, moduleExports, shapeDefinitions);

		WorkflowType ResolveShape(string reference)
		{
			if (resolvedShapes.TryGetValue(reference, out var existing))
			{
				return existing;
			}

			if (!shapeDefinitions.TryGetValue(reference, out var definition))
			{
				throw new FormatException($"Unknown shape reference '{reference}'.");
			}

			if (!resolvingShapes.Add(reference))
			{
				throw new FormatException($"Recursive shape '{reference}' is not supported.");
			}

			var fields = this.ReadFields(RequireArray(definition, "fields"), ResolveShape);
			var shape = WorkflowType.ShapeOf(reference, fields);
			resolvingShapes.Remove(reference);
			resolvedShapes.Add(reference, shape);

			return shape;
		}

		var modules = new Dictionary<string, WorkflowModule>(StringComparer.Ordinal);
		foreach (var entry in moduleExports)
		{
			var module = this.ReadModule(entry.Key, entry.Value, ResolveShape);
			modules.Add(entry.Key, module);
		}

		return modules;
	}

	private static void CollectDefinitions(
		IReadOnlyDictionary<string, JsonNode?> outputs,
		Dictionary<string, JsonArray> moduleExports,
		Dictionary<string, JsonObject> shapeDefinitions
	)
	{
		foreach (var output in outputs)
		{
			var root = RequireObject(output.Value, "describe output");
			var describedPath = RequireString(root, "module");
			if (describedPath != output.Key)
			{
				throw new FormatException(
					$"Module '{output.Key}' described itself as '{describedPath}'."
				);
			}

			var exportNodes = RequireArray(root, "exports");
			moduleExports.Add(describedPath, exportNodes);
			foreach (var exportNode in exportNodes)
			{
				var item = RequireObject(exportNode, "export");
				var kind = RequireString(item, "kind");
				if (kind != "shape")
				{
					continue;
				}

				var name = RequireString(item, "name");
				var fullName = $"{describedPath}/{name}";
				if (!shapeDefinitions.TryAdd(fullName, item))
				{
					throw new FormatException($"Duplicate shape '{fullName}'.");
				}
			}
		}
	}

	private WorkflowModule ReadModule(
		string modulePath,
		JsonArray exportNodes,
		Func<string, WorkflowType> resolveShape
	)
	{
		var exports = new List<ModuleExport>();
		foreach (var exportNode in exportNodes)
		{
			var item = RequireObject(exportNode, "export");
			var kind = RequireString(item, "kind");
			var name = RequireString(item, "name");
			ModuleExport export;
			if (kind == "shape")
			{
				var fullName = $"{modulePath}/{name}";
				var type = resolveShape(fullName);
				export = new ModuleExport(name, ModuleExportKind.Shape, output: type);
			}
			else
			{
				export = this.ReadExport(item, name, kind, resolveShape);
			}

			exports.Add(export);
		}

		var uniqueNames = new HashSet<string>(StringComparer.Ordinal);
		foreach (var item in exports)
		{
			if (!uniqueNames.Add(item.Name))
			{
				throw new FormatException(
					$"Module '{modulePath}' has duplicate export '{item.Name}'."
				);
			}
		}

		return new WorkflowModule(modulePath, exports);
	}

	private ModuleExport ReadExport(
		JsonObject item,
		string name,
		string kind,
		Func<string, WorkflowType> resolveShape
	)
	{
		if (kind == "fn" || kind == "task")
		{
			var input = this.ReadType(item["input"], resolveShape, true);
			var output = this.ReadType(item["output"], resolveShape, true);
			var exportKind = kind == "fn" ? ModuleExportKind.Function : ModuleExportKind.Task;

			return new ModuleExport(name, exportKind, input, output);
		}

		if (kind == "workflow")
		{
			var source = RequireString(item, "source");

			return new ModuleExport(name, ModuleExportKind.Workflow, source: source);
		}

		if (kind == "const" || kind == "value")
		{
			var type = this.ReadType(item["type"], resolveShape, false);
			var validator = new WorkflowValueValidator();
			var value = validator.Validate(type, item["value"], $"{name} value");
			var exportKind = kind == "const" ? ModuleExportKind.Constant : ModuleExportKind.Value;

			return new ModuleExport(name, exportKind, output: type, value: value);
		}

		throw new FormatException($"Unknown export kind '{kind}'.");
	}

	private List<WorkflowField> ReadFields(
		JsonArray nodes,
		Func<string, WorkflowType> resolveShape
	)
	{
		var fields = new List<WorkflowField>();
		var names = new HashSet<string>(StringComparer.Ordinal);
		foreach (var node in nodes)
		{
			var item = RequireObject(node, "field");
			var name = RequireString(item, "name");
			if (!names.Add(name))
			{
				throw new FormatException($"Duplicate field '{name}'.");
			}

			var type = this.ReadType(item["type"], resolveShape, false);
			Mars.Workflow.App.Language.ExpressionSyntax? defaultValue = null;
			if (item.ContainsKey("default"))
			{
				var validator = new WorkflowValueValidator();
				var validated = validator.Validate(type, item["default"], $"{name} default");
				defaultValue = new Mars.Workflow.App.Language.LiteralSyntax(validated, default);
			}
			fields.Add(new WorkflowField(name, type, defaultValue));
		}

		return fields;
	}

	private WorkflowType ReadType(
		JsonNode? node,
		Func<string, WorkflowType> resolveShape,
		bool allowVoid
	)
	{
		if (node is JsonValue value && value.TryGetValue<string>(out var name))
		{
			var primitive = WorkflowType.Primitive(name);
			if (primitive is null)
			{
				throw new FormatException($"Unknown type '{name}'.");
			}

			if (primitive.Kind == WorkflowTypeKind.Void && !allowVoid)
			{
				throw new FormatException("void is only valid for callable input or output.");
			}

			return primitive;
		}

		var descriptor = RequireObject(node, "type descriptor");
		if (descriptor.TryGetPropertyValue("ref", out var referenceNode))
		{
			var reference = referenceNode?.GetValue<string>();
			if (reference is null)
			{
				throw new FormatException("Shape reference must be a string.");
			}

			return resolveShape(reference);
		}

		if (descriptor.TryGetPropertyValue("list", out var listNode))
		{
			var element = this.ReadType(listNode, resolveShape, false);

			return WorkflowType.ListOf(element);
		}

		if (descriptor.TryGetPropertyValue("optional", out var optionalNode))
		{
			var element = this.ReadType(optionalNode, resolveShape, false);

			return WorkflowType.OptionalOf(element);
		}

		if (descriptor.TryGetPropertyValue("shape", out var shapeNode))
		{
			var fields = this.ReadFields(RequireArray(shapeNode, "inline shape"), resolveShape);

			return WorkflowType.ShapeOf(null, fields);
		}

		throw new FormatException("Unknown type descriptor.");
	}

	private static JsonObject RequireObject(JsonNode? node, string name)
	{
		if (node is not JsonObject result)
		{
			throw new FormatException($"Expected {name} object.");
		}

		return result;
	}

	private static JsonArray RequireArray(JsonObject source, string name)
	{
		return RequireArray(source[name], name);
	}

	private static JsonArray RequireArray(JsonNode? node, string name)
	{
		if (node is not JsonArray result)
		{
			throw new FormatException($"Expected {name} array.");
		}

		return result;
	}

	private static string RequireString(JsonObject source, string name)
	{
		var node = source[name];
		if (node is not JsonValue value || !value.TryGetValue<string>(out var result))
		{
			throw new FormatException($"Expected {name} string.");
		}

		return result;
	}
}
