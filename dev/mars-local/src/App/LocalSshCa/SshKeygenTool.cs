using Mars.Core.App.SshCa;
using Mars.Core.Lib;
using Mars.Local.Db;

namespace Mars.Local.App.LocalSshCa;

public interface ISshKeygenTool
{
	Task<SshCaKeyPair> GenerateCaAsync(string name, string passphrase);
	Task<SshClientIdentity> IssueAsync(string caPrivateKey, string passphrase, string identity, string principals);
}

public class SshKeygenTool : ISshKeygenTool
{
	private readonly DbSession database;
	private readonly string helperExecutable;
	private readonly IReadOnlyList<string> helperPrefixArguments;
	private readonly IVfs vfs;
	private readonly IVProcess process;
	private readonly IVTimer timer;

	public SshKeygenTool(
		DbSession database,
		string helperExecutable,
		IReadOnlyList<string> helperPrefixArguments,
		IVfs vfs,
		IVProcess process,
		IVTimer timer
	)
	{
		this.database = database;
		this.helperExecutable = helperExecutable;
		this.helperPrefixArguments = helperPrefixArguments;
		this.vfs = vfs;
		this.process = process;
		this.timer = timer;
	}

	public async Task<SshCaKeyPair> GenerateCaAsync(string name, string passphrase)
	{
		var directory = this.CreateTemporaryDirectory();
		try
		{
			var keyPath = Path.Combine(directory, "ca_key");

			await this.RunWithAskpassAsync(
				directory,
				passphrase,
				2,
				"-q", "-t", "ed25519", "-f", keyPath, "-C", $"mars {name} ssh ca"
			);

			var privateKey = await this.vfs.ReadTextAsync(keyPath);
			var publicKey = await this.vfs.ReadTextAsync(keyPath + ".pub");
			var keys = new SshCaKeyPair(privateKey, publicKey);

			return keys;
		}
		finally
		{
			this.vfs.DeleteDirectory(directory, recursive: true);
		}
	}

	public async Task<SshClientIdentity> IssueAsync(
		string caPrivateKey,
		string passphrase,
		string identity,
		string principals
	)
	{
		var directory = this.CreateTemporaryDirectory();
		try
		{
			var caPath = Path.Combine(directory, "ca_key");
			var keyPath = Path.Combine(directory, "client_key");

			await using (var keyFile = this.vfs.CreateNewFile(caPath, privateFile: true))
			{
				await using var writer = new StreamWriter(keyFile);
				await writer.WriteAsync(caPrivateKey);
			}

			await this.RunAsync(directory, null, "-q", "-t", "ed25519", "-f", keyPath,
				"-N", "", "-C", identity);

			await this.RunWithAskpassAsync(directory, passphrase, 1,
				"-q", "-I", identity, "-n", principals, "-s", caPath,
				"-V", "+5m", keyPath + ".pub");

			var privateKey = await this.vfs.ReadTextAsync(keyPath);
			var certificate = await this.vfs.ReadTextAsync(keyPath + "-cert.pub");
			var issued = new SshClientIdentity(privateKey, certificate);

			return issued;
		}
		finally
		{
			this.vfs.DeleteDirectory(directory, recursive: true);
		}
	}

	private string CreateTemporaryDirectory()
	{
		var temporaryRoot = Path.Combine(this.database.AppDirectory, "tmp");
		var root = Path.GetFullPath(temporaryRoot);
		var temporaryName = Guid.NewGuid().ToString("N");
		var directory = Path.GetFullPath(Path.Combine(root, temporaryName));

		var rootPrefix = root + Path.DirectorySeparatorChar;
		var isInsideRoot = directory.StartsWith(rootPrefix, StringComparison.Ordinal);

		if (!isInsideRoot)
		{
			throw new AppException("Invalid temporary SSH path.");
		}

		this.vfs.CreateDirectory(directory);

		return directory;
	}

	private async Task RunWithAskpassAsync(string directory, string passphrase, int reads, params string[] args)
	{
		var launcherPath = this.CreateLauncher(directory);
		await using var bridge = new AskpassBridge(passphrase, reads, this.timer);

		bridge.Start();

		try
		{
			var environment = new Dictionary<string, string>
			{
				["DISPLAY"] = "1",
				["SSH_ASKPASS"] = launcherPath,
				["SSH_ASKPASS_REQUIRE"] = "force",
				["MARS_ASKPASS_PIPE"] = bridge.PipeName,
				["MARS_ASKPASS_TOKEN"] = bridge.Token,
			};

			await this.RunAsync(directory, environment, args);
		}
		finally
		{
			this.vfs.DeleteFile(launcherPath);
		}
	}

	private string CreateLauncher(string directory)
	{
		var windows = OperatingSystem.IsWindows();
		var launcherPath = Path.Combine(directory, windows ? "askpass.cmd" : "askpass.sh");

		var arguments = this.helperPrefixArguments.Append("ssh-askpass");
		var parts = new[] { this.helperExecutable }.Concat(arguments);
		var quotedParts = windows ? parts.Select(QuoteWindows) : parts.Select(QuoteUnix);
		var command = string.Join(" ", quotedParts);
		var contents = windows ? $"@echo off\r\n{command}\r\n" : $"#!/bin/sh\nexec {command}\n";
		this.vfs.WriteText(launcherPath, contents);

		this.vfs.MakeExecutable(launcherPath);

		return launcherPath;
	}

	private async Task RunAsync(string directory, Dictionary<string, string>? environment, params string[] args)
	{
		var command = new ProcessCommand("ssh-keygen", args, directory, environment);
		var result = await this.process.RunAsync(command);

		if (result.ExitCode != 0)
		{
			throw new AppException($"ssh-keygen failed: {result.StandardError.Trim()}");
		}
	}

	private static string QuoteWindows(string value)
	{
		var escaped = value.Replace("\"", "\"\"");
		return $"\"{escaped}\"";
	}

	private static string QuoteUnix(string value)
	{
		var escaped = value.Replace("'", "'\"'\"'");
		return $"'{escaped}'";
	}

}
