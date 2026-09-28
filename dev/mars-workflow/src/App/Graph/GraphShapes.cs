using Mars.Workflow.App.Language;

namespace Mars.Workflow.App.Graph;

public class WorkflowGraph
{
	public WorkflowGraph(string sourcePath)
	{
		this.SourcePath = sourcePath;
	}

	public string SourcePath { get; }
	public List<GraphNode> Nodes { get; } = [];
	public List<GraphEdge> Edges { get; } = [];
	public Dictionary<string, WorkflowGraph> Calls { get; } = new(StringComparer.Ordinal);
}

public class GraphNode
{
	public GraphNode(string id, string kind, string label, string? target, SourceSpan span)
	{
		this.Id = id;
		this.Kind = kind;
		this.Label = label;
		this.Target = target;
		this.Span = span;
	}

	public string Id { get; }
	public string Kind { get; }
	public string Label { get; }
	public string? Target { get; }
	public SourceSpan Span { get; }
}

public class GraphEdge
{
	public GraphEdge(
		string from,
		string to,
		string kind,
		string? label = null,
		string? type = null
	)
	{
		this.From = from;
		this.To = to;
		this.Kind = kind;
		this.Label = label;
		this.Type = type;
	}

	public string From { get; }
	public string To { get; }
	public string Kind { get; }
	public string? Label { get; }
	public string? Type { get; }
}
