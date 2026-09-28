using Dapper;
using Mars.Core.Lib;
using Mars.Local.Db;
using Microsoft.Data.Sqlite;

namespace Mars.Local.App.LocalNode;

public class LocalNodeRepo
{
	private readonly StateDbSession session;
	private readonly IVTimer timer;

	public LocalNodeRepo(StateDbSession session, IVTimer timer)
	{
		this.session = session;
		this.timer = timer;
	}

	public void Create(NodeModel model, string contextJson)
	{
		const string sql = """
            INSERT INTO node (
                id,
                environment_id,
                name,
                public_ip,
                hostname,
                private_ip,
                status,
                create_date,
                update_date
            )
            VALUES (
                @Id,
                @EnvironmentId,
                @Name,
                @PublicIp,
                @Hostname,
                @PrivateIp,
                @Status,
                @CreateDate,
                @UpdateDate
            )
            """;
		var parameters = new
		{
			Id = model.Id.ToString(),
			EnvironmentId = model.EnvironmentId.ToString(),
			model.Name,
			model.PublicIp,
			model.Hostname,
			model.PrivateIp,
			model.Status,
			model.CreateDate,
			model.UpdateDate,
		};
		var nodeEvent = NewEvent(model.EnvironmentId, model.Id, "create", contextJson);

		using var connection = this.session.Open();
		using var transaction = connection.BeginTransaction();
		try
		{
			connection.Execute(sql, parameters, transaction);
		}
		catch (SqliteException exception) when (exception.SqliteExtendedErrorCode is 2067 or 1555)
		{
			var error = new ConflictException($"Node '{model.Name}' already exists in this environment.", exception);
			error.Data["node"] = model.Name;

			throw error;
		}

		RecordEvent(connection, transaction, nodeEvent);
		transaction.Commit();
	}

	public NodeDetailViewModel? Get(Guid environmentId, Guid nodeId)
	{
		using var connection = this.session.Open();
		var node = ReadNode(connection, environmentId, nodeId);
		if (node is null)
		{
			return null;
		}

		var detail = ReadDetail(connection, node);

		return detail;
	}

	public NodeDetailViewModel? GetByName(Guid environmentId, string name)
	{
		const string sql = """
            SELECT
                id AS Id,
                environment_id AS EnvironmentId,
                name AS Name,
                public_ip AS PublicIp,
                hostname AS Hostname,
                private_ip AS PrivateIp,
                status AS Status,
                create_date AS CreateDate,
                update_date AS UpdateDate
            FROM node
            WHERE environment_id = @EnvironmentId
                AND name = @Name
            """;
		var parameters = new
		{
			EnvironmentId = environmentId.ToString(),
			Name = name,
		};

		using var connection = this.session.Open();
		var node = connection.QuerySingleOrDefault<NodeModel>(sql, parameters);
		if (node is null)
		{
			return null;
		}

		var detail = ReadDetail(connection, node);

		return detail;
	}

	public IReadOnlyList<NodeDetailViewModel> List(Guid environmentId, IReadOnlyList<string>? tags)
	{
		const string allSql = """
            SELECT
                id AS Id,
                environment_id AS EnvironmentId,
                name AS Name,
                public_ip AS PublicIp,
                hostname AS Hostname,
                private_ip AS PrivateIp,
                status AS Status,
                create_date AS CreateDate,
                update_date AS UpdateDate
            FROM node
            WHERE environment_id = @EnvironmentId
            ORDER BY name
            """;
		const string taggedSql = """
            SELECT
                node.id AS Id,
                node.environment_id AS EnvironmentId,
                node.name AS Name,
                node.public_ip AS PublicIp,
                node.hostname AS Hostname,
                node.private_ip AS PrivateIp,
                node.status AS Status,
                node.create_date AS CreateDate,
                node.update_date AS UpdateDate
            FROM node
            WHERE node.environment_id = @EnvironmentId
                AND EXISTS (
                    SELECT 1
                    FROM node_tag
                    WHERE node_tag.node_id = node.id
                        AND instr(',' || @TagsCsv || ',', ',' || node_tag.tag || ',') > 0
                )
            ORDER BY node.name
            """;
		var parameters = new
		{
			EnvironmentId = environmentId.ToString(),
			TagsCsv = tags is null ? "" : string.Join(',', tags),
		};

		using var connection = this.session.Open();
		IEnumerable<NodeModel> nodes;
		if (tags is null || tags.Count == 0)
		{
			nodes = connection.Query<NodeModel>(allSql, parameters);
		}
		else
		{
			nodes = connection.Query<NodeModel>(taggedSql, parameters);
		}

		var details = new List<NodeDetailViewModel>();
		foreach (var node in nodes)
		{
			var detail = ReadDetail(connection, node);
			details.Add(detail);
		}

		return details;
	}

