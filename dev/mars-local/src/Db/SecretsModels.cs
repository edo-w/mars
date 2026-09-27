namespace Mars.Local.Db;

public class EnvironmentKeyModel
{
	public Guid EnvironmentId { get; set; }
	public string KdfName { get; set; } = "";
	public byte[] KdfSalt { get; set; } = [];
	public int KdfIterations { get; set; }
	public byte[] Nonce { get; set; } = [];
	public byte[] Ciphertext { get; set; } = [];
	public byte[] Tag { get; set; } = [];
}
