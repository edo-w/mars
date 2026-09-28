using System.Text.Json.Nodes;
using Mars.Workflow.App.Workflow;
using Mars.Core.App.Config;
using Mars.Core.Lib;
using Mars.Local.App.LocalWorkflow;
using Microsoft.Data.Sqlite;
using Moq;
using NUnit.Framework;
using Assert = NUnit.Framework.Legacy.ClassicAssert;

namespace Mars.Cli.Tests.App.Workflow;

public class WorkflowServiceTests
{
	[Test]
	public async Task ListsRunsAndReadsLatestOrSelectedLogs()
	{
		var workspace = FindWorkspaceRoot();
		var home = Path.Combine(
			workspace,
			".mars",
			"tmp",
			"workflow-history-test",
			Guid.CreateVersion7().ToString()
		);
		Directory.CreateDirectory(home);
		var workflowPath = Path.Combine(home, "history.mwf");
		await File.WriteAllTextAsync(workflowPath, "run 'echo mars-history'\n");

		try
		{
			var service = CreateStandaloneService(home);
			var initialRuns = await service.ListRunsAsync(CancellationToken.None);
			Assert.IsEmpty(initialRuns);
			Assert.IsFalse(File.Exists(Path.Combine(home, "workflow.db")));

			await using var session = await service.CompileAsync(workflowPath, CancellationToken.None);
			Assert.IsTrue(session.Compilation.IsValid);
			var first = await service.RunAsync(session, null, null, CancellationToken.None);
			var second = await service.RunAsync(session, null, null, CancellationToken.None);

			var runs = await service.ListRunsAsync(CancellationToken.None);
			var latestLogs = await service.ReadLogsAsync(null, CancellationToken.None);
			var firstLogs = await service.ReadLogsAsync(first.Run.Id, CancellationToken.None);
			var stdout = latestLogs.Files.Single(item => item.Name.EndsWith(".stdout.log", StringComparison.Ordinal));

			Assert.AreEqual(2, runs.Count);
			Assert.AreEqual(second.Run.Id, runs[0].Id);
			Assert.AreEqual(second.Run.Id, latestLogs.Run.Id);
			Assert.AreEqual(first.Run.Id, firstLogs.Run.Id);
			Assert.IsTrue(stdout.Content.Contains("mars-history", StringComparison.Ordinal));
		}
		finally
		{
			SqliteConnection.ClearAllPools();
			Directory.Delete(home, recursive: true);
		}
	}

	[Test]
	public async Task RunsWithoutMarsConfigAndStoresStandaloneHistory()
	{
		var workspace = FindWorkspaceRoot();
		var home = Path.Combine(
			workspace,
			".mars",
			"tmp",
			"workflow-app-free",
			Guid.CreateVersion7().ToString()
		);
		Directory.CreateDirectory(home);
		var workflowPath = Path.Combine(home, "hello.mars");
		await File.WriteAllTextAsync(workflowPath, "workflow {}\nrun 'echo mars'\n");

		try
		{
			var service = CreateStandaloneService(home);
			await using var session = await service.CompileAsync(workflowPath, CancellationToken.None);

			var result = await service.RunAsync(session, null, null, CancellationToken.None);

			Assert.IsTrue(result.Succeeded);
			Assert.IsTrue(File.Exists(Path.Combine(home, "workflow.db")));
			Assert.IsTrue(
				Directory.Exists(
					Path.Combine(
						home,
						"logs",
						"wf",
						result.Run.Id.ToString()
					)
				)
			);
		}
		finally
		{
			SqliteConnection.ClearAllPools();
			Directory.Delete(home, recursive: true);
		}
	}

	[Test]
	public async Task CallsTypeScriptModuleAndCapturesDiagnostics()
	{
		var workspace = FindWorkspaceRoot();
		var home = Path.Combine(
			workspace,
			".mars",
			"tmp",
			"workflow-module-test",
			Guid.CreateVersion7().ToString()
		);
		Directory.CreateDirectory(home);
		await WriteModuleManifestAsync(home, workspace);
		var workflowPath = Path.Combine(home, "module.mars");
		var source = """
			use fixture/math *
			workflow {
				input { value i32 }
				output { result i32 }
			}
			let description = describeValue(value)
			task 'noop' {
				use noop
			}
			let answer = task 'double' {
				use double
				input { value = value }
			}
			return answer
			""";
		await File.WriteAllTextAsync(workflowPath, source);

		try
		{
			var service = CreateStandaloneService(home);
			await using var session = await service.CompileAsync(workflowPath, CancellationToken.None);
			var input = new JsonObject { ["value"] = 21 };

			var result = await service.RunAsync(session, input, null, CancellationToken.None);

			Assert.IsTrue(result.Succeeded, result.Run.Error ?? "Workflow failed.");
			Assert.AreEqual(42, result.Run.Output!["result"]!.GetValue<int>());
			var logDirectory = Path.Combine(home, "logs", "wf", result.Run.Id.ToString());
			var diagnosticFiles = Directory.GetFiles(logDirectory, "*.module.stderr.jsonl");
			var stepDiagnosticFiles = diagnosticFiles
				.Where(path => Path.GetFileName(path) != "run.module.stderr.jsonl")
				.ToArray();
			Assert.AreEqual(1, stepDiagnosticFiles.Length);
			var diagnostics = await File.ReadAllTextAsync(stepDiagnosticFiles[0]);
			Assert.IsTrue(diagnostics.Contains("doubling", StringComparison.Ordinal));
			var functionDiagnosticsPath = Path.Combine(
				logDirectory,
				"run.module.stderr.jsonl"
			);
			var functionDiagnostics = await File.ReadAllTextAsync(functionDiagnosticsPath);
			Assert.IsTrue(functionDiagnostics.Contains("module starting", StringComparison.Ordinal));
			Assert.IsTrue(functionDiagnostics.Contains("describing", StringComparison.Ordinal));
			var eventLog = await File.ReadAllTextAsync(
				Path.Combine(
					logDirectory,
					"events.jsonl"
				)
			);
			Assert.IsTrue(eventLog.Contains("function.progress", StringComparison.Ordinal));
		}
		finally
		{
			SqliteConnection.ClearAllPools();
			Directory.Delete(home, recursive: true);
		}
	}

