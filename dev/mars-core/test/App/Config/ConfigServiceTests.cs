using Mars.Core.App.Config;
using Mars.Core.Lib;
using Moq;
using NUnit.Framework;
using Assert = NUnit.Framework.Legacy.ClassicAssert;

namespace Mars.Core.Tests.App.Config;

public class ConfigServiceTests
{
	[Test]
	public async Task InitWritesAReadableConfigWithMarsId()
	{
		var directory = Path.Combine(Path.GetTempPath(), "mars-config-test");
		var path = Path.Combine(directory, "mars.yml");
		string? writtenYaml = null;
		var vfs = new Mock<IVfs>();
		vfs.Setup(item => item.WriteTextAsync(path, It.IsAny<string>(), It.IsAny<CancellationToken>()))
			.Callback<string, string, CancellationToken>((_, contents, _) => writtenYaml = contents)
			.Returns(Task.CompletedTask);
		vfs.Setup(item => item.ReadTextAsync(path, It.IsAny<CancellationToken>()))
			.ReturnsAsync(() => writtenYaml!);
		var service = new ConfigService(vfs.Object);

		var created = await service.InitAsync(directory, "My App", "my-app");
		var loaded = await service.ReadAsync(path);

		Assert.AreEqual(7, created.Id.Version);
		Assert.AreEqual(created.Id, loaded.Id);
		Assert.AreEqual("My App", loaded.Name);
		Assert.AreEqual("my-app", loaded.DefaultNamespace);
		Assert.IsTrue(writtenYaml!.StartsWith("mars_id: ", StringComparison.Ordinal));
		Assert.IsFalse(writtenYaml.Contains("\n...", StringComparison.Ordinal));
		vfs.Verify(item => item.WriteTextAsync(path, It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Once());
	}

	[Test]
	public async Task FindWalksParentsAndReturnsTheConfigRoot()
	{
		var root = Path.Combine(Path.GetTempPath(), "mars-config-root");
		var nested = Path.Combine(root, "nested", "child");
		var path = Path.Combine(root, "mars.yml");
		var id = Guid.CreateVersion7();
		var yaml = $"mars_id: {id}\nname: Example\nnamespace: example\n";
		var vfs = new Mock<IVfs>();
		vfs.Setup(item => item.FileExists(path)).Returns(true);
		vfs.Setup(item => item.ReadTextAsync(path, It.IsAny<CancellationToken>())).ReturnsAsync(yaml);
		var service = new ConfigService(vfs.Object);

		var location = await service.FindAsync(nested);

		Assert.AreEqual(root, location.Root);
		Assert.AreEqual(id, location.Config.Id);
		vfs.Verify(item => item.ReadTextAsync(path, It.IsAny<CancellationToken>()), Times.Once());
	}

	[Test]
	public async Task InitReusesAnExistingConfig()
	{
		var directory = Path.Combine(Path.GetTempPath(), "mars-existing-config");
		var path = Path.Combine(directory, "mars.yml");
		var vfs = new Mock<IVfs>();
		vfs.Setup(item => item.FileExists(path)).Returns(true);
		var id = Guid.CreateVersion7();
		var yaml = $"mars_id: {id}\nname: Existing\nnamespace: existing\n";
		vfs.Setup(item => item.ReadTextAsync(path, It.IsAny<CancellationToken>())).ReturnsAsync(yaml);
		var service = new ConfigService(vfs.Object);

		var existing = await service.InitAsync(directory, "new name", "new-namespace");

		Assert.AreEqual(id, existing.Id);
		Assert.AreEqual("Existing", existing.Name);
		vfs.Verify(item => item.WriteTextAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never());
	}

	[Test]
	public void ReadRejectsAnInvalidMarsId()
	{
		var path = Path.Combine(Path.GetTempPath(), "mars-invalid.yml");
		var yaml = "mars_id: invalid\nname: app\nnamespace: app\n";
		var vfs = new Mock<IVfs>();
		vfs.Setup(item => item.ReadTextAsync(path, It.IsAny<CancellationToken>())).ReturnsAsync(yaml);
		var service = new ConfigService(vfs.Object);

		var exception = Assert.ThrowsAsync<UnprocessableException>(async () =>
		{
			await service.ReadAsync(path);
		});

		Assert.IsNotNull(exception);
		Assert.IsTrue(exception!.Message.Contains("mars_id", StringComparison.Ordinal));
	}

	[Test]
	public void ReadRejectsInvalidYamlWithAUsefulCause()
	{
		var path = Path.Combine(Path.GetTempPath(), "mars-malformed.yml");
		var vfs = new Mock<IVfs>();
		vfs.Setup(item => item.ReadTextAsync(path, It.IsAny<CancellationToken>()))
			.ReturnsAsync("name: [unterminated");
		var service = new ConfigService(vfs.Object);

		var error = Assert.ThrowsAsync<UnprocessableException>(async () =>
		{
			await service.ReadAsync(path);
		});

		Assert.IsNotNull(error?.InnerException);
		Assert.AreEqual(path, error?.Data["path"]);
	}

	[Test]
	public void FindReportsWhenNoConfigExists()
	{
		var start = Path.Combine(Path.GetTempPath(), "mars-no-config", "nested");
		var vfs = new Mock<IVfs>();
		var service = new ConfigService(vfs.Object);

		var exception = Assert.ThrowsAsync<NotFoundException>(async () =>
		{
			await service.FindAsync(start);
		});

		Assert.IsNotNull(exception);
		Assert.IsTrue(exception!.Message.Contains("mars init", StringComparison.Ordinal));
	}
}