	public void Delete(Guid environmentId, Guid nodeId, string contextJson)
	{
		const string sql = """
            DELETE FROM node
            WHERE id = @Id
                AND environment_id = @EnvironmentId
            """;
		var parameters = new
		{
			Id = nodeId.ToString(),
			EnvironmentId = environmentId.ToString(),
		};
		var nodeEvent = NewEvent(environmentId, nodeId, "delete", contextJson);

		using var connection = this.session.Open();
		using var transaction = connection.BeginTransaction();
		var deletedRows = connection.Execute(sql, parameters, transaction);
		if (deletedRows == 0)
		{
			throw new NotFoundException($"Node '{nodeId}' not found.");
		}

		RecordEvent(connection, transaction, nodeEvent);
		transaction.Commit();
	}

	public void SetStatus(Guid environmentId, Guid nodeId, string status, string contextJson)
	{
		const string sql = """
            UPDATE node
            SET status = @Status,
                update_date = @UpdateDate
            WHERE id = @Id
            """;
		var parameters = new
		{
			Status = status,
			UpdateDate = this.timer.UtcNow.ToString("O"),
			Id = nodeId.ToString(),
		};
		var nodeEvent = NewEvent(environmentId, nodeId, "set-status", contextJson);

		using var connection = this.session.Open();
		using var transaction = connection.BeginTransaction();
		EnsureNode(connection, transaction, environmentId, nodeId);
		connection.Execute(sql, parameters, transaction);
		RecordEvent(connection, transaction, nodeEvent);
		transaction.Commit();
	}

	public void SetProperty(Guid environmentId, NodePropertyModel model, string contextJson)
	{
		const string sql = """
            INSERT INTO node_property (
                node_id,
                key,
                value_json
            )
            VALUES (
                @NodeId,
                @Key,
                @ValueJson
            )
            ON CONFLICT (
                node_id,
                key
            )
            DO UPDATE SET value_json = excluded.value_json
            """;
		var parameters = new
		{
			NodeId = model.NodeId.ToString(),
			model.Key,
			model.ValueJson,
		};
		var nodeEvent = NewEvent(environmentId, model.NodeId, "set-property", contextJson);

		using var connection = this.session.Open();
		using var transaction = connection.BeginTransaction();
		EnsureNode(connection, transaction, environmentId, model.NodeId);
		connection.Execute(sql, parameters, transaction);
		TouchNode(connection, transaction, model.NodeId, this.timer.UtcNow);
		RecordEvent(connection, transaction, nodeEvent);
		transaction.Commit();
	}

	public void RemoveProperty(Guid environmentId, Guid nodeId, string key, string contextJson)
	{
		const string sql = """
            DELETE FROM node_property
            WHERE node_id = @NodeId
                AND key = @Key
            """;
		var parameters = new
		{
			NodeId = nodeId.ToString(),
			Key = key,
		};
		var nodeEvent = NewEvent(environmentId, nodeId, "remove-property", contextJson);

		using var connection = this.session.Open();
		using var transaction = connection.BeginTransaction();
		EnsureNode(connection, transaction, environmentId, nodeId);
		var deletedRows = connection.Execute(sql, parameters, transaction);
		if (deletedRows > 0)
		{
			TouchNode(connection, transaction, nodeId, this.timer.UtcNow);
			RecordEvent(connection, transaction, nodeEvent);
		}

		transaction.Commit();
	}

	public void AddTag(Guid environmentId, NodeTagModel model, string contextJson)
	{
		const string sql = """
            INSERT OR IGNORE INTO node_tag (
                node_id,
                tag
            )
            VALUES (
                @NodeId,
                @Tag
            )
            """;
		var parameters = new
		{
			NodeId = model.NodeId.ToString(),
			model.Tag,
		};
		var nodeEvent = NewEvent(environmentId, model.NodeId, "add-tag", contextJson);

		using var connection = this.session.Open();
		using var transaction = connection.BeginTransaction();
		EnsureNode(connection, transaction, environmentId, model.NodeId);
		var insertedRows = connection.Execute(sql, parameters, transaction);
		if (insertedRows > 0)
		{
			TouchNode(connection, transaction, model.NodeId, this.timer.UtcNow);
			RecordEvent(connection, transaction, nodeEvent);
		}

		transaction.Commit();
	}

	public void RemoveTag(Guid environmentId, Guid nodeId, string tag, string contextJson)
	{
		const string sql = """
            DELETE FROM node_tag
            WHERE node_id = @NodeId
                AND tag = @Tag
            """;
		var parameters = new
		{
			NodeId = nodeId.ToString(),
			Tag = tag,
		};
		var nodeEvent = NewEvent(environmentId, nodeId, "remove-tag", contextJson);

		using var connection = this.session.Open();
		using var transaction = connection.BeginTransaction();
		EnsureNode(connection, transaction, environmentId, nodeId);
		var deletedRows = connection.Execute(sql, parameters, transaction);
		if (deletedRows > 0)
		{
			TouchNode(connection, transaction, nodeId, this.timer.UtcNow);
			RecordEvent(connection, transaction, nodeEvent);
		}

		transaction.Commit();
	}

