using Mars.Core.App.Config;
using Mars.Core.Lib;
using Mars.Cli.Lib;
using Mars.Local.Db;

namespace Mars.Cli.Commands;

public class PathCommandHandler
{
	private readonly ConfigService configService;
	private readonly IVfs vfs;
	private readonly IVProcess process;

	public PathCommandHandler(ConfigService configService, IVfs vfs, IVProcess process)
	{
		this.configService = configService;
		this.vfs = vfs;
		this.process = process;
	}

	public async Task<int> HandleAsync(CommandContext<PathCommandInput> context)
	{
		var currentDirectory = this.process.CurrentDirectory;
		var location = await this.configService.TryFindAsync(currentDirectory);
		if (location is null)
		{
			return 0;
		}

		var configPath = Path.Combine(location.Root, "mars.yml");
		var checkoutDirectory = Path.Combine(location.Root, ".mars");
		var selectedEnvironmentPath = Path.Combine(checkoutDirectory, "selected-environment");
		var marsHome = DbSession.ResolveHome(this.process);
		var database = new DbSession(location.Config, marsHome, this.vfs);
		var environmentDirectory = Path.Combine(database.AppDirectory, "env");
		var temporaryDirectory = Path.Combine(database.AppDirectory, "tmp");
		var paths = new CliTable();

		this.AddDirectoryIfExists(paths, "mars_home", marsHome);
		paths.AddRow("config", configPath);
		this.AddDirectoryIfExists(paths, "local_state", checkoutDirectory);
		this.AddFileIfExists(paths, "environment", selectedEnvironmentPath);
		this.AddDirectoryIfExists(paths, "app_state", database.AppDirectory);
		this.AddFileIfExists(paths, "state_db", database.DatabasePath);
		this.AddDirectoryIfExists(paths, "environments", environmentDirectory);
		this.AddDirectoryIfExists(paths, "temp_dir", temporaryDirectory);

		if (this.vfs.DirectoryExists(environmentDirectory))
		{
			var entries = this.vfs.ListDirectory(environmentDirectory);
			foreach (var entry in entries)
			{
				var path = Path.Combine(environmentDirectory, entry);
				if (!this.vfs.DirectoryExists(path))
				{
					continue;
				}

				paths.AddRow($"environment {entry}", path);

				var kvDirectory = Path.Combine(path, "kv");
				this.AddDirectoryIfExists(paths, $"kv_objects {entry}", kvDirectory);
			}
		}

		await paths.WriteAsync(context.Output);

		return 0;
	}

	private void AddDirectoryIfExists(CliTable paths, string label, string path)
	{
		if (this.vfs.DirectoryExists(path))
		{
			paths.AddRow(label, path);
		}
	}

	private void AddFileIfExists(CliTable paths, string label, string path)
	{
		if (this.vfs.FileExists(path))
		{
			paths.AddRow(label, path);
		}
	}

}
