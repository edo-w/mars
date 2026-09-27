namespace Mars.Core.Lib;

public interface IVfs
{
	bool FileExists(string path);
	bool DirectoryExists(string path);
	void CreateDirectory(string path);
	void DeleteFile(string path);
	void DeleteDirectory(string path, bool recursive);
	IReadOnlyList<string> ListDirectory(string path);
	string ReadText(string path);
	void WriteText(string path, string contents);
	Task<string> ReadTextAsync(string path, CancellationToken cancellationToken = default);
	Task WriteTextAsync(string path, string contents, CancellationToken cancellationToken = default);
	Task<byte[]> ReadBytesAsync(string path, CancellationToken cancellationToken = default);
	Task WriteBytesAsync(string path, byte[] contents, CancellationToken cancellationToken = default);
	Stream CreateNewFile(string path, bool privateFile);
	void MakeExecutable(string path);
}
