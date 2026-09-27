namespace Mars.Core.App.SshCa;

public class SshCaInfo
{
	public SshCaInfo(string name, string publicKey, DateTimeOffset createDate)
	{
		this.Name = name;
		this.PublicKey = publicKey;
		this.CreateDate = createDate;
	}

	public string Name { get; }
	public string PublicKey { get; }
	public DateTimeOffset CreateDate { get; }
}

public class SshClientIdentity
{
	public SshClientIdentity(string privateKey, string certificate)
	{
		this.PrivateKey = privateKey;
		this.Certificate = certificate;
	}

	public string PrivateKey { get; }
	public string Certificate { get; }
}
