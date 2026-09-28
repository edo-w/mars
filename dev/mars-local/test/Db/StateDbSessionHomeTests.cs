using Mars.Core.App.Config;
using Mars.Core.Lib;
using Mars.Local.Db;
using Moq;
using NUnit.Framework;
using Assert = NUnit.Framework.Legacy.ClassicAssert;

namespace Mars.Local.Tests.Db;

public class StateDbSessionHomeTests
{
	[Test]
	public void DefaultsToMarsDirectoryInsideUserHome()
	{
		var currentDirectory = TestContext.CurrentContext.WorkDirectory;
		var userHome = Path.Combine(currentDirectory, "user-home");
		var process = new Mock<IVProcess>();
		process.SetupGet(item => item.UserHomeDirectory).Returns(userHome);

		var marsHome = StateDbSession.ResolveHome(process.Object);

		Assert.AreEqual(Path.Combine(userHome, ".mars"), marsHome);
	}

	[Test]
	public void ResolvesRelativeMarsHomeFromCurrentDirectory()
	{
		var currentDirectory = TestContext.CurrentContext.WorkDirectory;
		var process = new Mock<IVProcess>();
		process.SetupGet(item => item.CurrentDirectory).Returns(currentDirectory);
		process.Setup(item => item.GetEnvironmentVariable("MARS_HOME")).Returns(".mars/tmp");

		var marsHome = StateDbSession.ResolveHome(process.Object);

		Assert.AreEqual(Path.Combine(currentDirectory, ".mars", "tmp"), marsHome);
	}

	[Test]
	public void UsesAbsoluteMarsHomeWithoutAddingAnotherMarsDirectory()
	{
		var root = TestContext.CurrentContext.WorkDirectory;
		var configuredHome = Path.Combine(root, ".mars", "tmp");
		var process = new Mock<IVProcess>();
		process.SetupGet(item => item.CurrentDirectory).Returns(root);
		process.Setup(item => item.GetEnvironmentVariable("MARS_HOME")).Returns(configuredHome);
		var marsHome = StateDbSession.ResolveHome(process.Object);
		var config = new Config(Guid.CreateVersion7(), "app", "app");
		var vfs = new Mock<IVfs>();

		var session = new StateDbSession(config, marsHome, vfs.Object);

		Assert.AreEqual(configuredHome, marsHome);
		Assert.AreEqual(Path.Combine(configuredHome, "app", config.Id.ToString(), "state.db"), session.DatabasePath);
	}
}
