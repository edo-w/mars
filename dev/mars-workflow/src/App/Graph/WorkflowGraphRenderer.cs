using System.Globalization;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace Mars.Workflow.App.Graph;

public class WorkflowGraphRenderer
{
	public static string ToJson(WorkflowGraph graph)
	{
		var root = CreateJson(graph);
		var options = new JsonSerializerOptions
		{
			WriteIndented = true,
		};
		var result = root.ToJsonString(options);

		return result;
	}

	public static string ToDot(WorkflowGraph graph)
	{
		var text = new StringBuilder();
		text.AppendLine("digraph workflow {");
		text.AppendLine("  rankdir=LR;");

		foreach (var node in graph.Nodes)
		{
			var id = Escape(node.Id);
			var label = Escape(node.Label);
			var shape = node.Kind == "if" ? "diamond" : "box";
			text.AppendLine(
				CultureInfo.InvariantCulture,
				$"  \"{id}\" [label=\"{label}\", shape={shape}];"
			);
		}

		foreach (var edge in graph.Edges)
		{
			var from = Escape(edge.From);
			var to = Escape(edge.To);
			var color = edge.Kind == "data" ? "blue" : "black";
			text.AppendLine(
				CultureInfo.InvariantCulture,
				$"  \"{from}\" -> \"{to}\" [color={color}];"
			);
		}

		text.AppendLine("}");
		var result = text.ToString();

		return result;
	}

	private static JsonObject CreateJson(WorkflowGraph graph)
	{
		var nodes = new JsonArray();
		foreach (var node in graph.Nodes)
		{
			var span = new JsonObject
			{
				["path"] = node.Span.Path,
				["line"] = node.Span.Line,
				["column"] = node.Span.Column,
			};
			var item = new JsonObject
			{
				["id"] = node.Id,
				["kind"] = node.Kind,
				["label"] = node.Label,
				["target"] = node.Target,
				["source"] = span,
			};
			nodes.Add((JsonNode)item);
		}

		var edges = new JsonArray();
		foreach (var edge in graph.Edges)
		{
			var item = new JsonObject
			{
				["from"] = edge.From,
				["to"] = edge.To,
				["kind"] = edge.Kind,
				["label"] = edge.Label,
				["type"] = edge.Type,
			};
			edges.Add((JsonNode)item);
		}

		var calls = new JsonObject();
		foreach (var call in graph.Calls)
		{
			calls[call.Key] = CreateJson(call.Value);
		}

		var root = new JsonObject
		{
			["source_path"] = graph.SourcePath,
			["nodes"] = nodes,
			["edges"] = edges,
			["calls"] = calls,
		};

		return root;
	}

	private static string Escape(string value)
	{
		var escaped = value.Replace("\\", "\\\\", StringComparison.Ordinal);
		escaped = escaped.Replace("\"", "\\\"", StringComparison.Ordinal);

		return escaped;
	}
}
