using Mars.Cli.Commands;
using Mars.Core.App.Environment;
using Moq;
using NUnit.Framework;
using Assert = NUnit.Framework.Legacy.ClassicAssert;
using MarsEnvironment = Mars.Core.App.Environment.Environment;

namespace Mars.Cli.Tests.Commands;

public class EnvShowCommandTests
{
	[Test]
	public async Task ShowLabelsTheEnvironmentId()
	{
		var environmentId = Guid.CreateVersion7();
		var properties = new Dictionary<string, string>();
		var environment = new MarsEnvironment(environmentId, "dev", "app", properties);
		var environments = new Mock<IEnvironmentService>();
		environments.Setup(item => item.ResolveAsync("app/dev")).ReturnsAsync(environment);
		var handler = new EnvShowCommandHandler(environments.Object);
		var input = new EnvShowCommandInput("app/dev");
		using var output = new StringWriter();
		var context = new CommandContext<EnvShowCommandInput>(
			input,
			output,
			TextWriter.Null,
			CancellationToken.None
		);

		var exitCode = await handler.HandleAsync(context);

		var firstLine = output.ToString().Split(System.Environment.NewLine)[0];
		Assert.AreEqual(0, exitCode);
		Assert.IsTrue(firstLine.StartsWith("env_id:", StringComparison.Ordinal));
		Assert.IsTrue(firstLine.EndsWith(environmentId.ToString(), StringComparison.Ordinal));
	}
}
