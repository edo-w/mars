using Mars.Local.Db.Migrations.Workflow;
using Microsoft.Data.Sqlite;

namespace Mars.Local.Db;

public class WorkflowDbSession
{
	private readonly string connectionString;

	public WorkflowDbSession(string marsHome, Guid? appId)
	{
		var home = Path.GetFullPath(marsHome);
		this.RootDirectory = appId is null
			? home
			: Path.Combine(home, "app", appId.Value.ToString());
		this.DatabasePath = Path.Combine(this.RootDirectory, "workflow.db");
		this.LogDirectory = Path.Combine(this.RootDirectory, "logs", "wf");

		var builder = new SqliteConnectionStringBuilder
		{
			DataSource = this.DatabasePath,
			Mode = SqliteOpenMode.ReadWriteCreate,
		};
		this.connectionString = builder.ToString();
	}

	public string RootDirectory { get; }
	public string DatabasePath { get; }
	public string LogDirectory { get; }

	public void Initialize()
	{
		Directory.CreateDirectory(this.RootDirectory);
		Directory.CreateDirectory(this.LogDirectory);

		using var connection = this.Open();
		IDbMigration[] migrations =
		[
			new Migration20260928000000WorkflowInitial(),
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
