using Microsoft.Data.Sqlite;

namespace Mars.Local.Db.Migrations.Workflow;

public class Migration20260928000000WorkflowInitial : IDbMigration
{
	public string Id => "20260928000000_workflow_initial";

	public void Apply(SqliteConnection connection, SqliteTransaction transaction)
	{
		var sql = """
			CREATE TABLE workflow_run (
				id TEXT PRIMARY KEY,
				source_path TEXT NOT NULL,
				manifest_path TEXT,
				state TEXT NOT NULL,
				create_date TEXT NOT NULL,
				end_date TEXT,
				input_json TEXT,
				output_json TEXT,
				error TEXT
			);
			CREATE TABLE workflow_step (
				id TEXT PRIMARY KEY,
				run_id TEXT NOT NULL REFERENCES workflow_run(id) ON DELETE CASCADE,
				source_id TEXT NOT NULL,
				source_path TEXT NOT NULL,
				source_line INTEGER NOT NULL,
				source_column INTEGER NOT NULL,
				kind TEXT NOT NULL,
				target TEXT NOT NULL,
				state TEXT NOT NULL,
				create_date TEXT NOT NULL,
				end_date TEXT,
				input_json TEXT,
				output_json TEXT,
				error TEXT
			);
			CREATE TABLE workflow_event (
				id TEXT PRIMARY KEY,
				run_id TEXT NOT NULL REFERENCES workflow_run(id) ON DELETE CASCADE,
				step_id TEXT REFERENCES workflow_step(id) ON DELETE SET NULL,
				name TEXT NOT NULL,
				message TEXT,
				data_json TEXT,
				create_date TEXT NOT NULL
			);
			CREATE INDEX workflow_step_run_id ON workflow_step(run_id);
			CREATE INDEX workflow_event_run_id ON workflow_event(run_id);
			""";
		using var command = connection.CreateCommand();
		command.Transaction = transaction;
		command.CommandText = sql;
		command.ExecuteNonQuery();
	}

	public void Revert(SqliteConnection connection, SqliteTransaction transaction)
	{
		var sql = """
			DROP TABLE workflow_event;
			DROP TABLE workflow_step;
			DROP TABLE workflow_run;
			""";
		using var command = connection.CreateCommand();
		command.Transaction = transaction;
		command.CommandText = sql;
		command.ExecuteNonQuery();
	}
}
