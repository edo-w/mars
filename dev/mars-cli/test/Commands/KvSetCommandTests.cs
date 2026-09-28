using System.Text;
using Mars.Cli.Boot;
using Mars.Cli.Commands;
using Mars.Cli.Lib;
using Mars.Core.App.Environment;
using Mars.Core.App.Kv;
using Mars.Core.App.Secrets;
using Mars.Core.Lib;
using Mars.Local.App.LocalEnvironment;
using Mars.Local.App.LocalKv;
using Mars.Local.App.LocalSecrets;
using Mars.Core.App.Config;
using Mars.Local.Lib;
using Mars.Local.Db;
using Microsoft.Extensions.DependencyInjection;
using Moq;
using NUnit.Framework;
using Assert = NUnit.Framework.Legacy.ClassicAssert;

namespace Mars.Cli.Tests.Commands;

public class KvSetCommandTests
{
	[Test]
	public async Task SetAcceptsValueAndFileWithIndependentSecretFlag()
	{
		var root = Path.Combine(
			TestContext.CurrentContext.WorkDirectory,
			"test-state",
			Guid.NewGuid().ToString("N")
		);
		Directory.CreateDirectory(root);

		var vfs = new LocalVfs();
		var timer = new LocalVTimer();
		var configService = new ConfigService(vfs);
		var config = await configService.InitAsync(root, "KV Command Test", "app");
		var marsHome = Path.Combine(root, ".mars");
		var database = new StateDbSession(config, marsHome, vfs);
		database.Initialize();

		var environmentRepo = new LocalEnvironmentRepo(database);
		var selection = new LocalEnvironmentSelectionStore(root, vfs);
		var environments = new LocalEnvironmentService(config, environmentRepo, selection);
		var environment = await environments.CreateAsync("dev");

		var passwordSource = new FixedPassword();
		var secretsRepo = new LocalSecretsRepo(database);
		using var secrets = new LocalSecretsService(secretsRepo, environmentRepo, passwordSource);
		var kvRepo = new LocalKvRepo(database);
		var objects = new LocalKvObjectStore(database, vfs);
		var kv = new LocalKvService(kvRepo, secrets, timer, objects);
		var stdinBytes = new byte[] { 4, 5, 6 };
		var process = new Mock<IVProcess>();
		process.Setup(item => item.OpenStandardInput())
			.Returns(() => new MemoryStream(stdinBytes));

		var services = new ServiceCollection();
		services.AddSingleton<IEnvironmentService>(environments);
		services.AddSingleton<IKvService>(kv);
		services.AddSingleton<IVfs>(vfs);
		services.AddSingleton<IVProcess>(process.Object);
		services.AddTransient<KvSetCommandHandler>();
		using var container = services.BuildServiceProvider();
		var command = CliCommands.Create(container);

		var valueInput = command.Parse(["kv", "set", "/token", "--env", "app/dev", "--value", "hidden", "--secret"]);
		Assert.IsEmpty(valueInput.Errors);
		var valueExitCode = await valueInput.InvokeAsync();
		Assert.AreEqual(0, valueExitCode);

		var storedValue = await kv.GetAsync(environment.Id, "/token");
		Assert.AreEqual("hidden", Encoding.UTF8.GetString(storedValue!.Value));
		Assert.IsTrue(storedValue.IsSecret);

		var filePath = Path.Combine(root, "input.bin");
		var fileBytes = new byte[] { 0, 1, 2, 255 };
		await File.WriteAllBytesAsync(filePath, fileBytes);

		var fileInput = command.Parse(["kv", "set", "/file", "--env", "app/dev", "--file", filePath]);
		Assert.IsEmpty(fileInput.Errors);
		var fileExitCode = await fileInput.InvokeAsync();
		Assert.AreEqual(0, fileExitCode);

		var storedFile = await kv.GetAsync(environment.Id, "/file");
		Assert.AreEqual("file", storedFile!.Type);
		Assert.IsTrue(storedFile.Value.AsSpan().SequenceEqual(fileBytes));

		var stdinInput = command.Parse(["kv", "set", "/input", "--env", "app/dev", "--input", "--secret"]);
		Assert.IsEmpty(stdinInput.Errors);
		var stdinExitCode = await stdinInput.InvokeAsync();
		Assert.AreEqual(0, stdinExitCode);

		var storedInput = await kv.GetAsync(environment.Id, "/input");
		Assert.IsNotNull(storedInput);
		Assert.IsTrue(storedInput!.IsSecret);
		Assert.IsTrue(storedInput.Value.AsSpan().SequenceEqual(stdinBytes));
	}

