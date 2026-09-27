using Mars.Cli.Boot;
using Mars.Core.Lib;
using Moq;
using NUnit.Framework;
using Assert = NUnit.Framework.Legacy.ClassicAssert;

namespace Mars.Cli.Tests.Boot;

public class ConsolePasswordSourceTests
{
	[Test]
	public void EnvironmentPasswordUsesNameThenFallsBackToDefault()
	{
		const string scopedName = "MARS_SECRETS_PASSWORD_TEST_ENV";
		const string defaultName = "MARS_SECRETS_PASSWORD";
		var values = new Dictionary<string, string?>
		{
			[scopedName] = "specific",
			[defaultName] = "fallback",
		};
		var process = new Mock<IVProcess>();
		process.Setup(item => item.GetEnvironmentVariable(It.IsAny<string>()))
			.Returns((string name) => values.GetValueOrDefault(name));
		var source = new ConsolePasswordSource(process.Object);

		var scopedPassword = source.GetPassword("test-env");
		Assert.AreEqual("specific", scopedPassword);

		values.Remove(scopedName);
		var defaultPassword = source.GetPassword("test-env");
		Assert.AreEqual("fallback", defaultPassword);

		values.Remove(defaultName);
		Assert.Throws<UnprocessableException>(() => source.GetPassword("test-env"));
	}
}
