using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using Mars.Core.App.Config;
using Mars.Core.App.Secrets;
using Mars.Core.App.SshCa;
using Mars.Core.Lib;
using Mars.Local.Db;

namespace Mars.Local.App.LocalSshCa;

public class LocalSshCaService : ISshCaService
{
	private readonly LocalSshCaRepo repo;
	private readonly ISecretsService secrets;
	private readonly ISshKeygenTool sshKeygen;
	private readonly IVTimer timer;

	public LocalSshCaService(LocalSshCaRepo repo, ISecretsService secrets, ISshKeygenTool sshKeygen, IVTimer timer)
	{
		this.repo = repo;
		this.secrets = secrets;
		this.sshKeygen = sshKeygen;
		this.timer = timer;
	}

	public async Task<SshCaInfo> CreateAsync(Guid environmentId, string name)
	{
		name = Config.ValidateName(name);

		var existing = this.repo.GetSummary(environmentId, name);

		if (existing is not null)
		{
			throw new ConflictException($"SSH CA '{name}' already exists.");
		}

		var passphraseBytes = RandomNumberGenerator.GetBytes(32);
		var passphrase = Convert.ToHexString(passphraseBytes);

		var keys = await this.sshKeygen.GenerateCaAsync(name, passphrase);

		var clearPassphrase = Encoding.UTF8.GetBytes(passphrase);
		var encrypted = await this.secrets.EncryptAsync(environmentId, clearPassphrase);

		var model = new SshCaModel
		{
			EnvironmentId = environmentId,
			Name = name,
			PrivateKey = keys.PrivateKey,
			PublicKey = keys.PublicKey,
			PassphraseNonce = encrypted.Nonce,
			PassphraseCiphertext = encrypted.Ciphertext,
			PassphraseTag = encrypted.Tag,
			CreateDate = this.timer.UtcNow.ToString("O"),
		};

		this.repo.Insert(model);

		var createDate = DateTimeOffset.Parse(model.CreateDate, CultureInfo.InvariantCulture);
		var ca = new SshCaInfo(name, keys.PublicKey, createDate);

		return ca;
	}

	public Task<IReadOnlyList<SshCaInfo>> ListAsync(Guid environmentId)
	{
		var models = this.repo.ListSummaries(environmentId);
		var authorities = models.Select(ToInfo).ToArray();

		return Task.FromResult<IReadOnlyList<SshCaInfo>>(authorities);
	}

	public Task<SshCaInfo?> GetAsync(Guid environmentId, string name)
	{
		name = Config.ValidateName(name);

		var model = this.repo.GetSummary(environmentId, name);

		if (model is null)
		{
			return Task.FromResult<SshCaInfo?>(null);
		}

		var ca = ToInfo(model);

		return Task.FromResult<SshCaInfo?>(ca);
	}

	public Task DeleteAsync(Guid environmentId, string name)
	{
		name = Config.ValidateName(name);

		var deleted = this.repo.Delete(environmentId, name);

		if (!deleted)
		{
			throw new NotFoundException($"SSH CA '{name}' not found.");
		}

		return Task.CompletedTask;
	}

	public async Task<SshClientIdentity> IssueAsync(
		Guid environmentId,
		string name,
		string identity,
		string principals
	)
	{
		name = Config.ValidateName(name);
		var isIdentityEmpty = string.IsNullOrWhiteSpace(identity);
		var arePrincipalsEmpty = string.IsNullOrWhiteSpace(principals);

		if (isIdentityEmpty || arePrincipalsEmpty)
		{
			throw new BadRequestException("Certificate identity and principals are required.");
		}

		var model = this.repo.Get(environmentId, name);

		if (model is null)
		{
			throw new NotFoundException($"SSH CA '{name}' not found.");
		}

		var encrypted = new EncryptedValue(
			model.PassphraseNonce,
			model.PassphraseCiphertext,
			model.PassphraseTag
		);

		var passphraseBytes = await this.secrets.DecryptAsync(environmentId, encrypted);

		try
		{
			var passphrase = Encoding.UTF8.GetString(passphraseBytes);
			var issued = await this.sshKeygen.IssueAsync(model.PrivateKey, passphrase, identity, principals);

			return issued;
		}
		finally
		{
			CryptographicOperations.ZeroMemory(passphraseBytes);
		}
	}

	private static SshCaInfo ToInfo(SshCaSummaryViewModel model)
	{
		var createDate = DateTimeOffset.Parse(model.CreateDate, CultureInfo.InvariantCulture);
		var ca = new SshCaInfo(model.Name, model.PublicKey, createDate);

		return ca;
	}
}
