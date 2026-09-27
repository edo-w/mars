using Mars.Cli.Boot;
using Mars.Cli.Commands;
using Mars.Core.App.Environment;
using Mars.Core.App.SshCa;
using Mars.Core.Lib;
using Microsoft.Extensions.DependencyInjection;
using Moq;
using NUnit.Framework;
using Assert = NUnit.Framework.Legacy.ClassicAssert;
using MarsEnvironment = Mars.Core.App.Environment.Environment;

namespace Mars.Cli.Tests.Commands;

public class SshCaIssueCommandTests
{
	[Test]
	public async Task IssueDefaultsToTheDefaultCaUserIdentityAndTimestampedCurrentDirectoryPath()
	{
		var directory = Path.Combine(TestContext.CurrentContext.WorkDirectory, "issue-default-output");
		var expectedPath = Path.Combine(directory, "default_20260927140506");
		var environment = new MarsEnvironment(Guid.CreateVersion7(), "dev", "app", new Dictionary<string, string>());
		var environments = new Mock<IEnvironmentService>();
		environments.Setup(item => item.ResolveAsync(null)).ReturnsAsync(environment);
		var sshCa = new Mock<ISshCaService>();
		sshCa.Setup(item => item.IssueAsync(environment.Id, "default", "alice", "alice"))
			.ReturnsAsync(new SshClientIdentity("private key", "certificate"));
		var vfs = new Mock<IVfs>();
		vfs.Setup(item => item.CreateNewFile(It.IsAny<string>(), It.IsAny<bool>()))
			.Returns(() => new MemoryStream());
		var process = new Mock<IVProcess>();
		process.SetupGet(item => item.CurrentDirectory).Returns(directory);
		var timer = new Mock<IVTimer>();
		timer.SetupGet(item => item.UtcNow)
			.Returns(new DateTimeOffset(2026, 9, 27, 14, 5, 6, TimeSpan.Zero));
		var services = new ServiceCollection();
		services.AddSingleton(environments.Object);
		services.AddSingleton(sshCa.Object);
		services.AddSingleton(vfs.Object);
		services.AddSingleton(process.Object);
		services.AddSingleton(timer.Object);
		services.AddTransient<SshCaIssueCommandHandler>();
		using var container = services.BuildServiceProvider();
		var command = CliCommands.Create(container);
		var parsed = command.Parse(["sshca", "issue", "--user", "alice"]);
		using var output = new StringWriter();
		parsed.InvocationConfiguration.Output = output;

		var exitCode = await parsed.InvokeAsync();

		Assert.IsEmpty(parsed.Errors);
		Assert.AreEqual(0, exitCode);
		Assert.AreEqual($"{expectedPath}{output.NewLine}{expectedPath}-cert.pub{output.NewLine}", output.ToString());
		sshCa.Verify(item => item.IssueAsync(environment.Id, "default", "alice", "alice"), Times.Once());
		vfs.Verify(item => item.CreateNewFile(expectedPath, true), Times.Once());
		vfs.Verify(item => item.CreateNewFile(expectedPath + "-cert.pub", false), Times.Once());
	}

	[Test]
	public async Task IssueAcceptsNameIdentityOutputAndEnvironmentOverrides()
	{
		var outputPath = Path.Combine(TestContext.CurrentContext.WorkDirectory, "custom-identity");
		var environment = new MarsEnvironment(Guid.CreateVersion7(), "prod", "team", new Dictionary<string, string>());
		var environments = new Mock<IEnvironmentService>();
		environments.Setup(item => item.ResolveAsync("team/prod")).ReturnsAsync(environment);
		var sshCa = new Mock<ISshCaService>();
		sshCa.Setup(item => item.IssueAsync(environment.Id, "main", "deployment-42", "deploy"))
			.ReturnsAsync(new SshClientIdentity("private key", "certificate"));
		var vfs = new Mock<IVfs>();
		vfs.Setup(item => item.CreateNewFile(It.IsAny<string>(), It.IsAny<bool>()))
			.Returns(() => new MemoryStream());
		var process = new Mock<IVProcess>();
		process.SetupGet(item => item.CurrentDirectory)
			.Returns(TestContext.CurrentContext.WorkDirectory);
		var timer = new Mock<IVTimer>();
		var services = new ServiceCollection();
		services.AddSingleton(environments.Object);
		services.AddSingleton(sshCa.Object);
		services.AddSingleton(vfs.Object);
		services.AddSingleton(process.Object);
		services.AddSingleton(timer.Object);
		services.AddTransient<SshCaIssueCommandHandler>();
		using var container = services.BuildServiceProvider();
		var command = CliCommands.Create(container);
		var parsed = command.Parse([
			"sshca", "issue", "--name", "main", "--user", "deploy",
			"--identity", "deployment-42", "--output", outputPath, "--env", "team/prod",
		]);

		var exitCode = await parsed.InvokeAsync();

		Assert.IsEmpty(parsed.Errors);
		Assert.AreEqual(0, exitCode);
		sshCa.Verify(item => item.IssueAsync(environment.Id, "main", "deployment-42", "deploy"), Times.Once());
		vfs.Verify(item => item.CreateNewFile(outputPath, true), Times.Once());
		vfs.Verify(item => item.CreateNewFile(outputPath + "-cert.pub", false), Times.Once());
	}

	[Test]
	public void IssueRequiresUserAndRejectsOldPositionalArguments()
	{
		using var container = new ServiceCollection().BuildServiceProvider();
		var command = CliCommands.Create(container);

		var missingUser = command.Parse(["sshca", "issue"]);
		var positional = command.Parse(["sshca", "issue", "default", "alice", "alice", "key"]);

		Assert.IsNotEmpty(missingUser.Errors);
		Assert.IsNotEmpty(positional.Errors);
	}
}
