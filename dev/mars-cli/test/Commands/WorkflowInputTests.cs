using System.Text.Json.Nodes;
using Mars.Workflow.App.Workflow;
using Mars.Core.Lib;
using Mars.Workflow.App.Runtime;
using Mars.Workflow.App.Types;
using Moq;
using NUnit.Framework;
using Assert = NUnit.Framework.Legacy.ClassicAssert;

namespace Mars.Cli.Tests.Commands;

public class WorkflowInputTests
{
	[Test]
	public void ParsesRepeatedInputPairs()
	{
		var fields = new List<WorkflowField>
		{
			new("environment", WorkflowType.Text),
			new("force", WorkflowType.Bool),
		};
		var type = WorkflowType.ShapeOf("Input", fields);
		string[] pairs = ["environment=production", "force=true"];

		var input = WorkflowService.ParseInput(type, null, pairs);

		Assert.AreEqual("production", input!["environment"]!.GetValue<string>());
		Assert.AreEqual(true, input["force"]!.GetValue<bool>());
	}

	[Test]
	public void ParsesNestedInputPairs()
	{
		var serverFields = new List<WorkflowField>
		{
			new("host", WorkflowType.Text),
			new("port", WorkflowType.I32),
		};
		var server = WorkflowType.ShapeOf("Server", serverFields);
		var type = WorkflowType.ShapeOf("Input", [new WorkflowField("server", server)]);
		string[] pairs = ["server.host=10.0.0.20", "server.port=22"];

		var input = WorkflowService.ParseInput(type, null, pairs);

		Assert.AreEqual("10.0.0.20", input!["server"]!["host"]!.GetValue<string>());
		Assert.AreEqual(22, input["server"]!["port"]!.GetValue<int>());
	}

	[Test]
	public void PropertyFlagOverridesJsonInput()
	{
		var fields = new List<WorkflowField>
		{
			new("value", WorkflowType.I32),
		};
		var type = WorkflowType.ShapeOf("Input", fields);
		string[] pairs = ["value=7"];

		var input = WorkflowService.ParseInput(type, "{\"value\":2}", pairs);

		Assert.AreEqual(7, input!["value"]!.GetValue<int>());
	}

	[Test]
	public void RejectsUnknownInputProperty()
	{
		var type = WorkflowType.ShapeOf("Input", []);
		string[] pairs = ["missing=value"];

		Assert.Throws<WorkflowRuntimeException>(() =>
		{
			WorkflowService.ParseInput(type, null, pairs);
		});
	}

	[Test]
	public async Task ReadsJsonInputFileAndAppliesNestedOverride()
	{
		var directory = TestContext.CurrentContext.WorkDirectory;
		var fileName = $"workflow-input-{Guid.CreateVersion7()}.json";
		var path = Path.Combine(directory, fileName);
		var server = WorkflowType.ShapeOf(
			"Server",
			[
				new WorkflowField("host", WorkflowType.Text),
				new WorkflowField("port", WorkflowType.I32),
			]
		);
		var type = WorkflowType.ShapeOf("Input", [new WorkflowField("server", server)]);
		var process = new Mock<IVProcess>();
		process.SetupGet(item => item.CurrentDirectory).Returns(directory);
		var storageProvider = new Mock<IWorkflowStorageProvider>();
		var service = new WorkflowService(storageProvider.Object, process.Object);
		await File.WriteAllTextAsync(path, "{\"server\":{\"host\":\"old\",\"port\":22}}");

		try
		{
			string[] pairs = ["server.host=10.0.0.20"];
			var input = await service.ParseInputAsync(
				type,
				fileName,
				null,
				pairs,
				CancellationToken.None
			);

			Assert.AreEqual("10.0.0.20", input!["server"]!["host"]!.GetValue<string>());
			Assert.AreEqual(22, input["server"]!["port"]!.GetValue<int>());
		}
		finally
		{
			File.Delete(path);
		}
	}

	[Test]
	public void RejectsDuplicateInputPairs()
	{
		var type = WorkflowType.ShapeOf(
			"Input",
			[new WorkflowField("name", WorkflowType.Text)]
		);
		string[] pairs = ["name=one", "name=two"];

		Assert.Throws<WorkflowRuntimeException>(
			() => WorkflowService.ParseInput(type, null, pairs)
		);
	}
}
