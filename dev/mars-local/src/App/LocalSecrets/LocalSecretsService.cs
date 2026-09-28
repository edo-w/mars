using System.Security.Cryptography;
using Mars.Core.App.Secrets;
using Mars.Core.Lib;
using Mars.Local.App.LocalEnvironment;
using Mars.Local.Db;

namespace Mars.Local.App.LocalSecrets;

public class LocalSecretsService : ISecretsService, IDisposable
{
	private const int KeyLength = 32;
	private const int NonceLength = 12;
	private const int TagLength = 16;
	private const int KdfIterations = 600_000;

	private readonly LocalSecretsRepo repo;
	private readonly LocalEnvironmentRepo environments;
	private readonly IPasswordSource passwordSource;
	private readonly Dictionary<Guid, byte[]> dataKeys = [];

	public LocalSecretsService(
		LocalSecretsRepo repo,
		LocalEnvironmentRepo environments,
		IPasswordSource passwordSource
	)
	{
		this.repo = repo;
		this.environments = environments;
		this.passwordSource = passwordSource;
	}

	public Task<EncryptedValue> EncryptAsync(Guid environmentId, byte[] plaintext)
	{
		var key = this.GetDataKey(environmentId);
		var nonce = RandomNumberGenerator.GetBytes(NonceLength);
		var ciphertext = new byte[plaintext.Length];
		var tag = new byte[TagLength];

		using var aes = new AesGcm(key, TagLength);
		aes.Encrypt(nonce, plaintext, ciphertext, tag);

		var encrypted = new EncryptedValue(nonce, ciphertext, tag);

		return Task.FromResult(encrypted);
	}

	public Task<byte[]> DecryptAsync(Guid environmentId, EncryptedValue encrypted)
	{
		var key = this.GetDataKey(environmentId);
		var plaintext = new byte[encrypted.Ciphertext.Length];

		using var aes = new AesGcm(key, TagLength);
		aes.Decrypt(encrypted.Nonce, encrypted.Ciphertext, encrypted.Tag, plaintext);

		return Task.FromResult(plaintext);
	}

	public void Dispose()
	{
		foreach (var key in this.dataKeys.Values)
		{
			CryptographicOperations.ZeroMemory(key);
		}

		this.dataKeys.Clear();
		GC.SuppressFinalize(this);
	}

	private byte[] GetDataKey(Guid environmentId)
	{
		if (this.dataKeys.TryGetValue(environmentId, out var cached))
		{
			return cached;
		}

		var environment = this.environments.GetById(environmentId);
		if (environment is null)
		{
			throw new NotFoundException($"Environment '{environmentId}' not found.");
		}

		var password = this.passwordSource.GetPassword(environment.Name);
		var model = this.repo.Get(environmentId);

		if (model is not null)
		{
			if (model.KdfName != "pbkdf2-sha256")
			{
				throw new UnprocessableException($"Unsupported KDF '{model.KdfName}' in stored environment key.");
			}

			var wrappingKey = Rfc2898DeriveBytes.Pbkdf2(
				password,
				model.KdfSalt,
				model.KdfIterations,
				HashAlgorithmName.SHA256,
				KeyLength
			);
			var dataKey = new byte[KeyLength];

			try
			{
				using var aes = new AesGcm(wrappingKey, TagLength);
				aes.Decrypt(model.Nonce, model.Ciphertext, model.Tag, dataKey);
			}
			catch (CryptographicException exception)
			{
				CryptographicOperations.ZeroMemory(dataKey);
				throw new UnprocessableException("Invalid secrets password or corrupted environment key.", exception);
			}
			finally
			{
				CryptographicOperations.ZeroMemory(wrappingKey);
			}

			this.dataKeys[environmentId] = dataKey;

			return dataKey;
		}

		var newKey = RandomNumberGenerator.GetBytes(KeyLength);
		var newSalt = RandomNumberGenerator.GetBytes(16);
		var newNonce = RandomNumberGenerator.GetBytes(NonceLength);
		var newCiphertext = new byte[KeyLength];
		var newTag = new byte[TagLength];
		var newWrappingKey = Rfc2898DeriveBytes.Pbkdf2(
			password,
			newSalt,
			KdfIterations,
			HashAlgorithmName.SHA256,
			KeyLength
		);

		try
		{
			using var aes = new AesGcm(newWrappingKey, TagLength);
			aes.Encrypt(newNonce, newKey, newCiphertext, newTag);

			var keyModel = new EnvironmentKeyModel
			{
				EnvironmentId = environmentId,
				KdfName = "pbkdf2-sha256",
				KdfSalt = newSalt,
				KdfIterations = KdfIterations,
				Nonce = newNonce,
				Ciphertext = newCiphertext,
				Tag = newTag,
			};

			var created = this.repo.InsertIfAbsent(keyModel);

			if (!created)
			{
				CryptographicOperations.ZeroMemory(newKey);
				return this.GetDataKey(environmentId);
			}

			this.dataKeys[environmentId] = newKey;

			return newKey;
		}
		catch
		{
			CryptographicOperations.ZeroMemory(newKey);
			throw;
		}
		finally
		{
			CryptographicOperations.ZeroMemory(newWrappingKey);
		}
	}
}
