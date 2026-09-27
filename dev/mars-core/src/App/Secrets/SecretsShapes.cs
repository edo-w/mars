namespace Mars.Core.App.Secrets;

public class EncryptedValue
{
	public EncryptedValue(byte[] nonce, byte[] ciphertext, byte[] tag)
	{
		this.Nonce = nonce;
		this.Ciphertext = ciphertext;
		this.Tag = tag;
	}

	public byte[] Nonce { get; }
	public byte[] Ciphertext { get; }
	public byte[] Tag { get; }
}
