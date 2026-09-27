using Mars.Core.App.Config;
using Mars.Core.Lib;
using Mars.Local.App.LocalSshCa;
using Mars.Local.Db;
using Mars.Local.Lib;
using Moq;
using NUnit.Framework;
using Assert = NUnit.Framework.Legacy.ClassicAssert;

namespace Mars.Local.Tests.App.LocalSshCa;

public class SshKeygenToolTests
{
	[Test]
	public void PassphraseStaysOutOfProcessArgumentsAndTemporaryFilesAreRemoved()
	{
		var config = new Config(Guid.CreateVersion7(), "app", "app");
		var vfs = new Mock<IVfs>();
		var marsHome = Path.Combine(TestContext.CurrentContext.WorkDirectory, "test-state", "mars-ssh-keygen-test");
		var database = new DbSession(config, marsHome, vfs.Object);
		ProcessCommand? started = null;
		var process = new Mock<IVProcess>();
		process.Setup(item => item.RunAsync(It.IsAny<ProcessCommand>(), It.IsAny<CancellationToken>()))
			.Callback<ProcessCommand, CancellationToken>((command, _) => started = command)
			.ReturnsAsync(new ProcessResult(1, "", "simulated failure"));
		var timer = new LocalVTimer();
		var tool = new SshKeygenTool(database, "mars.exe", [], vfs.Object, process.Object, timer);

		var exception = Assert.ThrowsAsync<AppException>(async () =>
			await tool.GenerateCaAsync("default", "sensitive-passphrase"));

		Assert.IsNotNull(exception);
		Assert.IsTrue(exception!.Message.Contains("simulated failure", StringComparison.Ordinal));
		Assert.IsNotNull(started);
		Assert.AreEqual("ssh-keygen", started!.Executable);
		Assert.IsFalse(started.Arguments.Any(item => item.Contains("sensitive-passphrase", StringComparison.Ordinal)));
		Assert.IsFalse(started.Environment!.Values.Any(item => item.Contains("sensitive-passphrase", StringComparison.Ordinal)));
		Assert.IsTrue(started.Environment.ContainsKey("SSH_ASKPASS"));
		vfs.Verify(item => item.DeleteDirectory(It.IsAny<string>(), true), Times.Once());
	}
}