	public class FixedPassword : IPasswordSource
	{
		public string GetPassword(string environmentName)
		{
			return "test-password";
		}
	}

	[Test]
	public async Task RawGetWritesBytesAndShowWritesMetadata()
	{
		var root = Path.Combine(
			TestContext.CurrentContext.WorkDirectory,
			"test-state",
			Guid.NewGuid().ToString("N")
		);
		Directory.CreateDirectory(root);

		var vfs = new LocalVfs();
		var timer = new LocalVTimer();
		var configService = new ConfigService(vfs);
		var config = await configService.InitAsync(root, "KV Command Test", "app");
		var marsHome = Path.Combine(root, ".mars");
		var database = new StateDbSession(config, marsHome, vfs);
		database.Initialize();

		var environmentRepo = new LocalEnvironmentRepo(database);
		var selection = new LocalEnvironmentSelectionStore(root, vfs);
		var environments = new LocalEnvironmentService(config, environmentRepo, selection);
		var environment = await environments.CreateAsync("dev");

		var passwordSource = new FixedPassword();
		var secretsRepo = new LocalSecretsRepo(database);
		using var secrets = new LocalSecretsService(secretsRepo, environmentRepo, passwordSource);
		var kvRepo = new LocalKvRepo(database);
		var objects = new LocalKvObjectStore(database, vfs);
		var kv = new LocalKvService(kvRepo, secrets, timer, objects);
		var value = new byte[] { 0, 1, 2, 255 };
		await kv.SetAsync(environment.Id, "/binary", value, "file", true);

		var binaryOutput = new CapturedBinaryOutput();
		var rawHandler = new KvGetCommandHandler(environments, kv, binaryOutput);
		using var rawText = new StringWriter();
		var rawInput = new KvGetCommandInput("/binary", null, true, "app/dev");
		var rawContext = new CommandContext<KvGetCommandInput>(
			rawInput,
			rawText,
			TextWriter.Null,
			CancellationToken.None
		);

		var rawExitCode = await rawHandler.HandleAsync(rawContext);

		Assert.AreEqual(0, rawExitCode);
		Assert.IsTrue(binaryOutput.Bytes.AsSpan().SequenceEqual(value));
		Assert.AreEqual("", rawText.ToString());

		var showHandler = new KvShowCommandHandler(environments, kv);
		using var showText = new StringWriter();
		var showInput = new KvShowCommandInput("/binary", "app/dev");
		var showContext = new CommandContext<KvShowCommandInput>(
			showInput,
			showText,
			TextWriter.Null,
			CancellationToken.None
		);

		var showExitCode = await showHandler.HandleAsync(showContext);
		var metadata = showText.ToString();

		Assert.AreEqual(0, showExitCode);
		var lines = metadata.Split(System.Environment.NewLine, StringSplitOptions.RemoveEmptyEntries);
		var keyLine = lines.Single(line => line.StartsWith("key:", StringComparison.Ordinal));
		var sizeLine = lines.Single(line => line.StartsWith("size:", StringComparison.Ordinal));
		var secretLine = lines.Single(line => line.StartsWith("secret:", StringComparison.Ordinal));
		Assert.IsTrue(keyLine.EndsWith("/binary", StringComparison.Ordinal));
		Assert.IsTrue(sizeLine.EndsWith('4'));
		Assert.IsTrue(secretLine.EndsWith("yes", StringComparison.Ordinal));
	}

	public class CapturedBinaryOutput : IBinaryOutput
	{
		public byte[] Bytes { get; private set; } = [];

		public Task WriteAsync(ReadOnlyMemory<byte> bytes, CancellationToken cancellationToken)
		{
			this.Bytes = bytes.ToArray();

			return Task.CompletedTask;
		}
	}
}
