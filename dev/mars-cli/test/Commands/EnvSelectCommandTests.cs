using Mars.Cli.Commands;
using Mars.Core.App.Environment;
using Moq;
using NUnit.Framework;
using Assert = NUnit.Framework.Legacy.ClassicAssert;
using MarsEnvironment = Mars.Core.App.Environment.Environment;

namespace Mars.Cli.Tests.Commands;

public class EnvSelectCommandTests
{
	[Test]
	public async Task SelectPrintsTheResolvedFullName()
	{
		var environment = new MarsEnvironment(Guid.CreateVersion7(), "dev", "app", new Dictionary<string, string>());
		var environments = new Mock<IEnvironmentService>();
		environments.Setup(item => item.SelectAsync("dev")).ReturnsAsync(environment);
		var handler = new EnvSelectCommandHandler(environments.Object);
		var input = new EnvSelectCommandInput("dev");
		using var output = new StringWriter();
		var context = new CommandContext<EnvSelectCommandInput>(input, output, TextWriter.Null, CancellationToken.None);

		var exitCode = await handler.HandleAsync(context);

		Assert.AreEqual(0, exitCode);
		Assert.AreEqual("app/dev" + output.NewLine, output.ToString());
		environments.Verify(item => item.SelectAsync("dev"), Times.Once());
	}
}
