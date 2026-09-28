using Dapper;
using Mars.Local.Db;

namespace Mars.Local.App.LocalLock;

public class LocalLockRepo
{
	private readonly StateDbSession session;

	public LocalLockRepo(StateDbSession session)
	{
		this.session = session;
	}

	public bool Acquire(LeaseModel model, DateTimeOffset now)
	{
		const string sql = """
            INSERT INTO lease (
                id,
                environment_id,
                name,
                owner,
                token,
                expire_date
            )
            VALUES (
                @Id,
                @EnvironmentId,
                @Name,
                @Owner,
                @Token,
                @ExpireDate
            )
            ON CONFLICT (
                environment_id,
                name
            )
            DO UPDATE SET
                id = excluded.id,
                owner = excluded.owner,
                token = excluded.token,
                expire_date = excluded.expire_date
            WHERE lease.expire_date <= @Now
            RETURNING token
            """;
		var parameters = new
		{
			Id = model.Id.ToString(),
			EnvironmentId = model.EnvironmentId.ToString(),
			model.Name,
			model.Owner,
			Token = model.Token.ToString(),
			ExpireDate = model.ExpireDate.ToString("O"),
			Now = now.ToString("O"),
		};

		using var connection = this.session.Open();
		var token = connection.QuerySingleOrDefault<string>(sql, parameters);

		return token is not null;
	}

	public bool Renew(LeaseModel lease, DateTimeOffset expireDate, DateTimeOffset now)
	{
		const string sql = """
            UPDATE lease
            SET expire_date = @ExpireDate
            WHERE environment_id = @EnvironmentId
                AND name = @Name
                AND owner = @Owner
                AND token = @Token
                AND expire_date > @Now
            """;
		var parameters = new
		{
			ExpireDate = expireDate.ToString("O"),
			EnvironmentId = lease.EnvironmentId.ToString(),
			lease.Name,
			lease.Owner,
			Token = lease.Token.ToString(),
			Now = now.ToString("O"),
		};

		using var connection = this.session.Open();
		var renewedRows = connection.Execute(sql, parameters);

		return renewedRows > 0;
	}

	public bool Release(LeaseModel lease)
	{
		const string sql = """
            DELETE FROM lease
            WHERE environment_id = @EnvironmentId
                AND name = @Name
                AND token = @Token
            """;
		var parameters = new
		{
			EnvironmentId = lease.EnvironmentId.ToString(),
			lease.Name,
			Token = lease.Token.ToString(),
		};

		using var connection = this.session.Open();
		var deletedRows = connection.Execute(sql, parameters);

		return deletedRows > 0;
	}
}
