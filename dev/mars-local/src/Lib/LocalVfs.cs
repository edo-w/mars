using System.Security.AccessControl;
using System.Security.Principal;
using Mars.Core.Lib;

namespace Mars.Local.Lib;

public class LocalVfs : IVfs
{
	public bool FileExists(string path)
	{
		return File.Exists(path);
	}

	public bool DirectoryExists(string path)
	{
		return Directory.Exists(path);
	}

	public void CreateDirectory(string path)
	{
		Directory.CreateDirectory(path);
	}

	public void DeleteFile(string path)
	{
		File.Delete(path);
	}

	public void DeleteDirectory(string path, bool recursive)
	{
		Directory.Delete(path, recursive);
	}

	public IReadOnlyList<string> ListDirectory(string path)
	{
		if (!Directory.Exists(path))
		{
			return [];
		}

		var names = Directory.GetFileSystemEntries(path)
			.Select(Path.GetFileName)
			.OfType<string>()
			.OrderBy(name => name, StringComparer.Ordinal)
			.ToArray();

		return names;
	}

	public string ReadText(string path)
	{
		return File.ReadAllText(path);
	}

	public void WriteText(string path, string contents)
	{
		File.WriteAllText(path, contents);
	}

	public Task<string> ReadTextAsync(string path, CancellationToken cancellationToken = default)
	{
		return File.ReadAllTextAsync(path, cancellationToken);
	}

	public Task WriteTextAsync(
		string path,
		string contents,
		CancellationToken cancellationToken = default
	)
	{
		return File.WriteAllTextAsync(path, contents, cancellationToken);
	}

	public Task<byte[]> ReadBytesAsync(string path, CancellationToken cancellationToken = default)
	{
		return File.ReadAllBytesAsync(path, cancellationToken);
	}

	public Task WriteBytesAsync(string path, byte[] contents, CancellationToken cancellationToken = default)
	{
		return File.WriteAllBytesAsync(path, contents, cancellationToken);
	}

	public Stream CreateNewFile(string path, bool privateFile)
	{
		var options = new FileStreamOptions
		{
			Mode = FileMode.CreateNew,
			Access = FileAccess.Write,
		};
		if (privateFile && !OperatingSystem.IsWindows())
		{
			options.UnixCreateMode = UnixFileMode.UserRead | UnixFileMode.UserWrite;
		}

		var stream = new FileStream(path, options);
		if (!privateFile)
		{
			return stream;
		}

		try
		{
			ProtectPrivateFile(path);
		}
		catch
		{
			stream.Dispose();
			File.Delete(path);
			throw;
		}

		return stream;
	}

	public void MakeExecutable(string path)
	{
		if (!OperatingSystem.IsWindows())
		{
			var mode = UnixFileMode.UserRead | UnixFileMode.UserWrite | UnixFileMode.UserExecute;
			File.SetUnixFileMode(path, mode);
		}
	}

	private static void ProtectPrivateFile(string path)
	{
		if (!OperatingSystem.IsWindows())
		{
			File.SetUnixFileMode(path, UnixFileMode.UserRead | UnixFileMode.UserWrite);

			return;
		}

		var owner = WindowsIdentity.GetCurrent().User;
		if (owner is null)
		{
			throw new AppException("Cannot identify the current Windows user.");
		}

		var security = new FileSecurity();
		security.SetOwner(owner);
		security.SetAccessRuleProtection(isProtected: true, preserveInheritance: false);
		var accessRule = new FileSystemAccessRule(owner, FileSystemRights.FullControl, AccessControlType.Allow);
		security.AddAccessRule(accessRule);
		var file = new FileInfo(path);
		file.SetAccessControl(security);
	}
}
