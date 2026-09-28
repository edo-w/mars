using System.Text.Json.Nodes;
using Mars.Workflow.App.Interop;
using NUnit.Framework;
using Assert = NUnit.Framework.Legacy.ClassicAssert;

namespace Mars.Workflow.Tests.App.Interop;

public class WorkflowProtocolCodesTests
{
	[Test]
	public void HostCodesMatchSharedFixture()
	{
		var workspace = FindWorkspaceRoot();
		var path = Path.Combine(
			workspace,
			"dev",
			"mars-workflow",
			"fixtures",
			"protocol-errors.json"
		);
		var json = File.ReadAllText(path);
		var codes = JsonNode.Parse(json)!;

		Assert.AreEqual(
			WorkflowProtocolCodes.InvalidMessage,
			codes["invalid_message"]!.GetValue<string>()
		);
		Assert.AreEqual(
			WorkflowProtocolCodes.UnknownRequest,
			codes["unknown_request"]!.GetValue<string>()
		);
		Assert.AreEqual(
			WorkflowProtocolCodes.MessageAfterReturn,
			codes["message_after_return"]!.GetValue<string>()
		);
		Assert.AreEqual(
			WorkflowProtocolCodes.InvalidReturn,
			codes["invalid_return"]!.GetValue<string>()
		);
		Assert.AreEqual(
			WorkflowProtocolCodes.UnknownMessageType,
			codes["unknown_message_type"]!.GetValue<string>()
		);
		Assert.AreEqual(
			WorkflowProtocolCodes.MissingReturn,
			codes["missing_return"]!.GetValue<string>()
		);
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
