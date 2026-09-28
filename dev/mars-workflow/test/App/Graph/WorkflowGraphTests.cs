using Mars.Workflow.App.Compiler;
using Mars.Workflow.App.Graph;
using Mars.Workflow.App.Modules;
using NUnit.Framework;
using Assert = NUnit.Framework.Legacy.ClassicAssert;

namespace Mars.Workflow.Tests.App.Graph;

public class WorkflowGraphTests
{
	[Test]
	public async Task GraphContainsBranchAndControlEdgesWithoutRunningTasks()
	{
		var source = """
			workflow { input { enabled bool } }
			run 'echo start'
			if enabled {
				run 'echo enabled'
			}
			run 'echo finish'
			""";
		var compiler = new WorkflowCompiler(new SourceReader(source), new ModuleCatalog());
		var compilation = await compiler.CompileAsync("graph.mars");
		var builder = new WorkflowGraphBuilder();

		Assert.IsTrue(compilation.IsValid);
		var graph = builder.Build(compilation.Root!);
		var dot = WorkflowGraphRenderer.ToDot(graph);
		var json = WorkflowGraphRenderer.ToJson(graph);

		Assert.AreEqual(4, graph.Nodes.Count);
		Assert.AreEqual(4, graph.Edges.Count(item => item.Kind == "control"));
		Assert.IsTrue(dot.Contains("digraph workflow", StringComparison.Ordinal));
		Assert.IsTrue(json.Contains("\"kind\": \"if\"", StringComparison.Ordinal));
	}

	[Test]
	public async Task GraphTracksDataThroughDerivedLocal()
	{
		var source = """
			workflow {}
			let first = run 'echo first'
			let alias = first.exit_code
			run 'echo {alias}'
			""";
		var compiler = new WorkflowCompiler(new SourceReader(source), new ModuleCatalog());
		var compilation = await compiler.CompileAsync("graph.mars");
		var builder = new WorkflowGraphBuilder();

		Assert.IsTrue(compilation.IsValid);
		var graph = builder.Build(compilation.Root!);
		var dependency = graph.Edges.Single(item => item.Kind == "data");

		Assert.AreEqual("command", dependency.Label);
		Assert.AreEqual("string", dependency.Type);
	}

	private class SourceReader : IWorkflowSourceReader
	{
		private readonly string source;

		public SourceReader(string source)
		{
			this.source = source;
		}

		public Task<string> ReadAsync(string path, CancellationToken cancellationToken)
		{
			return Task.FromResult(this.source);
		}
	}

	private class ModuleCatalog : IWorkflowModuleCatalog
	{
		public Task<WorkflowModule?> GetAsync(string modulePath, CancellationToken cancellationToken)
		{
			return Task.FromResult<WorkflowModule?>(null);
		}
	}
}
