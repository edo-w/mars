using Mars.Core.Lib;

namespace Mars.Local.App.LocalEnvironment;

public class LocalEnvironmentSelectionStore
{
	private readonly string path;
	private readonly IVfs vfs;

	public LocalEnvironmentSelectionStore(string appRoot, IVfs vfs)
	{
		this.path = Path.Combine(appRoot, ".mars", "selected-environment");
		this.vfs = vfs;
	}

	public string? Read()
	{
		if (!this.vfs.FileExists(this.path))
		{
			return null;
		}

		var value = this.vfs.ReadText(this.path).Trim();

		return value.Length == 0 ? null : value;
	}

	public void Write(string fullName)
	{
		var directory = Path.GetDirectoryName(this.path)!;
		this.vfs.CreateDirectory(directory);
		this.vfs.WriteText(this.path, fullName + Environment.NewLine);
	}

	public void ClearIfSelected(string fullName)
	{
		var selected = this.Read();
		if (string.Equals(selected, fullName, StringComparison.Ordinal))
		{
			this.vfs.DeleteFile(this.path);
		}
	}
}
