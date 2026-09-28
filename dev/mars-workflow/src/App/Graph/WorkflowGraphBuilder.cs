using Mars.Workflow.App.Compiler;
using Mars.Workflow.App.Language;
using Mars.Workflow.App.Types;

namespace Mars.Workflow.App.Graph;

public class WorkflowGraphBuilder
{
	public WorkflowGraph Build(CompiledWorkflow workflow)
	{
		var graph = new WorkflowGraph(workflow.Document.Path);
		var sources = new Dictionary<string, HashSet<string>>(StringComparer.Ordinal);
		var previous = new List<string>();
		this.VisitStatements(workflow, workflow.Document.Statements, graph, previous, sources);

		return graph;
	}

	private List<string> VisitStatements(
		CompiledWorkflow workflow,
		IReadOnlyList<StatementSyntax> statements,
		WorkflowGraph graph,
		List<string> previous,
		Dictionary<string, HashSet<string>> sources
	)
	{
		foreach (var statement in statements)
		{
			if (statement is LetSyntax { Step: not null } let)
			{
				previous = this.AddStep(workflow, let.Step, graph, previous, sources);
				sources[let.Name] = [previous[0]];
			}
			else if (statement is LetSyntax { Value: not null } value)
			{
				var dependencies = new HashSet<string>(StringComparer.Ordinal);
				var names = new HashSet<string>(StringComparer.Ordinal);
				CollectNames(value.Value, names);
				foreach (var name in names)
				{
					if (sources.TryGetValue(name, out var sourceIds))
					{
						dependencies.UnionWith(sourceIds);
					}
				}

				if (dependencies.Count > 0)
				{
					sources[value.Name] = dependencies;
				}
			}
			else if (statement is StepSyntax step)
			{
				previous = this.AddStep(workflow, step, graph, previous, sources);
			}
			else if (statement is IfSyntax condition)
			{
				var node = CreateNode("if", "if", null, condition.Span);
				graph.Nodes.Add(node);
				AddControlEdges(graph, previous, node.Id);
				AddDataEdges(
					condition.Condition,
					"condition",
					"bool",
					node.Id,
					graph,
					sources
				);

				var thenPrevious = new List<string> { node.Id };
				var elsePrevious = new List<string> { node.Id };
				var thenSources = new Dictionary<string, HashSet<string>>(
					sources,
					StringComparer.Ordinal
				);
				var elseSources = new Dictionary<string, HashSet<string>>(
					sources,
					StringComparer.Ordinal
				);
				var thenEnd = this.VisitStatements(workflow, condition.Then, graph, thenPrevious, thenSources);
				var elseEnd = this.VisitStatements(workflow, condition.Else, graph, elsePrevious, elseSources);
				previous = [.. thenEnd, .. elseEnd];
			}
		}

		return previous;
	}

	private List<string> AddStep(
		CompiledWorkflow workflow,
		StepSyntax step,
		WorkflowGraph graph,
		List<string> previous,
		Dictionary<string, HashSet<string>> sources
	)
	{
		var kind = step.Kind switch
		{
			StepKind.Call => "workflow_call",
			StepKind.Run => "task",
			_ => "task",
		};
		var label = step.Title ?? step.Target;
		var target = step.Target;
		var node = CreateNode(kind, label, target, step.Span);
		graph.Nodes.Add(node);
		AddControlEdges(graph, previous, node.Id);

		foreach (var input in step.Input)
		{
			var type = workflow.ExpressionTypes[input.Value];
			var typeName = FormatType(type);
			AddDataEdges(input.Value, input.Key, typeName, node.Id, graph, sources);
		}

		var bound = workflow.Steps[step];
		if (bound.Workflow is not null)
		{
			var child = this.Build(bound.Workflow);
			graph.Calls[node.Id] = child;
		}

		return [node.Id];
	}

	private static void AddDataEdges(
		ExpressionSyntax expression,
		string label,
		string type,
		string targetId,
		WorkflowGraph graph,
		Dictionary<string, HashSet<string>> sources
	)
	{
		var names = new HashSet<string>(StringComparer.Ordinal);
		var emitted = new HashSet<string>(StringComparer.Ordinal);
		CollectNames(expression, names);
		foreach (var name in names)
		{
			if (sources.TryGetValue(name, out var sourceIds))
			{
				foreach (var sourceId in sourceIds)
				{
					if (emitted.Add(sourceId))
					{
						graph.Edges.Add(new GraphEdge(sourceId, targetId, "data", label, type));
					}
				}
			}
		}
	}

	private static string FormatType(WorkflowType type)
	{
		if (type.Kind == WorkflowTypeKind.List)
		{
			var element = FormatType(type.Element!);

			return $"{element}[]";
		}

		if (type.Kind == WorkflowTypeKind.Optional)
		{
			var element = FormatType(type.Element!);

			return $"{element}?";
		}

		if (type.Kind == WorkflowTypeKind.Shape)
		{
			return type.Name ?? "shape";
		}

		return type.Kind switch
		{
			WorkflowTypeKind.Text => "string",
			WorkflowTypeKind.Bool => "bool",
			WorkflowTypeKind.I32 => "i32",
			WorkflowTypeKind.F32 => "f32",
			WorkflowTypeKind.Datetime => "datetime",
			WorkflowTypeKind.Duration => "duration",
			WorkflowTypeKind.Path => "path",
			WorkflowTypeKind.Url => "url",
			WorkflowTypeKind.Void => "void",
			_ => "unknown",
		};
	}

	private static GraphNode CreateNode(string kind, string label, string? target, SourceSpan span)
	{
		var id = $"{span.Path}:{span.Offset}:{kind}";

		return new GraphNode(id, kind, label, target, span);
	}

	private static void AddControlEdges(WorkflowGraph graph, IReadOnlyList<string> previous, string next)
	{
		foreach (var source in previous.Distinct(StringComparer.Ordinal))
		{
			graph.Edges.Add(new GraphEdge(source, next, "control"));
		}
	}

	private static void CollectNames(ExpressionSyntax expression, HashSet<string> names)
	{
		if (expression is NameSyntax name)
		{
			names.Add(name.Name);
		}
		else if (expression is MemberSyntax member)
		{
			CollectNames(member.Target, names);
		}
		else if (expression is IndexSyntax index)
		{
			CollectNames(index.Target, names);
			CollectNames(index.Index, names);
		}
		else if (expression is UnarySyntax unary)
		{
			CollectNames(unary.Operand, names);
		}
		else if (expression is BinarySyntax binary)
		{
			CollectNames(binary.Left, names);
			CollectNames(binary.Right, names);
		}
		else if (expression is CallSyntax call)
		{
			foreach (var argument in call.Arguments)
			{
				CollectNames(argument, names);
			}
		}
		else if (expression is ArraySyntax array)
		{
			foreach (var item in array.Items)
			{
				CollectNames(item, names);
			}
		}
		else if (expression is ObjectSyntax obj)
		{
			foreach (var item in obj.Fields.Values)
			{
				CollectNames(item, names);
			}
		}
		else if (expression is StringSyntax str)
		{
			foreach (var part in str.Parts)
			{
				if (part.Expression is not null)
				{
					CollectNames(part.Expression, names);
				}
			}
		}
	}
}
