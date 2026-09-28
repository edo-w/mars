using System.Text.Json.Nodes;
using Mars.Workflow.App.Runtime;
using Mars.Workflow.App.Types;
using NUnit.Framework;
using Assert = NUnit.Framework.Legacy.ClassicAssert;

namespace Mars.Workflow.Tests.App.Runtime;

public class WorkflowValueValidatorTests
{
	[Test]
	public void AcceptsEveryWireValueKind()
	{
		var fields = new List<WorkflowField>
		{
			new("text", WorkflowType.Text),
			new("enabled", WorkflowType.Bool),
			new("count", WorkflowType.I32),
			new("ratio", WorkflowType.F32),
			new("when", WorkflowType.Datetime),
			new("delay", WorkflowType.Duration),
			new("location", WorkflowType.Path),
			new("website", WorkflowType.Url),
			new("labels", WorkflowType.ListOf(WorkflowType.Text)),
			new("note", WorkflowType.OptionalOf(WorkflowType.Text)),
		};
		var type = WorkflowType.ShapeOf("Values", fields);
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
		var validator = new WorkflowValueValidator();

		var result = validator.Validate(type, input, "input");

		Assert.AreEqual("hello", result!["text"]!.GetValue<string>());
		Assert.AreEqual(1.25f, result["ratio"]!.GetValue<float>());
		Assert.AreEqual(2, result["labels"]!.AsArray().Count);
	}

	[Test]
	public void RejectsOutOfRangeInteger()
	{
		var validator = new WorkflowValueValidator();
		var value = JsonValue.Create(2147483648L);

		Assert.Throws<WorkflowRuntimeException>(() =>
		{
			validator.Validate(WorkflowType.I32, value, "count");
		});
	}
}
