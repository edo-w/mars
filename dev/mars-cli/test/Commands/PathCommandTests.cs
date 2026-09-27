using Mars.Cli.Boot;
using Mars.Cli.Commands;
using Mars.Core.App.Config;
using Mars.Core.Lib;
using Mars.Local.Db;
using Mars.Local.Lib;
using Microsoft.Extensions.DependencyInjection;
using Moq;
using NUnit.Framework;
using Assert = NUnit.Framework.Legacy.ClassicAssert;

namespace Mars.Cli.Tests.Commands;

public class PathCommandTests
{
	[Test]
	public async Task PathShowsExistingAppLocations()
	{
		var root = Path.Combine(TestContext.CurrentContext.WorkDirectory, "test-state",
			Guid.NewGuid().ToString("N"));
		Directory.CreateDirectory(root);

		var vfs = new LocalVfs();
		var configService = new ConfigService(vfs);
		var config = await configService.InitAsync(root, "Paths", "app");
		var marsHome = Path.Combine(root, ".mars-home");
		var database = new DbSession(config, marsHome, vfs);
		database.Initialize();
		var checkoutState = Path.Combine(root, ".mars");
		var selection = Path.Combine(checkoutState, "selected-environment");
		var environmentId = Guid.CreateVersion7();
		var kvDirectory = Path.Combine(database.AppDirectory, "env", environmentId.ToString(), "kv");
		vfs.CreateDirectory(checkoutState);
		vfs.WriteText(selection, "app/dev");
		vfs.CreateDirectory(kvDirectory);

		var process = new Mock<IVProcess>();
		process.SetupGet(item => item.CurrentDirectory).Returns(root);
		process.Setup(item => item.GetEnvironmentVariable("MARS_HOME")).Returns(marsHome);
		var services = new ServiceCollection();
		services.AddSingleton(configService);
		services.AddSingleton<IVfs>(vfs);
		services.AddSingleton<IVProcess>(process.Object);
		services.AddTransient<PathCommandHandler>();
		using var container = services.BuildServiceProvider();
		var command = CliCommands.Create(container);
		using var output = new StringWriter();
		var input = new PathCommandInput();
		var context = new CommandContext<PathCommandInput>(input, output, TextWriter.Null,
			CancellationToken.None);
		var handler = container.GetRequiredService<PathCommandHandler>();

		var parseResult = command.Parse(["path"]);
		var exitCode = await handler.HandleAsync(context);
		var text = output.ToString();
		var lines = text.Split(Environment.NewLine, StringSplitOptions.RemoveEmptyEntries);
		var configPath = Path.Combine(root, "mars.yml");
		var pathColumn = lines[0].IndexOf(marsHome, StringComparison.Ordinal);
		var localStateLine = lines.Single(line => line.EndsWith(checkoutState, StringComparison.Ordinal));
		var selectionLine = lines.Single(line => line.EndsWith(selection, StringComparison.Ordinal));
		var databaseLine = lines.Single(line => line.EndsWith(database.DatabasePath, StringComparison.Ordinal));
		var kvLine = lines.Single(line => line.EndsWith(kvDirectory, StringComparison.Ordinal));

		Assert.IsEmpty(parseResult.Errors);
		Assert.AreEqual(0, exitCode);
		Assert.IsTrue(pathColumn > 0);
		Assert.AreEqual("mars_home", lines[0][..pathColumn].Trim());
		Assert.AreEqual("config", lines[1][..pathColumn].Trim());
		Assert.AreEqual(pathColumn, lines[1].IndexOf(configPath, StringComparison.Ordinal));
		Assert.AreEqual("local_state", localStateLine[..pathColumn].Trim());
		Assert.AreEqual("environment", selectionLine[..pathColumn].Trim());
		Assert.AreEqual("state_db", databaseLine[..pathColumn].Trim());
		Assert.AreEqual($"kv_objects {environmentId}", kvLine[..pathColumn].Trim());
		Assert.AreEqual(pathColumn, selectionLine.IndexOf(selection, StringComparison.Ordinal));
		Assert.AreEqual(pathColumn, databaseLine.IndexOf(database.DatabasePath, StringComparison.Ordinal));
		Assert.AreEqual(pathColumn, kvLine.IndexOf(kvDirectory, StringComparison.Ordinal));
		Assert.IsFalse(text.Contains("temp_dir", StringComparison.Ordinal));
	}

	[Test]
	public async Task PathIsSilentWhenNoAppConfigExists()
	{
		var vfs = new Mock<IVfs>();
		var configService = new ConfigService(vfs.Object);
		var process = new Mock<IVProcess>();
		process.SetupGet(item => item.CurrentDirectory)
			.Returns(TestContext.CurrentContext.WorkDirectory);
		var handler = new PathCommandHandler(configService, vfs.Object, process.Object);
		var input = new PathCommandInput();
		using var output = new StringWriter();
		var context = new CommandContext<PathCommandInput>(input, output, TextWriter.Null,
			CancellationToken.None);

		var exitCode = await handler.HandleAsync(context);

		Assert.AreEqual(0, exitCode);
		Assert.IsEmpty(output.ToString());
	}
}
