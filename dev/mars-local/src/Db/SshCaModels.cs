namespace Mars.Local.Db;

public class SshCaModel
{
	public Guid EnvironmentId { get; set; }
	public string Name { get; set; } = "";
	public string PrivateKey { get; set; } = "";
	public string PublicKey { get; set; } = "";
	public byte[] PassphraseNonce { get; set; } = [];
	public byte[] PassphraseCiphertext { get; set; } = [];
	public byte[] PassphraseTag { get; set; } = [];
	public string CreateDate { get; set; } = "";
}

public class SshCaSummaryViewModel
{
	public string Name { get; set; } = "";
	public string PublicKey { get; set; } = "";
	public string CreateDate { get; set; } = "";
}
