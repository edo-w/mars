using Mars.Core.App.Config;
using Mars.Core.Lib;
using Mars.Local.App.LocalEnvironment;
using Mars.Local.App.LocalLock;
using Mars.Local.Db;
using Mars.Local.Lib;
using Moq;
using NUnit.Framework;
using Assert = NUnit.Framework.Legacy.ClassicAssert;

namespace Mars.Local.Tests.App.LocalLock;

public class LocalLockServiceTests
{
	[Test]
	public async Task ExpiredLockCanBeAcquiredWithoutWaiting()
	{
		var root = Path.Combine(
			TestContext.CurrentContext.WorkDirectory,
			"test-state",
			Guid.NewGuid().ToString("N")
		);
		Directory.CreateDirectory(root);
		var vfs = new LocalVfs();
		var configService = new ConfigService(vfs);
		var config = await configService.InitAsync(root, "app", "app");
		var marsHome = Path.Combine(root, ".mars");
		var database = new StateDbSession(config, marsHome, vfs);
		database.Initialize();
		var environmentRepo = new LocalEnvironmentRepo(database);
		var selection = new LocalEnvironmentSelectionStore(root, vfs);
		var environments = new LocalEnvironmentService(config, environmentRepo, selection);
		var environment = await environments.CreateAsync("dev");

		var now = new DateTimeOffset(2026, 9, 27, 12, 0, 0, TimeSpan.Zero);
		var timer = new Mock<IVTimer>();
		timer.SetupGet(item => item.UtcNow).Returns(() => now);
		var repo = new LocalLockRepo(database);
		var service = new LocalLockService(repo, timer.Object);
		var environmentId = environment.Id;

		var first = await service.AcquireAsync(environmentId, "deploy", "one", TimeSpan.FromMinutes(1));
		var blocked = await service.AcquireAsync(environmentId, "deploy", "two", TimeSpan.FromMinutes(1));
		now = now.AddMinutes(2);
		var second = await service.AcquireAsync(environmentId, "deploy", "two", TimeSpan.FromMinutes(1));

		Assert.IsNotNull(first);
		Assert.IsNull(blocked);
		Assert.IsNotNull(second);
		Assert.AreEqual("two", second!.Owner);
		Assert.AreEqual(now.AddMinutes(1), second.ExpireDate);
	}
}
