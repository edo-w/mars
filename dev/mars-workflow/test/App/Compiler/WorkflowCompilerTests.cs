using Mars.Workflow.App.Compiler;
using Mars.Workflow.App.Modules;
using Mars.Workflow.App.Types;
using NUnit.Framework;
using Assert = NUnit.Framework.Legacy.ClassicAssert;

namespace Mars.Workflow.Tests.App.Compiler;

public class WorkflowCompilerTests
{
	[Test]
	public async Task RejectsInvalidConditionBeforeExecution()
	{
		var source = """
			workflow {}
			if 'yes' {
				run 'echo should-not-run'
			}
			""";
		var reader = new MemorySourceReader(source);
		var catalog = new EmptyModuleCatalog();
		var compiler = new WorkflowCompiler(reader, catalog);

		var result = await compiler.CompileAsync("invalid.mars");

		Assert.IsFalse(result.IsValid);
		Assert.IsTrue(result.Diagnostics.Any(item => item.Code == "WF228"));
	}

	[Test]
	public async Task BindsSequentialRunSteps()
	{
		var source = """
			workflow {
				input { name string }
			}
			run 'echo {name}'
			""";
		var reader = new MemorySourceReader(source);
		var catalog = new EmptyModuleCatalog();
		var compiler = new WorkflowCompiler(reader, catalog);

		var result = await compiler.CompileAsync("valid.mars");

		var messages = string.Join("; ", result.Diagnostics.Select(item => item.Message));
		Assert.IsTrue(result.IsValid, messages);
		Assert.AreEqual(1, result.Root!.Steps.Count);
	}

	[Test]
	public async Task RejectsFunctionWithMissingReturnPath()
	{
		var source = """
			workflow {}
			fn choose(flag bool) string {
				if flag {
					return 'yes'
				}
			}
			""";
		var compiler = new WorkflowCompiler(new MemorySourceReader(source), new EmptyModuleCatalog());

		var result = await compiler.CompileAsync("invalid.mars");

		Assert.IsFalse(result.IsValid);
		Assert.IsTrue(result.Diagnostics.Any(item => item.Code == "WF248"));
	}

	[Test]
	public async Task RejectsTaskInputTypeBeforeExecution()
	{
		var source = """
			use fixture/math *
			workflow {}
			task 'double' {
				use double
				input { value = 'wrong' }
			}
			""";
		var input = WorkflowType.ShapeOf(
			"Input",
			[
				new WorkflowField("value", WorkflowType.I32),
			]
		);
		var export = new ModuleExport(
			"double",
			ModuleExportKind.Task,
			input,
			WorkflowType.Void
		);
		var module = new WorkflowModule("fixture/math", [export]);
		var compiler = new WorkflowCompiler(
			new MemorySourceReader(source),
			new SingleModuleCatalog(module)
		);

		var result = await compiler.CompileAsync("invalid.mars");

		Assert.IsFalse(result.IsValid);
		Assert.IsTrue(result.Diagnostics.Any(item => item.Code == "WF225"));
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

	private class EmptyModuleCatalog : IWorkflowModuleCatalog
	{
		public Task<WorkflowModule?> GetAsync(string modulePath, CancellationToken cancellationToken)
		{
			return Task.FromResult<WorkflowModule?>(null);
		}
	}

	private class SingleModuleCatalog : IWorkflowModuleCatalog
	{
		private readonly WorkflowModule module;

		public SingleModuleCatalog(WorkflowModule module)
		{
			this.module = module;
		}

		public Task<WorkflowModule?> GetAsync(string modulePath, CancellationToken cancellationToken)
		{
			return Task.FromResult<WorkflowModule?>(this.module);
		}
	}
}
