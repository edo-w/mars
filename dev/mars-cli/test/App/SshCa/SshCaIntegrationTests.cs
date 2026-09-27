using Mars.Cli;
using Mars.Core.App.Secrets;
using Mars.Local.App.LocalEnvironment;
using Mars.Local.App.LocalSecrets;
using Mars.Local.App.LocalSshCa;
using Mars.Core.App.Config;
using Mars.Local.Lib;
using Mars.Local.Db;
using NUnit.Framework;
using Assert = NUnit.Framework.Legacy.ClassicAssert;

namespace Mars.Cli.Tests.App.SshCa;

public class SshCaIntegrationTests
{
	[Test]
	public async Task SshCaIssuesAShortLivedCertificateWithAskpass()
	{
		var root = Path.Combine(
			TestContext.CurrentContext.WorkDirectory,
			"test-state",
			Guid.NewGuid().ToString("N")
		);
		Directory.CreateDirectory(root);
		var vfs = new LocalVfs();
		var timer = new LocalVTimer();
		var process = new LocalVProcess();
		var configService = new ConfigService(vfs);
		var config = await configService.InitAsync(root, "SSH Test", "app");
		var marsHome = Path.Combine(root, ".mars");
		var database = new DbSession(config, marsHome, vfs);
		database.Initialize();

		var environmentRepo = new LocalEnvironmentRepo(database);
		var selection = new LocalEnvironmentSelectionStore(root, vfs);
		var environmentService = new LocalEnvironmentService(config, environmentRepo, selection);
		var environment = await environmentService.CreateAsync("dev");

		var secretsRepo = new LocalSecretsRepo(database);
		var passwordSource = new FixedPassword();
		using var secrets = new LocalSecretsService(secretsRepo, environmentRepo, passwordSource);
		var tool = new SshKeygenTool(database, "dotnet", [typeof(Program).Assembly.Location], vfs, process, timer);
		var service = new LocalSshCaService(new LocalSshCaRepo(database), secrets, tool, timer);

		var ca = await service.CreateAsync(environment.Id, "main");
		var identity = await service.IssueAsync(environment.Id, "main", "developer", "alice");

		Assert.IsTrue(ca.PublicKey.StartsWith("ssh-ed25519 ", StringComparison.Ordinal));
		Assert.IsTrue(identity.PrivateKey.Contains("OPENSSH PRIVATE KEY", StringComparison.Ordinal));
		Assert.IsTrue(identity.Certificate.Contains("ssh-ed25519-cert-v01@openssh.com", StringComparison.Ordinal));
		Assert.IsEmpty(Directory.GetFileSystemEntries(Path.Combine(database.AppDirectory, "tmp")));
	}

	private class FixedPassword : IPasswordSource
	{
		public string GetPassword(string environmentName)
		{
			return "test-password";
		}
	}
}
