using Dapper;
using Mars.Core.Lib;
using Mars.Local.Db;
using Microsoft.Data.Sqlite;

namespace Mars.Local.App.LocalEnvironment;

public class LocalEnvironmentRepo
{
	private readonly StateDbSession session;

	public LocalEnvironmentRepo(StateDbSession session)
	{
		this.session = session;
	}

	public void Create(EnvironmentModel model)
	{
		const string sql = """
            INSERT INTO environment (
                id,
                namespace,
                name,
                properties_json
            )
            VALUES (
                @Id,
                @Namespace,
                @Name,
                @PropertiesJson
            )
            """;
		var parameters = new
		{
			Id = model.Id.ToString(),
			model.Namespace,
			model.Name,
			model.PropertiesJson,
		};

		using var connection = this.session.Open();
		try
		{
			connection.Execute(sql, parameters);
		}
		catch (SqliteException exception) when (exception.SqliteExtendedErrorCode is 2067 or 1555)
		{
			var error = new ConflictException($"Environment '{model.Namespace}/{model.Name}' already exists.", exception);
			error.Data["environment"] = $"{model.Namespace}/{model.Name}";

			throw error;
		}
	}

	public IReadOnlyList<EnvironmentModel> List()
	{
		const string sql = """
            SELECT
                id AS Id,
                namespace AS Namespace,
                name AS Name,
                properties_json AS PropertiesJson
            FROM environment
            ORDER BY
                namespace,
                name
            """;

		using var connection = this.session.Open();
		var environments = connection.Query<EnvironmentModel>(sql);

		return environments.ToArray();
	}

	public EnvironmentModel? Get(string environmentNamespace, string name)
	{
		const string sql = """
            SELECT
                id AS Id,
                namespace AS Namespace,
                name AS Name,
                properties_json AS PropertiesJson
            FROM environment
            WHERE namespace = @EnvironmentNamespace
                AND name = @Name
            """;
		var parameters = new
		{
			EnvironmentNamespace = environmentNamespace,
			Name = name,
		};

		using var connection = this.session.Open();
		var environment = connection.QuerySingleOrDefault<EnvironmentModel>(sql, parameters);

		return environment;
	}

	public IReadOnlyList<EnvironmentModel> GetByName(string name)
	{
		const string sql = """
            SELECT
                id AS Id,
                namespace AS Namespace,
                name AS Name,
                properties_json AS PropertiesJson
            FROM environment
            WHERE name = @Name
            ORDER BY namespace
            """;
		var parameters = new { Name = name };

		using var connection = this.session.Open();
		var environments = connection.Query<EnvironmentModel>(sql, parameters);

		return environments.ToArray();
	}

	public EnvironmentModel? GetById(Guid environmentId)
	{
		const string sql = """
            SELECT
                id AS Id,
                namespace AS Namespace,
                name AS Name,
                properties_json AS PropertiesJson
            FROM environment
            WHERE id = @EnvironmentId
            """;
		var parameters = new { EnvironmentId = environmentId.ToString() };

		using var connection = this.session.Open();
		var environment = connection.QuerySingleOrDefault<EnvironmentModel>(sql, parameters);

		return environment;
	}

	public void Delete(Guid environmentId)
	{
		const string sql = """
            DELETE FROM environment
            WHERE id = @EnvironmentId
            """;
		var parameters = new { EnvironmentId = environmentId.ToString() };

		using var connection = this.session.Open();
		using var transaction = connection.BeginTransaction();
		connection.Execute(sql, parameters, transaction);
		transaction.Commit();
	}

	public void UpdateProperties(Guid environmentId, Func<string, string> update)
	{
		const string readSql = """
            SELECT properties_json
            FROM environment
            WHERE id = @EnvironmentId
            """;
		const string updateSql = """
            UPDATE environment
            SET properties_json = @PropertiesJson
            WHERE id = @EnvironmentId
            """;
		var lookup = new { EnvironmentId = environmentId.ToString() };

		using var connection = this.session.Open();
		using var transaction = connection.BeginTransaction();
		var oldValue = connection.QuerySingleOrDefault<string>(readSql, lookup, transaction);
		if (oldValue is null)
		{
			throw new NotFoundException($"Environment '{environmentId}' was removed.");
		}

		var propertiesJson = update(oldValue);
		var parameters = new
		{
			PropertiesJson = propertiesJson,
			EnvironmentId = environmentId.ToString(),
		};
		connection.Execute(updateSql, parameters, transaction);
		transaction.Commit();
	}
}
