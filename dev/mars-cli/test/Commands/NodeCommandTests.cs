using System.Text.Json;
using Mars.Cli.Commands;
using Mars.Core.App.Environment;
using Mars.Core.App.Node;
using Moq;
using NUnit.Framework;
using Assert = NUnit.Framework.Legacy.ClassicAssert;
using MarsEnvironment = Mars.Core.App.Environment.Environment;

namespace Mars.Cli.Tests.Commands;

public class NodeCommandTests
{
	[Test]
	public async Task ShowDeleteAndStatusResolveNodeNames()
	{
		var environment = new MarsEnvironment(Guid.CreateVersion7(), "dev", "app", new Dictionary<string, string>());
		var environments = new Mock<IEnvironmentService>();
		environments.Setup(item => item.ResolveAsync(null)).ReturnsAsync(environment);
		var nodeId = Guid.CreateVersion7();
		var date = new DateTimeOffset(2026, 9, 27, 12, 0, 0, TimeSpan.Zero);
		var node = new Node(
			nodeId,
			"web-1",
			null,
			null,
			null,
			"new",
			date,
			date,
			new Dictionary<string, JsonElement>(),
			[]
		);
		var nodes = new Mock<INodeService>();
		nodes.Setup(item => item.ResolveAsync(environment.Id, "web-1")).ReturnsAsync(node);
		nodes.Setup(item => item.DeleteAsync(environment.Id, nodeId)).Returns(Task.CompletedTask);
		nodes.Setup(item => item.SetStatusAsync(environment.Id, nodeId, "ready"))
			.Returns(Task.CompletedTask);
		var showHandler = new NodeShowCommandHandler(environments.Object, nodes.Object);
		var removeHandler = new NodeRemoveCommandHandler(environments.Object, nodes.Object);
		var statusHandler = new NodeStatusCommandHandler(environments.Object, nodes.Object);
		using var output = new StringWriter();
		var showInput = new NodeShowCommandInput("web-1", null);
		var removeInput = new NodeRemoveCommandInput("web-1", null);
		var statusInput = new NodeStatusCommandInput("web-1", "ready", null);
		var showContext = new CommandContext<NodeShowCommandInput>(showInput, output, TextWriter.Null, CancellationToken.None);
		var removeContext = new CommandContext<NodeRemoveCommandInput>(removeInput, TextWriter.Null, TextWriter.Null, CancellationToken.None);
		var statusContext = new CommandContext<NodeStatusCommandInput>(statusInput, TextWriter.Null, TextWriter.Null, CancellationToken.None);

		var showExitCode = await showHandler.HandleAsync(showContext);
		var statusExitCode = await statusHandler.HandleAsync(statusContext);
		var removeExitCode = await removeHandler.HandleAsync(removeContext);

		Assert.AreEqual(0, showExitCode);
		Assert.AreEqual(0, statusExitCode);
		Assert.AreEqual(0, removeExitCode);
		var lines = output.ToString().Split(System.Environment.NewLine, StringSplitOptions.RemoveEmptyEntries);
		string[] expectedLabels =
		[
			"node_id",
			"name",
			"status",
			"tags",
			"hostname",
			"public_ip",
			"private_ip",
			"create_date",
			"update_date",
		];
		var nameLine = lines.Single(line => line.StartsWith("name:", StringComparison.Ordinal));
		var createDateLine = lines.Single(line => line.StartsWith("create_date:", StringComparison.Ordinal));
		Assert.AreEqual(expectedLabels.Length, lines.Length);
		for (var index = 0; index < expectedLabels.Length; index++)
		{
			var expectedPrefix = $"{expectedLabels[index]}:";
			Assert.IsTrue(lines[index].StartsWith(expectedPrefix, StringComparison.Ordinal));
		}
		Assert.IsTrue(nameLine.EndsWith("web-1", StringComparison.Ordinal));
		Assert.IsTrue(createDateLine.EndsWith("2026-09-27 12:00:00.000", StringComparison.Ordinal));
		nodes.Verify(item => item.ResolveAsync(environment.Id, "web-1"), Times.Exactly(3));
		nodes.Verify(item => item.SetStatusAsync(environment.Id, nodeId, "ready"), Times.Once());
		nodes.Verify(item => item.DeleteAsync(environment.Id, nodeId), Times.Once());
	}

	[Test]
	public async Task ListSplitsCommaSeparatedTagsForAnyTagMatching()
	{
		var properties = new Dictionary<string, string>();
		var environment = new MarsEnvironment(Guid.CreateVersion7(), "dev", "app", properties);
		var environments = new Mock<IEnvironmentService>();
		environments.Setup(item => item.ResolveAsync(null)).ReturnsAsync(environment);
		IReadOnlyList<string>? capturedTags = null;
		var nodes = new Mock<INodeService>();
		nodes.Setup(item => item.ListAsync(environment.Id, It.IsAny<IReadOnlyList<string>>()))
			.Callback<Guid, IReadOnlyList<string>?>((_, tags) => capturedTags = tags)
			.ReturnsAsync(Array.Empty<Node>());
		var handler = new NodeListCommandHandler(environments.Object, nodes.Object);
		var input = new NodeListCommandInput("web, DB_PRIMARY", null);
		var context = new CommandContext<NodeListCommandInput>(input, TextWriter.Null,
			TextWriter.Null, CancellationToken.None);

		var exitCode = await handler.HandleAsync(context);

		Assert.AreEqual(0, exitCode);
		Assert.IsNotNull(capturedTags);
		Assert.AreEqual(2, capturedTags!.Count);
		Assert.AreEqual("web", capturedTags[0]);
		Assert.AreEqual("DB_PRIMARY", capturedTags[1]);
	}

