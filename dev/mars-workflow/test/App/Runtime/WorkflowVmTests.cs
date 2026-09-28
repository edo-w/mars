using System.Text.Json.Nodes;
using Mars.Workflow.App.Compiler;
using Mars.Workflow.App.Modules;
using Mars.Workflow.App.Runtime;
using NUnit.Framework;
using Assert = NUnit.Framework.Legacy.ClassicAssert;

namespace Mars.Workflow.Tests.App.Runtime;

public class WorkflowVmTests
{
	[Test]
	public async Task RunsStepsInOrderAndStoresTheirResults()
	{
		var source = """
			workflow {
				input { name string }
			}
			run 'echo {name}'
			run 'echo done'
			""";
		var compiler = new WorkflowCompiler(new MemorySourceReader(source), new EmptyModuleCatalog());
		var compilation = await compiler.CompileAsync("example.mars");
		var store = new MemoryStore();
		var host = new CaptureHost();
		var vm = new WorkflowVm(store, host);
		var input = new JsonObject { ["name"] = "mars" };

		var result = await vm.RunAsync(compilation, input);

		Assert.IsTrue(result.Succeeded);
		Assert.AreEqual(2, store.Steps.Count);
		Assert.AreEqual("echo mars", host.Commands[0]);
		Assert.AreEqual("echo done", host.Commands[1]);
		Assert.IsTrue(store.Events.Any(item => item.Name == "workflow.returned"));
		Assert.IsTrue(store.Events.Any(item => item.Name == "workflow.completed"));
	}

	[Test]
	public async Task AppliesTextInputDefault()
	{
		var source = "workflow {\ninput { name string = 'world' }\n}\nrun 'echo {name}'\n";
		var compiler = new WorkflowCompiler(new MemorySourceReader(source), new EmptyModuleCatalog());
		var compilation = await compiler.CompileAsync("default.mars");
		var store = new MemoryStore();
		var host = new CaptureHost();
		var vm = new WorkflowVm(store, host);

		var result = await vm.RunAsync(compilation, new JsonObject());

		Assert.IsTrue(result.Succeeded);
		Assert.AreEqual("echo world", host.Commands[0]);
	}

	[Test]
	public async Task AppliesNegativeIntegerInputDefault()
	{
		var source = "workflow {\ninput { count i32 = -2 }\n}\nrun 'echo {count}'\n";
		var compiler = new WorkflowCompiler(new MemorySourceReader(source), new EmptyModuleCatalog());
		var compilation = await compiler.CompileAsync("default.mars");
		var store = new MemoryStore();
		var host = new CaptureHost();
		var vm = new WorkflowVm(store, host);

		var result = await vm.RunAsync(compilation, new JsonObject());

		Assert.IsTrue(result.Succeeded);
		Assert.AreEqual("echo -2", host.Commands[0]);
	}

	[Test]
	public async Task LocalFunctionReturnsFromNestedCondition()
	{
		var source = """
			workflow {}
			fn choose(flag bool) string {
				if flag {
					if true {
						return 'yes'
					}
				}
				return 'no'
			}
			let answer = choose(true)
			run 'echo {answer}'
			""";
		var compiler = new WorkflowCompiler(new MemorySourceReader(source), new EmptyModuleCatalog());
		var compilation = await compiler.CompileAsync("function.mars");
		var messages = string.Join("; ", compilation.Diagnostics.Select(item => item.Message));
		var store = new MemoryStore();
		var host = new CaptureHost();
		var vm = new WorkflowVm(store, host);

		Assert.IsTrue(compilation.IsValid, messages);

		var result = await vm.RunAsync(compilation, null);

		Assert.IsTrue(result.Succeeded);
		Assert.AreEqual("echo yes", host.Commands[0]);
	}

	[Test]
	public async Task CallsAnotherWorkflowAndEmitsCallEvents()
	{
		var directory = Path.GetFullPath("workflow-call-test");
		var rootPath = Path.Combine(directory, "root.mars");
		var childPath = Path.Combine(directory, "child.mars");
		var sources = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
		{
			[rootPath] = """
				workflow { output { result string } }
				let answer = call ./child.mars
				return answer
				""",
			[childPath] = """
				workflow { output { result string } }
				return { result = 'ok' }
				""",
		};
		var compiler = new WorkflowCompiler(
			new DictionarySourceReader(sources),
			new EmptyModuleCatalog()
		);
		var compilation = await compiler.CompileAsync(rootPath);
		var store = new MemoryStore();
		var vm = new WorkflowVm(store, new CaptureHost());

		var result = await vm.RunAsync(compilation, null);

		Assert.IsTrue(result.Succeeded);
		Assert.AreEqual("ok", result.Run.Output!["result"]!.GetValue<string>());
		Assert.IsTrue(store.Events.Any(item => item.Name == "workflow.called"));
		Assert.AreEqual(2, store.Events.Count(item => item.Name == "workflow.returned"));
	}

