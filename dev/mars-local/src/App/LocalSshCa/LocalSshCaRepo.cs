using Dapper;
using Mars.Core.Lib;
using Mars.Local.Db;
using Microsoft.Data.Sqlite;

namespace Mars.Local.App.LocalSshCa;

public class LocalSshCaRepo
{
	private readonly DbSession session;

	public LocalSshCaRepo(DbSession session)
	{
		this.session = session;
	}

	public void Insert(SshCaModel model)
	{
		const string sql = """
            INSERT INTO ssh_ca (
                environment_id,
                name,
                private_key,
                public_key,
                passphrase_nonce,
                passphrase_ciphertext,
                passphrase_tag,
                create_date
            )
            VALUES (
                @EnvironmentId,
                @Name,
                @PrivateKey,
                @PublicKey,
                @PassphraseNonce,
                @PassphraseCiphertext,
                @PassphraseTag,
                @CreateDate
            )
            """;
		var parameters = new
		{
			EnvironmentId = model.EnvironmentId.ToString(),
			model.Name,
			model.PrivateKey,
			model.PublicKey,
			model.PassphraseNonce,
			model.PassphraseCiphertext,
			model.PassphraseTag,
			model.CreateDate,
		};

		using var connection = this.session.Open();
		try
		{
			connection.Execute(sql, parameters);
		}
		catch (SqliteException exception) when (exception.SqliteExtendedErrorCode is 2067 or 1555)
		{
			var error = new ConflictException($"SSH CA '{model.Name}' already exists.", exception);
			error.Data["ssh_ca"] = model.Name;

			throw error;
		}
	}

	public IReadOnlyList<SshCaSummaryViewModel> ListSummaries(Guid environmentId)
	{
		const string sql = """
            SELECT
                name AS Name,
                public_key AS PublicKey,
                create_date AS CreateDate
            FROM ssh_ca
            WHERE environment_id = @EnvironmentId
            ORDER BY name
            """;
		var parameters = new { EnvironmentId = environmentId.ToString() };

		using var connection = this.session.Open();
		var summaries = connection.Query<SshCaSummaryViewModel>(sql, parameters);

		return summaries.ToArray();
	}

	public SshCaSummaryViewModel? GetSummary(Guid environmentId, string name)
	{
		const string sql = """
            SELECT
                name AS Name,
                public_key AS PublicKey,
                create_date AS CreateDate
            FROM ssh_ca
            WHERE environment_id = @EnvironmentId
                AND name = @Name
            """;
		var parameters = new
		{
			EnvironmentId = environmentId.ToString(),
			Name = name,
		};

		using var connection = this.session.Open();
		var summary = connection.QuerySingleOrDefault<SshCaSummaryViewModel>(sql, parameters);

		return summary;
	}

	public SshCaModel? Get(Guid environmentId, string name)
	{
		const string sql = """
            SELECT
                environment_id AS EnvironmentId,
                name AS Name,
                private_key AS PrivateKey,
                public_key AS PublicKey,
                passphrase_nonce AS PassphraseNonce,
                passphrase_ciphertext AS PassphraseCiphertext,
                passphrase_tag AS PassphraseTag,
                create_date AS CreateDate
            FROM ssh_ca
            WHERE environment_id = @EnvironmentId
                AND name = @Name
            """;
		var parameters = new
		{
			EnvironmentId = environmentId.ToString(),
			Name = name,
		};

		using var connection = this.session.Open();
		var ca = connection.QuerySingleOrDefault<SshCaModel>(sql, parameters);

		return ca;
	}

	public bool Delete(Guid environmentId, string name)
	{
		const string sql = """
            DELETE FROM ssh_ca
            WHERE environment_id = @EnvironmentId
                AND name = @Name
            """;
		var parameters = new
		{
			EnvironmentId = environmentId.ToString(),
			Name = name,
		};

		using var connection = this.session.Open();
		var deletedRows = connection.Execute(sql, parameters);

		return deletedRows > 0;
	}
}