	[Test]
	public async Task RejectsInvalidWorkflowBeforeCreatingRunStorage()
	{
		var workspace = FindWorkspaceRoot();
		var home = Path.Combine(
			workspace,
			".mars",
			"tmp",
			"workflow-invalid-test",
			Guid.CreateVersion7().ToString()
		);
		Directory.CreateDirectory(home);
		var workflowPath = Path.Combine(home, "invalid.mars");
		await File.WriteAllTextAsync(
			workflowPath,
			"workflow {}\nif 'not a bool' { run 'echo should-not-run' }\n"
		);

		try
		{
			var service = CreateStandaloneService(home);

			await using var session = await service.CompileAsync(
				workflowPath,
				CancellationToken.None
			);

			Assert.IsFalse(session.Compilation.IsValid);
			Assert.IsFalse(File.Exists(Path.Combine(home, "workflow.db")));
		}
		finally
		{
			Directory.Delete(home, recursive: true);
		}
	}

	[Test]
	public async Task RoundTripsAllWireTypesThroughTypeScriptModule()
	{
		var workspace = FindWorkspaceRoot();
		var home = Path.Combine(
			workspace,
			".mars",
			"tmp",
			"workflow-wire-test",
			Guid.CreateVersion7().ToString()
		);
		Directory.CreateDirectory(home);
		await WriteModuleManifestAsync(home, workspace);
		var workflowPath = Path.Combine(home, "roundtrip.mars");
		var source = """
			use fixture/math *
			workflow {
				input = WireValues
				output = WireValues
			}
			let result = task 'roundtrip' {
				use roundtrip
				input {
					text = text
					enabled = enabled
					count = count
					ratio = ratio
					when = when
					delay = delay
					location = location
					website = website
					labels = labels
					note = note
				}
			}
			return result
			""";
		await File.WriteAllTextAsync(workflowPath, source);
		var input = new JsonObject
		{
			["text"] = "hello",
			["enabled"] = true,
			["count"] = 5,
			["ratio"] = 1.25,
			["when"] = "2026-09-27T12:00:00Z",
			["delay"] = 500,
			["location"] = "./build",
			["website"] = "https://example.com",
			["labels"] = new JsonArray("one", "two"),
			["note"] = null,
		};

		try
		{
			var service = CreateStandaloneService(home);
			await using var session = await service.CompileAsync(workflowPath, CancellationToken.None);

			Assert.IsTrue(session.Compilation.IsValid);
			var result = await service.RunAsync(session, input, null, CancellationToken.None);

			Assert.IsTrue(result.Succeeded, result.Run.Error ?? "Workflow failed.");
			Assert.IsTrue(JsonNode.DeepEquals(input, result.Run.Output));
		}
		finally
		{
			SqliteConnection.ClearAllPools();
			Directory.Delete(home, recursive: true);
		}
	}

	private static WorkflowService CreateStandaloneService(string home)
	{
		var fileSystem = new Mock<IVfs>();
		fileSystem.Setup(item => item.FileExists(It.IsAny<string>())).Returns(false);
		var process = new Mock<IVProcess>();
		process.SetupGet(item => item.CurrentDirectory).Returns(home);
		process.Setup(item => item.GetEnvironmentVariable("MARS_HOME")).Returns(home);
		var configService = new ConfigService(fileSystem.Object);
		var storageProvider = new LocalWorkflowStorageProvider(configService, process.Object);
		var service = new WorkflowService(storageProvider, process.Object);

		return service;
	}

	private static Task WriteModuleManifestAsync(string home, string workspace)
	{
		var fixturePath = Path.Combine(
			workspace,
			"dev",
			"mars-workflow",
			"sdk",
			"typescript",
			"test",
			"fixture-module.ts"
		);
		var fixtureArgument = fixturePath.Replace('\\', '/');
		var manifest = $"""
			version: 1
			modules:
			  - path: fixture/math
			    command: bun
			    args:
			      - '{fixtureArgument}'
			""";
		var manifestPath = Path.Combine(home, "mars-workflow.yml");

		return File.WriteAllTextAsync(manifestPath, manifest);
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
