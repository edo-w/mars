using Dapper;
using Mars.Local.Db;

namespace Mars.Local.App.LocalSecrets;

public class LocalSecretsRepo
{
	private readonly StateDbSession session;

	public LocalSecretsRepo(StateDbSession session)
	{
		this.session = session;
	}

	public EnvironmentKeyModel? Get(Guid environmentId)
	{
		const string sql = """
            SELECT
                environment_id AS EnvironmentId,
                kdf_name AS KdfName,
                kdf_salt AS KdfSalt,
                kdf_iterations AS KdfIterations,
                nonce AS Nonce,
                ciphertext AS Ciphertext,
                tag AS Tag
            FROM environment_secret_key
            WHERE environment_id = @EnvironmentId
            """;
		var parameters = new { EnvironmentId = environmentId.ToString() };

		using var connection = this.session.Open();
		var key = connection.QuerySingleOrDefault<EnvironmentKeyModel>(sql, parameters);

		return key;
	}

	public bool InsertIfAbsent(EnvironmentKeyModel model)
	{
		const string sql = """
            INSERT OR IGNORE INTO environment_secret_key (
                environment_id,
                kdf_name,
                kdf_salt,
                kdf_iterations,
                nonce,
                ciphertext,
                tag
            )
            VALUES (
                @EnvironmentId,
                @KdfName,
                @KdfSalt,
                @KdfIterations,
                @Nonce,
                @Ciphertext,
                @Tag
            )
            """;
		var parameters = new
		{
			EnvironmentId = model.EnvironmentId.ToString(),
			model.KdfName,
			model.KdfSalt,
			model.KdfIterations,
			model.Nonce,
			model.Ciphertext,
			model.Tag,
		};

		using var connection = this.session.Open();
		var insertedRows = connection.Execute(sql, parameters);

		return insertedRows > 0;
	}
}