	public IReadOnlyList<NodeEventModel> ListEvents(Guid environmentId, Guid? nodeId)
	{
		const string allSql = """
            SELECT
                id AS Id,
                environment_id AS EnvironmentId,
                node_id AS NodeId,
                action AS Action,
                context_json AS ContextJson,
                create_date AS CreateDate
            FROM node_event
            WHERE environment_id = @EnvironmentId
            ORDER BY
                create_date,
                id
            """;
		const string byNodeSql = """
            SELECT
                id AS Id,
                environment_id AS EnvironmentId,
                node_id AS NodeId,
                action AS Action,
                context_json AS ContextJson,
                create_date AS CreateDate
            FROM node_event
            WHERE environment_id = @EnvironmentId
                AND node_id = @NodeId
            ORDER BY
                create_date,
                id
            """;
		var parameters = new
		{
			EnvironmentId = environmentId.ToString(),
			NodeId = nodeId?.ToString(),
		};

		using var connection = this.session.Open();
		IEnumerable<NodeEventModel> events;
		if (nodeId is null)
		{
			events = connection.Query<NodeEventModel>(allSql, parameters);
		}
		else
		{
			events = connection.Query<NodeEventModel>(byNodeSql, parameters);
		}

		var result = events.ToArray();

		return result;
	}

	private static NodeModel? ReadNode(SqliteConnection connection, Guid environmentId, Guid nodeId)
	{
		const string sql = """
            SELECT
                id AS Id,
                environment_id AS EnvironmentId,
                name AS Name,
                public_ip AS PublicIp,
                hostname AS Hostname,
                private_ip AS PrivateIp,
                status AS Status,
                create_date AS CreateDate,
                update_date AS UpdateDate
            FROM node
            WHERE id = @Id
                AND environment_id = @EnvironmentId
            """;
		var parameters = new
		{
			Id = nodeId.ToString(),
			EnvironmentId = environmentId.ToString(),
		};

		var node = connection.QuerySingleOrDefault<NodeModel>(sql, parameters);

		return node;
	}

	private static NodeDetailViewModel ReadDetail(SqliteConnection connection, NodeModel model)
	{
		const string propertySql = """
            SELECT
                node_id AS NodeId,
                key AS Key,
                value_json AS ValueJson
            FROM node_property
            WHERE node_id = @NodeId
            ORDER BY key
            """;
		const string tagSql = """
            SELECT
                node_id AS NodeId,
                tag AS Tag
            FROM node_tag
            WHERE node_id = @NodeId
            ORDER BY tag
            """;
		var parameters = new { NodeId = model.Id.ToString() };
		var properties = connection.Query<NodePropertyModel>(propertySql, parameters).ToArray();
		var tags = connection.Query<NodeTagModel>(tagSql, parameters).ToArray();
		var detail = new NodeDetailViewModel
		{
			Node = model,
			Properties = properties,
			Tags = tags,
		};

		return detail;
	}

	private static void EnsureNode(
		SqliteConnection connection,
		SqliteTransaction transaction,
		Guid environmentId,
		Guid nodeId
	)
	{
		const string sql = """
            SELECT 1
            FROM node
            WHERE id = @Id
                AND environment_id = @EnvironmentId
            """;
		var parameters = new
		{
			Id = nodeId.ToString(),
			EnvironmentId = environmentId.ToString(),
		};
		var found = connection.QuerySingleOrDefault<int?>(sql, parameters, transaction);
		if (found is null)
		{
			throw new NotFoundException($"Node '{nodeId}' not found.");
		}
	}

	private static void TouchNode(
		SqliteConnection connection,
		SqliteTransaction transaction,
		Guid nodeId,
		DateTimeOffset updateDate
	)
	{
		const string sql = """
            UPDATE node
            SET update_date = @UpdateDate
            WHERE id = @Id
            """;
		var parameters = new
		{
			UpdateDate = updateDate.ToString("O"),
			Id = nodeId.ToString(),
		};

		connection.Execute(sql, parameters, transaction);
	}

	private NodeEventModel NewEvent(Guid environmentId, Guid nodeId, string action, string contextJson)
	{
		var nodeEvent = new NodeEventModel
		{
			Id = Guid.CreateVersion7(),
			EnvironmentId = environmentId,
			NodeId = nodeId,
			Action = action,
			ContextJson = contextJson,
			CreateDate = this.timer.UtcNow.ToString("O"),
		};

		return nodeEvent;
	}

	private static void RecordEvent(
		SqliteConnection connection,
		SqliteTransaction transaction,
		NodeEventModel model
	)
	{
		const string sql = """
            INSERT INTO node_event (
                id,
                environment_id,
                node_id,
                action,
                context_json,
                create_date
            )
            VALUES (
                @Id,
                @EnvironmentId,
                @NodeId,
                @Action,
                @ContextJson,
                @CreateDate
            )
            """;
		var parameters = new
		{
			Id = model.Id.ToString(),
			EnvironmentId = model.EnvironmentId.ToString(),
			NodeId = model.NodeId.ToString(),
			model.Action,
			model.ContextJson,
			model.CreateDate,
		};

		connection.Execute(sql, parameters, transaction);
	}
}
