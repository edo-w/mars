using Mars.Local.Db.Migrations.State;
using Mars.Core.App.Config;
using Mars.Local.Lib;
using Mars.Local.Db;
using NUnit.Framework;
using Assert = NUnit.Framework.Legacy.ClassicAssert;

namespace Mars.Local.Tests.Db;

public class MigrationTests
{
	[Test]
	public async Task MigrationAppliesRevertsAndReapplies()
	{
		var root = Path.Combine(
			TestContext.CurrentContext.WorkDirectory,
			"test-state",
			Guid.NewGuid().ToString("N")
		);
		Directory.CreateDirectory(root);

		var vfs = new LocalVfs();
		var configService = new ConfigService(vfs);
		var config = await configService.InitAsync(root, "Migration Test", "app");
		var marsHome = Path.Combine(root, ".mars");
		var session = new StateDbSession(config, marsHome, vfs);
		session.Initialize();

		IDbMigration[] migrations =
		[
			new Migration20260927000000Initial(),
		];
		var migrator = new DbMigrator(migrations);

		using (var connection = session.Open())
		{
			migrator.RevertLast(connection);
			using var command = connection.CreateCommand();
			command.CommandText = "SELECT count(*) FROM sqlite_master WHERE name='node'";
			Assert.AreEqual(0L, command.ExecuteScalar());
		}

		using (var connection = session.Open())
		using (var command = connection.CreateCommand())
		{
			command.CommandText = "SELECT count(*) FROM sqlite_master WHERE name='node'";
			Assert.AreEqual(0L, command.ExecuteScalar());
		}

		session.Initialize();

		using (var connection = session.Open())
		using (var command = connection.CreateCommand())
		{
			command.CommandText = "SELECT count(*) FROM sqlite_master WHERE name='node'";
			Assert.AreEqual(1L, command.ExecuteScalar());
		}
	}
}
