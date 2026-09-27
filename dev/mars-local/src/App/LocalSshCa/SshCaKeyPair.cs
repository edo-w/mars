namespace Mars.Local.App.LocalSshCa;

public class SshCaKeyPair
{
	public SshCaKeyPair(string privateKey, string publicKey)
	{
		this.PrivateKey = privateKey;
		this.PublicKey = publicKey;
	}

	public string PrivateKey { get; }
	public string PublicKey { get; }
}
