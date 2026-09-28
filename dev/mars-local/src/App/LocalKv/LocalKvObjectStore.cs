using Mars.Core.Lib;
using Mars.Local.Db;

namespace Mars.Local.App.LocalKv;

public class LocalKvObjectStore
{
	private readonly StateDbSession session;
	private readonly IVfs vfs;

	public LocalKvObjectStore(StateDbSession session, IVfs vfs)
	{
		this.session = session;
		this.vfs = vfs;
	}

	public string GetPath(KvModel model)
	{
		var directory = Path.Combine(
			this.session.AppDirectory,
			"env",
			model.EnvironmentId.ToString(),
			"kv"
		);
		var fileName = $"{model.Id}_{model.Version}";
		var path = Path.Combine(directory, fileName);

		return path;
	}

	public void Write(KvModel model, byte[] value)
	{
		var path = this.GetPath(model);
		var directory = Path.GetDirectoryName(path)!;
		this.vfs.CreateDirectory(directory);

		using var stream = this.vfs.CreateNewFile(path, privateFile: true);
		stream.Write(value);
	}

	public Task<byte[]> ReadAsync(KvModel model)
	{
		var path = this.GetPath(model);

		return this.vfs.ReadBytesAsync(path);
	}

	public void Delete(KvModel model)
	{
		var path = this.GetPath(model);
		this.vfs.DeleteFile(path);
	}
}
