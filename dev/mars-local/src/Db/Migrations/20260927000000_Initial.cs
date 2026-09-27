using Microsoft.Data.Sqlite;

namespace Mars.Local.Db.Migrations;

public class Migration20260927000000Initial : IDbMigration
{
	public string Id => "20260927000000_initial";

	private const string ApplySql = """
        CREATE TABLE environment (
            id TEXT PRIMARY KEY,
            namespace TEXT NOT NULL,
            name TEXT NOT NULL,
            properties_json TEXT NOT NULL DEFAULT '{}',
            UNIQUE(namespace, name)
        );
        CREATE TABLE environment_secret_key (
            environment_id TEXT PRIMARY KEY REFERENCES environment(id) ON DELETE CASCADE,
            kdf_name TEXT NOT NULL,
            kdf_salt BLOB NOT NULL,
            kdf_iterations INTEGER NOT NULL,
            nonce BLOB NOT NULL,
            ciphertext BLOB NOT NULL,
            tag BLOB NOT NULL
        );
        CREATE TABLE kv (
            id TEXT PRIMARY KEY,
            environment_id TEXT NOT NULL REFERENCES environment(id) ON DELETE CASCADE,
            key_path TEXT NOT NULL,
            version INTEGER NOT NULL,
            type TEXT NOT NULL,
            is_secret INTEGER NOT NULL,
            value BLOB,
            size INTEGER NOT NULL,
            nonce BLOB,
            tag BLOB,
            create_date TEXT NOT NULL,
            UNIQUE(environment_id, key_path, version)
        );
        CREATE TABLE ssh_ca (
            environment_id TEXT NOT NULL REFERENCES environment(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            private_key TEXT NOT NULL,
            public_key TEXT NOT NULL,
            passphrase_nonce BLOB NOT NULL,
            passphrase_ciphertext BLOB NOT NULL,
            passphrase_tag BLOB NOT NULL,
            create_date TEXT NOT NULL,
            PRIMARY KEY(environment_id, name)
        );
        CREATE TABLE node (
            id TEXT PRIMARY KEY,
            environment_id TEXT NOT NULL REFERENCES environment(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            public_ip TEXT,
            hostname TEXT,
            private_ip TEXT,
            status TEXT NOT NULL CHECK(status IN ('new', 'bootstrap', 'ready', 'fail')),
            create_date TEXT NOT NULL,
            update_date TEXT NOT NULL,
            UNIQUE(environment_id, name),
            UNIQUE(environment_id, public_ip)
        );
        CREATE TABLE node_property (
            node_id TEXT NOT NULL REFERENCES node(id) ON DELETE CASCADE,
            key TEXT NOT NULL,
            value_json TEXT NOT NULL,
            PRIMARY KEY(node_id, key)
        );
        CREATE TABLE node_tag (
            node_id TEXT NOT NULL REFERENCES node(id) ON DELETE CASCADE,
            tag TEXT NOT NULL,
            PRIMARY KEY(node_id, tag)
        );
        CREATE TABLE node_event (
            id TEXT PRIMARY KEY,
            environment_id TEXT NOT NULL REFERENCES environment(id) ON DELETE CASCADE,
            node_id TEXT NOT NULL,
            action TEXT NOT NULL,
            context_json TEXT NOT NULL,
            create_date TEXT NOT NULL
        );
        CREATE INDEX node_event_by_node ON node_event(environment_id, node_id, create_date, id);
        CREATE TABLE lease (
            id TEXT PRIMARY KEY,
            environment_id TEXT NOT NULL REFERENCES environment(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            owner TEXT NOT NULL,
            token TEXT NOT NULL,
            expire_date TEXT NOT NULL,
            UNIQUE(environment_id, name)
        );
        """;

	private const string RevertSql = """
        DROP TABLE lease;
        DROP TABLE node_event;
        DROP TABLE node_tag;
        DROP TABLE node_property;
        DROP TABLE node;
        DROP TABLE ssh_ca;
        DROP TABLE kv;
        DROP TABLE environment_secret_key;
        DROP TABLE environment;
        """;

	public void Apply(SqliteConnection connection, SqliteTransaction transaction)
	{
		using var command = connection.CreateCommand();
		command.Transaction = transaction;
		command.CommandText = ApplySql;
		command.ExecuteNonQuery();
	}

	public void Revert(SqliteConnection connection, SqliteTransaction transaction)
	{
		using var command = connection.CreateCommand();
		command.Transaction = transaction;
		command.CommandText = RevertSql;
		command.ExecuteNonQuery();
	}
}
