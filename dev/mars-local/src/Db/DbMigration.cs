using Microsoft.Data.Sqlite;
using Mars.Core.Lib;

namespace Mars.Local.Db;

public interface IDbMigration
{
	string Id { get; }
	void Apply(SqliteConnection connection, SqliteTransaction transaction);
	void Revert(SqliteConnection connection, SqliteTransaction transaction);
}

public class DbMigrator
{
	private readonly IDbMigration[] migrations;

	public DbMigrator(IReadOnlyList<IDbMigration> migrations)
	{
		this.migrations = [.. migrations];
		Array.Sort(this.migrations, (left, right) => StringComparer.Ordinal.Compare(left.Id, right.Id));

		var uniqueIds = new HashSet<string>(StringComparer.Ordinal);
		foreach (var migration in this.migrations)
		{
			var isNewId = uniqueIds.Add(migration.Id);
			if (!isNewId)
			{
				throw new AppException("Migration IDs must be unique.");
			}
		}
	}

	public void ApplyAll(SqliteConnection connection)
	{
		EnsureHistory(connection);

		using var transaction = connection.BeginTransaction();
		var applied = ReadApplied(connection, transaction);

		var knownIds = new HashSet<string>(StringComparer.Ordinal);
		foreach (var migration in this.migrations)
		{
			knownIds.Add(migration.Id);
		}

		foreach (var appliedId in applied)
		{
			var isKnown = knownIds.Contains(appliedId);
			if (!isKnown)
			{
				throw new UnprocessableException($"Database contains unknown migration '{appliedId}'. Update Mars to a compatible version.");
			}
		}

		foreach (var migration in this.migrations)
		{
			if (applied.Contains(migration.Id))
			{
				continue;
			}

			migration.Apply(connection, transaction);

			using var record = connection.CreateCommand();
			record.Transaction = transaction;
			record.CommandText = "INSERT INTO schema_migration(id) VALUES($id)";
			record.Parameters.AddWithValue("$id", migration.Id);
			record.ExecuteNonQuery();
		}

		transaction.Commit();
	}

	public void RevertLast(SqliteConnection connection)
	{
		EnsureHistory(connection);
		using var transaction = connection.BeginTransaction();
		var applied = ReadApplied(connection, transaction);
		var orderedApplied = applied.OrderByDescending(item => item, StringComparer.Ordinal);
		var last = orderedApplied.FirstOrDefault();

		if (last is null)
		{
			transaction.Commit();
			return;
		}

		var migration = this.migrations.SingleOrDefault(item => item.Id == last);

		if (migration is null)
		{
			throw new UnprocessableException($"Database contains unknown migration '{last}'. Update Mars to a compatible version.");
		}

		migration.Revert(connection, transaction);

		using var remove = connection.CreateCommand();
		remove.Transaction = transaction;
		remove.CommandText = "DELETE FROM schema_migration WHERE id=$id";
		remove.Parameters.AddWithValue("$id", last);
		remove.ExecuteNonQuery();

		transaction.Commit();
	}

	private static void EnsureHistory(SqliteConnection connection)
	{
		using var command = connection.CreateCommand();
		command.CommandText = "CREATE TABLE IF NOT EXISTS schema_migration(id TEXT PRIMARY KEY)";
		command.ExecuteNonQuery();
	}

	private static HashSet<string> ReadApplied(SqliteConnection connection, SqliteTransaction transaction)
	{
		using var command = connection.CreateCommand();
		command.Transaction = transaction;
		command.CommandText = "SELECT id FROM schema_migration";

		using var reader = command.ExecuteReader();
		var ids = new HashSet<string>(StringComparer.Ordinal);

		while (reader.Read())
		{
			ids.Add(reader.GetString(0));
		}

		return ids;
	}
}
