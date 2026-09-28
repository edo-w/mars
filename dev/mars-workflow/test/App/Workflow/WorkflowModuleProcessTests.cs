using Mars.Workflow.App.Workflow;
using Mars.Workflow.App.Interop;
using NUnit.Framework;
using Assert = NUnit.Framework.Legacy.ClassicAssert;

namespace Mars.Workflow.Tests.App.Workflow;

public class WorkflowModuleProcessTests
{
	[Test]
	public async Task RejectsDuplicateTerminalReturn()
	{
		var workspace = FindWorkspaceRoot();
		var fixture = Path.Combine(
			workspace,
			"dev",
			"mars-workflow",
			"sdk",
			"typescript",
			"test",
			"duplicate-return-module.ts"
		);
		var entry = new WorkflowModuleEntry("fixture/duplicate", "bun", [fixture]);
		var process = new WorkflowModuleProcess(entry, workspace);
		WorkflowProtocolException? failure = null;

		try
		{
			await process.DescribeAsync(CancellationToken.None);
			await Task.Delay(50);
		}
		finally
		{
			try
			{
				await process.DisposeAsync();
			}
			catch (WorkflowProtocolException exception)
			{
				failure = exception;
			}
		}

		Assert.IsNotNull(failure);
		Assert.AreEqual(WorkflowProtocolCodes.MessageAfterReturn, failure!.Code);
		Assert.IsTrue(
			failure!.Message.Contains(
				"after terminal return",
				StringComparison.Ordinal
			)
		);
	}

	[Test]
	public async Task KillsUnresponsiveModuleAfterCancellationGrace()
	{
		var workspace = FindWorkspaceRoot();
		var fixture = Path.Combine(
			workspace,
			"dev",
			"mars-workflow",
			"sdk",
			"typescript",
			"test",
			"unresponsive-module.ts"
		);
		var entry = new WorkflowModuleEntry("fixture/unresponsive", "bun", [fixture]);
		await using var process = new WorkflowModuleProcess(
			entry,
			workspace,
			TimeSpan.FromMilliseconds(100)
		);
		await process.DescribeAsync(CancellationToken.None);
		using var cancellation = new CancellationTokenSource();
		cancellation.CancelAfter(TimeSpan.FromMilliseconds(50));
		OperationCanceledException? result = null;

		try
		{
			await process.InvokeTaskAsync(
				"never",
				null,
				true,
				(_, _, _) => Task.CompletedTask,
				cancellation.Token
			);
		}
		catch (OperationCanceledException exception)
		{
			result = exception;
		}

		Assert.IsNotNull(result);
	}

	private static string FindWorkspaceRoot()
	{
		DirectoryInfo? directory = new(TestContext.CurrentContext.TestDirectory);
		while (directory is not null)
		{
			var solutionPath = Path.Combine(directory.FullName, "dev", "mars.slnx");
			if (File.Exists(solutionPath))
			{
				return directory.FullName;
			}

			directory = directory.Parent;
		}

		throw new InvalidOperationException("Cannot locate the Mars workspace.");
	}
}
