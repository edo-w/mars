using System.Text;
using Mars.Cli.Commands;
using Mars.Core.App.Environment;
using Mars.Core.App.SshCa;
using Mars.Core.Lib;
using Moq;
using NUnit.Framework;
using Assert = NUnit.Framework.Legacy.ClassicAssert;
using MarsEnvironment = Mars.Core.App.Environment.Environment;

namespace Mars.Cli.Tests.Commands;

public class SshCaRemoveCommandTests
{
	[Test]
	public async Task DeleteRequiresTheExactCaName()
	{
		var properties = new Dictionary<string, string>();
		var environment = new MarsEnvironment(Guid.CreateVersion7(), "dev", "app", properties);
		var environments = new Mock<IEnvironmentService>();
		environments.Setup(item => item.ResolveAsync(null)).ReturnsAsync(environment);
		var ca = new SshCaInfo("main", "ssh-ed25519 example", DateTimeOffset.UtcNow);
		var sshCa = new Mock<ISshCaService>();
		sshCa.Setup(item => item.GetAsync(environment.Id, "main")).ReturnsAsync(ca);
		var inputBytes = Encoding.UTF8.GetBytes("wrong\n");
		var process = new Mock<IVProcess>();
		process.Setup(item => item.OpenStandardInput()).Returns(new MemoryStream(inputBytes));
		var handler = new SshCaRemoveCommandHandler(environments.Object, sshCa.Object, process.Object);
		using var output = new StringWriter();
		using var error = new StringWriter();
		var commandInput = new SshCaRemoveCommandInput("main", null);
		var context = new CommandContext<SshCaRemoveCommandInput>(commandInput, output, error,
			CancellationToken.None);

		var exitCode = await handler.HandleAsync(context);

		Assert.AreEqual(1, exitCode);
		Assert.IsTrue(output.ToString().Contains("Type 'main'", StringComparison.Ordinal));
		sshCa.Verify(item => item.DeleteAsync(It.IsAny<Guid>(), It.IsAny<string>()), Times.Never());
	}

	[Test]
	public async Task DeleteRunsAfterMatchingConfirmation()
	{
		var properties = new Dictionary<string, string>();
		var environment = new MarsEnvironment(Guid.CreateVersion7(), "dev", "app", properties);
		var environments = new Mock<IEnvironmentService>();
		environments.Setup(item => item.ResolveAsync(null)).ReturnsAsync(environment);
		var ca = new SshCaInfo("main", "ssh-ed25519 example", DateTimeOffset.UtcNow);
		var sshCa = new Mock<ISshCaService>();
		sshCa.Setup(item => item.GetAsync(environment.Id, "main")).ReturnsAsync(ca);
		sshCa.Setup(item => item.DeleteAsync(environment.Id, "main")).Returns(Task.CompletedTask);
		var inputBytes = Encoding.UTF8.GetBytes("main\n");
		var process = new Mock<IVProcess>();
		process.Setup(item => item.OpenStandardInput()).Returns(new MemoryStream(inputBytes));
		var handler = new SshCaRemoveCommandHandler(environments.Object, sshCa.Object, process.Object);
		using var output = new StringWriter();
		var commandInput = new SshCaRemoveCommandInput("main", null);
		var context = new CommandContext<SshCaRemoveCommandInput>(commandInput, output, TextWriter.Null,
			CancellationToken.None);

		var exitCode = await handler.HandleAsync(context);

		Assert.AreEqual(0, exitCode);
		sshCa.Verify(item => item.DeleteAsync(environment.Id, "main"), Times.Once());
	}
}
