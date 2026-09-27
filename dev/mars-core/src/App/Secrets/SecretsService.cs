namespace Mars.Core.App.Secrets;

public interface ISecretsService
{
	Task<EncryptedValue> EncryptAsync(Guid environmentId, byte[] plaintext);
	Task<byte[]> DecryptAsync(Guid environmentId, EncryptedValue encrypted);
}

public interface IPasswordSource
{
	string GetPassword(string environmentName);
}
