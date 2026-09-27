using Mars.Core.App.Config;
using Mars.Core.Lib;
using Mars.Local.Db.Migrations;
using Microsoft.Data.Sqlite;

namespace Mars.Local.Db;

public class DbSession
{
	private readonly string connectionString;
	private readonly IVfs vfs;

	public DbSession(Config config, string marsHome, IVfs vfs)
	{
		this.vfs = vfs;

		var homePath = Path.GetFullPath(marsHome);
		this.AppDirectory = Path.Combine(homePath, "app", config.Id.ToString());
		this.DatabasePath = Path.Combine(this.AppDirectory, "state.db");

		var builder = new SqliteConnectionStringBuilder
		{
			DataSource = this.DatabasePath,
			Mode = SqliteOpenMode.ReadWriteCreate,
		};
		this.connectionString = builder.ToString();
	}

	public string DatabasePath { get; }
	public string AppDirectory { get; }

	public static string ResolveHome(IVProcess process)
	{
		var configuredHome = process.GetEnvironmentVariable("MARS_HOME");
		if (string.IsNullOrWhiteSpace(configuredHome))
		{
			var userHome = process.UserHomeDirectory;
			var defaultHome = Path.Combine(userHome, ".mars");

			return defaultHome;
		}

		var currentDirectory = process.CurrentDirectory;
		var homePath = Path.GetFullPath(configuredHome, currentDirectory);

		return homePath;
	}

	public void Initialize()
	{
		this.vfs.CreateDirectory(this.AppDirectory);

		using var connection = this.Open();

		IDbMigration[] migrations =
		[
			new Migration20260927000000Initial(),
		];

		var migrator = new DbMigrator(migrations);
		migrator.ApplyAll(connection);
	}

	public SqliteConnection Open()
	{
		var connection = new SqliteConnection(this.connectionString);
		connection.Open();

		using var command = connection.CreateCommand();
		command.CommandText = "PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;";
		command.ExecuteNonQuery();

		return connection;
	}
}