	[Test]
	public async Task PropertyGetWritesTypedValue()
	{
		var properties = new Dictionary<string, string>();
		var environment = new MarsEnvironment(Guid.CreateVersion7(), "dev", "app", properties);
		var environments = new Mock<IEnvironmentService>();
		environments.Setup(item => item.ResolveAsync(null)).ReturnsAsync(environment);
		var nodeId = Guid.CreateVersion7();
		var date = new DateTimeOffset(2026, 9, 27, 12, 0, 0, TimeSpan.Zero);
		var node = new Node(nodeId, "web-1", null, null, null, "new", date, date,
			new Dictionary<string, JsonElement>(), []);
		using var document = JsonDocument.Parse("true");
		var value = document.RootElement.Clone();
		var nodes = new Mock<INodeService>();
		nodes.Setup(item => item.ResolveAsync(environment.Id, "web-1")).ReturnsAsync(node);
		nodes.Setup(item => item.GetPropertyAsync(environment.Id, nodeId, "docker.installed"))
			.ReturnsAsync(value);
		var handler = new NodePropertyGetCommandHandler(environments.Object, nodes.Object);
		var input = new NodePropertyGetCommandInput("web-1", "docker.installed", null);
		using var output = new StringWriter();
		var context = new CommandContext<NodePropertyGetCommandInput>(input, output,
			TextWriter.Null, CancellationToken.None);

		var exitCode = await handler.HandleAsync(context);

		Assert.AreEqual(0, exitCode);
		Assert.AreEqual("true" + System.Environment.NewLine, output.ToString());
	}

	[Test]
	public async Task PropertyAndTagChangesResolveNodeNames()
	{
		var properties = new Dictionary<string, string>();
		var environment = new MarsEnvironment(Guid.CreateVersion7(), "dev", "app", properties);
		var environments = new Mock<IEnvironmentService>();
		environments.Setup(item => item.ResolveAsync(null)).ReturnsAsync(environment);
		var nodeId = Guid.CreateVersion7();
		var date = new DateTimeOffset(2026, 9, 27, 12, 0, 0, TimeSpan.Zero);
		var node = new Node(nodeId, "web-1", null, null, null, "new", date, date,
			new Dictionary<string, JsonElement>(), []);
		var nodes = new Mock<INodeService>();
		nodes.Setup(item => item.ResolveAsync(environment.Id, "web-1")).ReturnsAsync(node);

		var setHandler = new NodePropertySetCommandHandler(environments.Object, nodes.Object);
		var propertyRemoveHandler = new NodePropertyRemoveCommandHandler(environments.Object, nodes.Object);
		var tagAddHandler = new NodeTagAddCommandHandler(environments.Object, nodes.Object);
		var tagRemoveHandler = new NodeTagRemoveCommandHandler(environments.Object, nodes.Object);
		var setInput = new NodePropertySetCommandInput("web-1", "role", "api", null);
		var propertyRemoveInput = new NodePropertyRemoveCommandInput("web-1", "role", null);
		var tagAddInput = new NodeTagAddCommandInput("web-1", "web", null);
		var tagRemoveInput = new NodeTagRemoveCommandInput("web-1", "web", null);
		var setContext = new CommandContext<NodePropertySetCommandInput>(setInput, TextWriter.Null, TextWriter.Null, CancellationToken.None);
		var propertyRemoveContext = new CommandContext<NodePropertyRemoveCommandInput>(propertyRemoveInput, TextWriter.Null, TextWriter.Null, CancellationToken.None);
		var tagAddContext = new CommandContext<NodeTagAddCommandInput>(tagAddInput, TextWriter.Null, TextWriter.Null, CancellationToken.None);
		var tagRemoveContext = new CommandContext<NodeTagRemoveCommandInput>(tagRemoveInput, TextWriter.Null, TextWriter.Null, CancellationToken.None);

		await setHandler.HandleAsync(setContext);
		await propertyRemoveHandler.HandleAsync(propertyRemoveContext);
		await tagAddHandler.HandleAsync(tagAddContext);
		await tagRemoveHandler.HandleAsync(tagRemoveContext);

		nodes.Verify(item => item.ResolveAsync(environment.Id, "web-1"), Times.Exactly(4));
		nodes.Verify(item => item.SetPropertyAsync(environment.Id, nodeId, "role", "api"), Times.Once());
		nodes.Verify(item => item.RemovePropertyAsync(environment.Id, nodeId, "role"), Times.Once());
		nodes.Verify(item => item.AddTagAsync(environment.Id, nodeId, "web"), Times.Once());
		nodes.Verify(item => item.RemoveTagAsync(environment.Id, nodeId, "web"), Times.Once());
	}
}