	[Test]
	public async Task FailureStopsLaterSteps()
	{
		var source = "workflow {}\nrun 'echo first'\nrun 'echo second'\n";
		var compiler = new WorkflowCompiler(new MemorySourceReader(source), new EmptyModuleCatalog());
		var compilation = await compiler.CompileAsync("failed.mars");
		var store = new MemoryStore();
		var host = new FailingHost(cancel: false);
		var vm = new WorkflowVm(store, host);

		var result = await vm.RunAsync(compilation, null);

		Assert.IsFalse(result.Succeeded);
		Assert.AreEqual(WorkflowRunState.Failed, result.Run.State);
		Assert.AreEqual(1, host.Calls);
		Assert.AreEqual(1, store.Steps.Count);
		Assert.AreEqual(WorkflowRunState.Failed, store.Steps[0].State);
	}

	[Test]
	public async Task CancellationMarksActiveStepAndRun()
	{
		var source = "workflow {}\nrun 'echo first'\n";
		var compiler = new WorkflowCompiler(new MemorySourceReader(source), new EmptyModuleCatalog());
		var compilation = await compiler.CompileAsync("cancelled.mars");
		var store = new MemoryStore();
		var vm = new WorkflowVm(store, new FailingHost(cancel: true));

		var result = await vm.RunAsync(compilation, null);

		Assert.AreEqual(WorkflowRunState.Cancelled, result.Run.State);
		Assert.AreEqual(WorkflowRunState.Cancelled, store.Steps[0].State);
		Assert.IsTrue(store.Events.Any(item => item.Name == "workflow.cancelled"));
	}

	private class MemorySourceReader : IWorkflowSourceReader
	{
		private readonly string source;

		public MemorySourceReader(string source)
		{
			this.source = source;
		}

		public Task<string> ReadAsync(string path, CancellationToken cancellationToken)
		{
			return Task.FromResult(this.source);
		}
	}

	private class DictionarySourceReader : IWorkflowSourceReader
	{
		private readonly IReadOnlyDictionary<string, string> sources;

		public DictionarySourceReader(IReadOnlyDictionary<string, string> sources)
		{
			this.sources = sources;
		}

		public Task<string> ReadAsync(string path, CancellationToken cancellationToken)
		{
			return Task.FromResult(this.sources[path]);
		}
	}

	private class EmptyModuleCatalog : IWorkflowModuleCatalog
	{
		public Task<WorkflowModule?> GetAsync(string modulePath, CancellationToken cancellationToken)
		{
			return Task.FromResult<WorkflowModule?>(null);
		}
	}

	private class CaptureHost : IWorkflowOperationHost
	{
		public List<string> Commands { get; } = [];

		public Task<JsonNode?> InvokeTaskAsync(
			BoundStep step,
			JsonNode? input,
			WorkflowOperationContext context,
			CancellationToken cancellationToken
		)
		{
			var command = input!["command"]!.GetValue<string>();
			this.Commands.Add(command);
			JsonNode result = new JsonObject { ["exit_code"] = 0 };

			return Task.FromResult<JsonNode?>(result);
		}

		public Task<JsonNode?> InvokeFunctionAsync(
			BoundFunction function,
			JsonNode? input,
			Guid runId,
			Func<string, int?, CancellationToken, Task> progress,
			CancellationToken cancellationToken
		)
		{
			throw new InvalidOperationException("No function was expected.");
		}
	}

	private class FailingHost : IWorkflowOperationHost
	{
		private readonly bool cancel;

		public FailingHost(bool cancel)
		{
			this.cancel = cancel;
		}

		public int Calls { get; private set; }

		public Task<JsonNode?> InvokeTaskAsync(
			BoundStep step,
			JsonNode? input,
			WorkflowOperationContext context,
			CancellationToken cancellationToken
		)
		{
			this.Calls++;
			if (this.cancel)
			{
				throw new OperationCanceledException(cancellationToken);
			}

			throw new WorkflowRuntimeException("Task failed.");
		}

		public Task<JsonNode?> InvokeFunctionAsync(
			BoundFunction function,
			JsonNode? input,
			Guid runId,
			Func<string, int?, CancellationToken, Task> progress,
			CancellationToken cancellationToken
		)
		{
			throw new InvalidOperationException("No function was expected.");
		}
	}

	private class MemoryStore : IWorkflowStore
	{
		public List<WorkflowStepRecord> Steps { get; } = [];
		public List<WorkflowEventRecord> Events { get; } = [];

		public Task CreateRunAsync(WorkflowRunRecord run, CancellationToken cancellationToken)
		{
			return Task.CompletedTask;
		}

		public Task UpdateRunAsync(WorkflowRunRecord run, CancellationToken cancellationToken)
		{
			return Task.CompletedTask;
		}

		public Task CreateStepAsync(WorkflowStepRecord step, CancellationToken cancellationToken)
		{
			this.Steps.Add(step);

			return Task.CompletedTask;
		}

		public Task UpdateStepAsync(WorkflowStepRecord step, CancellationToken cancellationToken)
		{
			return Task.CompletedTask;
		}

		public Task AppendEventAsync(WorkflowEventRecord item, CancellationToken cancellationToken)
		{
			this.Events.Add(item);

			return Task.CompletedTask;
		}

		public Task<WorkflowRunRecord?> GetRunAsync(Guid id, CancellationToken cancellationToken)
		{
			return Task.FromResult<WorkflowRunRecord?>(null);
		}

		public Task<IReadOnlyList<WorkflowRunRecord>> ListRunsAsync(CancellationToken cancellationToken)
		{
			IReadOnlyList<WorkflowRunRecord> runs = [];

			return Task.FromResult(runs);
		}
	}
}
