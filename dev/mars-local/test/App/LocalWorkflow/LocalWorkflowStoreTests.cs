using System.Collections.Concurrent;
using System.Text.Json.Nodes;
using Mars.Local.App.LocalWorkflow;
using Mars.Local.Db;
using Mars.Workflow.App.Runtime;
using Mars.Workflow.App.Workflow;
using Microsoft.Data.Sqlite;
using NUnit.Framework;
using Assert = NUnit.Framework.Legacy.ClassicAssert;

namespace Mars.Local.Tests.App.LocalWorkflow;

public class LocalWorkflowStoreTests
{
	[Test]
	public async Task ReopensStoredRunFromWorkflowDatabase()
	{
		var workspace = FindWorkspaceRoot();
		var home = Path.Combine(
			workspace,
			".mars",
			"tmp",
			"workflow-test",
			Guid.CreateVersion7().ToString()
		);
		try
		{
			var session = new WorkflowDbSession(home, null);
			session.Initialize();
			var run = new WorkflowRunRecord
			{
				Id = Guid.CreateVersion7(),
				SourcePath = "example.mars",
				State = WorkflowRunState.Running,
				CreateDate = DateTimeOffset.UtcNow,
				Input = new JsonObject { ["name"] = "Mars" },
			};
			using (var store = new LocalWorkflowStore(new LocalWorkflowRepo(session)))
			{
				await store.CreateRunAsync(run, CancellationToken.None);
				run.State = WorkflowRunState.Succeeded;
				run.Output = new JsonObject { ["ok"] = true };
				await store.UpdateRunAsync(run, CancellationToken.None);
			}

			var reopened = new WorkflowDbSession(home, null);
			reopened.Initialize();
			using (var reader = new LocalWorkflowStore(new LocalWorkflowRepo(reopened)))
			{
				var saved = await reader.GetRunAsync(run.Id, CancellationToken.None);

				Assert.IsNotNull(saved);
				Assert.AreEqual(WorkflowRunState.Succeeded, saved!.State);
				Assert.AreEqual(true, saved.Output!["ok"]!.GetValue<bool>());
				Assert.IsTrue(File.Exists(reopened.DatabasePath));
			}
		}
		finally
		{
			SqliteConnection.ClearAllPools();
			if (Directory.Exists(home))
			{
				Directory.Delete(home, recursive: true);
			}
		}
	}

	[Test]
	public async Task CapturesStructuredModuleDiagnostics()
	{
		var workspace = FindWorkspaceRoot();
		var home = Path.Combine(
			workspace,
			".mars",
			"tmp",
			"workflow-diagnostic-test",
			Guid.CreateVersion7().ToString()
		);
		var session = new WorkflowDbSession(home, null);
		var logs = new LocalWorkflowLogStore(session);
		var writer = new WorkflowDiagnosticWriter(logs);
		var runId = Guid.CreateVersion7();
		var stepId = Guid.CreateVersion7();
		var lines = new ConcurrentQueue<WorkflowDiagnosticLine>();
		var line = new WorkflowDiagnosticLine(
			DateTimeOffset.UtcNow,
			"level=info msg=Uploaded count=42"
		);
		lines.Enqueue(line);

		try
		{
			await writer.WriteAsync(
				runId,
				stepId,
				"example/module",
				lines,
				CancellationToken.None
			);
			var path = Path.Combine(
				session.LogDirectory,
				runId.ToString(),
				$"{stepId}.module.stderr.jsonl"
			);
			var contents = await File.ReadAllTextAsync(path);
			var record = JsonNode.Parse(contents);

			Assert.AreEqual("Uploaded", record!["data"]!["msg"]!.GetValue<string>());
			Assert.AreEqual(42, record["data"]!["count"]!.GetValue<long>());
		}
		finally
		{
			if (Directory.Exists(home))
			{
				Directory.Delete(home, recursive: true);
			}
		}
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
