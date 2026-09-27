using Dapper;
using Mars.Local.Db;

namespace Mars.Local.App.LocalKv;

public class LocalKvRepo
{
	private readonly DbSession session;

	public LocalKvRepo(DbSession session)
	{
		this.session = session;
	}

	public void InsertVersion(KvModel model, Action<KvModel>? persistObject)
	{
		const string nextVersionSql = """
            SELECT COALESCE(MAX(version), 0) + 1
            FROM kv
            WHERE environment_id = @EnvironmentId
                AND key_path = @KeyPath
            """;
		const string insertSql = """
            INSERT INTO kv (
                id,
                environment_id,
                key_path,
                version,
                type,
                is_secret,
                value,
                size,
                nonce,
                tag,
                create_date
            )
            VALUES (
                @Id,
                @EnvironmentId,
                @KeyPath,
                @Version,
                @Type,
                @IsSecret,
                @Value,
                @Size,
                @Nonce,
                @Tag,
                @CreateDate
            )
            """;
		var versionParameters = new
		{
			EnvironmentId = model.EnvironmentId.ToString(),
			model.KeyPath,
		};

		using var connection = this.session.Open();
		using var transaction = connection.BeginTransaction();
		model.Version = connection.QuerySingle<int>(nextVersionSql, versionParameters, transaction);

		persistObject?.Invoke(model);

		var insertParameters = new
		{
			Id = model.Id.ToString(),
			EnvironmentId = model.EnvironmentId.ToString(),
			model.KeyPath,
			model.Version,
			model.Type,
			IsSecret = model.IsSecret ? 1 : 0,
			model.Value,
			model.Size,
			model.Nonce,
			model.Tag,
			model.CreateDate,
		};
		connection.Execute(insertSql, insertParameters, transaction);
		transaction.Commit();
	}

	public KvModel? Get(Guid environmentId, string key, int? version)
	{
		const string latestSql = """
            SELECT
                id AS Id,
                environment_id AS EnvironmentId,
                key_path AS KeyPath,
                version AS Version,
                type AS Type,
                is_secret AS IsSecret,
                value AS Value,
                size AS Size,
                nonce AS Nonce,
                tag AS Tag,
                create_date AS CreateDate
            FROM kv
            WHERE environment_id = @EnvironmentId
                AND key_path = @KeyPath
            ORDER BY version DESC
            LIMIT 1
            """;
		const string versionSql = """
            SELECT
                id AS Id,
                environment_id AS EnvironmentId,
                key_path AS KeyPath,
                version AS Version,
                type AS Type,
                is_secret AS IsSecret,
                value AS Value,
                size AS Size,
                nonce AS Nonce,
                tag AS Tag,
                create_date AS CreateDate
            FROM kv
            WHERE environment_id = @EnvironmentId
                AND key_path = @KeyPath
                AND version = @Version
            """;
		var parameters = new
		{
			EnvironmentId = environmentId.ToString(),
			KeyPath = key,
			Version = version,
		};

		using var connection = this.session.Open();
		if (version is null)
		{
			var latest = connection.QuerySingleOrDefault<KvModel>(latestSql, parameters);
			return latest;
		}

		var requested = connection.QuerySingleOrDefault<KvModel>(versionSql, parameters);

		return requested;
	}

	public IReadOnlyList<KvSummaryViewModel> List(Guid environmentId, string prefix)
	{
		const string sql = """
            SELECT
                value.id AS Id,
                value.key_path AS KeyPath,
                value.version AS Version,
                value.type AS Type,
                value.is_secret AS IsSecret,
                value.size AS Size,
                (
                    SELECT first.create_date
                    FROM kv AS first
                    WHERE first.environment_id = value.environment_id
                        AND first.key_path = value.key_path
                    ORDER BY first.version
                    LIMIT 1
                ) AS CreateDate,
                value.create_date AS UpdateDate
            FROM kv AS value
            WHERE value.environment_id = @EnvironmentId
                AND (
                    @Prefix = '/'
                    OR value.key_path = @Prefix
                    OR substr(value.key_path, 1, length(@Prefix) + 1) = @Prefix || '/'
                )
                AND value.version = (
                    SELECT MAX(latest.version)
                    FROM kv AS latest
                    WHERE latest.environment_id = value.environment_id
                        AND latest.key_path = value.key_path
                )
            ORDER BY value.key_path
            """;
		var parameters = new
		{
			EnvironmentId = environmentId.ToString(),
			Prefix = prefix,
		};

		using var connection = this.session.Open();
		var summaries = connection.Query<KvSummaryViewModel>(sql, parameters);

		return summaries.ToArray();
	}

	public KvSummaryViewModel? GetSummary(Guid environmentId, string key)
	{
		const string sql = """
            SELECT
                id AS Id,
                key_path AS KeyPath,
                version AS Version,
                type AS Type,
                is_secret AS IsSecret,
                size AS Size,
                (
                    SELECT first.create_date
                    FROM kv AS first
                    WHERE first.environment_id = kv.environment_id
                        AND first.key_path = kv.key_path
                    ORDER BY first.version
                    LIMIT 1
                ) AS CreateDate,
                create_date AS UpdateDate
            FROM kv
            WHERE environment_id = @EnvironmentId
                AND key_path = @KeyPath
            ORDER BY version DESC
            LIMIT 1
            """;
		var parameters = new
		{
			EnvironmentId = environmentId.ToString(),
			KeyPath = key,
		};

		using var connection = this.session.Open();
		var summary = connection.QuerySingleOrDefault<KvSummaryViewModel>(sql, parameters);

		return summary;
	}

	public IReadOnlyList<KvModel> Delete(Guid environmentId, string key)
	{
		const string listSql = """
            SELECT
                id AS Id,
                environment_id AS EnvironmentId,
                key_path AS KeyPath,
                version AS Version,
                type AS Type,
                is_secret AS IsSecret,
                value AS Value,
                size AS Size,
                nonce AS Nonce,
                tag AS Tag,
                create_date AS CreateDate
            FROM kv
            WHERE environment_id = @EnvironmentId
                AND key_path = @KeyPath
            ORDER BY version
            """;
		const string deleteSql = """
            DELETE FROM kv
            WHERE environment_id = @EnvironmentId
                AND key_path = @KeyPath
            """;
		var parameters = new
		{
			EnvironmentId = environmentId.ToString(),
			KeyPath = key,
		};

		using var connection = this.session.Open();
		using var transaction = connection.BeginTransaction();
		var versions = connection.Query<KvModel>(listSql, parameters, transaction).ToArray();
		connection.Execute(deleteSql, parameters, transaction);
		transaction.Commit();

		return versions;
	}
}
