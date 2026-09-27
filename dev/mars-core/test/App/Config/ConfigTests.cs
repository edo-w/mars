using Mars.Core.App.Environment;
using Mars.Core.App.Config;
using Mars.Core.Lib;
using NUnit.Framework;
using Assert = NUnit.Framework.Legacy.ClassicAssert;
using ConfigType = Mars.Core.App.Config.Config;
using Environment = Mars.Core.App.Environment.Environment;

namespace Mars.Core.Tests.App.Config;

public class ConfigTests
{
	[Test]
	public void AppRequiresUuidv7AndEnvironmentNameKeepsNamespace()
	{
		Assert.Throws<UnprocessableException>(() => new ConfigType(Guid.NewGuid(), "Application", "app"));

		var app = new ConfigType(Guid.CreateVersion7(), "Application", "team");
		var environment = new Environment(Guid.CreateVersion7(), "dev", app.DefaultNamespace,
			new Dictionary<string, string>());

		Assert.AreEqual("team/dev", environment.FullName);
	}

	[Test]
	public void AppNameDerivesDefaultNamespace()
	{
		var defaultNamespace = ConfigType.FromAppName("My Application");

		Assert.AreEqual("my-application", defaultNamespace);
	}
}
