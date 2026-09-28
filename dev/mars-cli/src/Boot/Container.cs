using Mars.Cli.Commands;
using Mars.Cli.Lib;
using Mars.Core.App.Config;
using Mars.Core.App.Environment;
using Mars.Core.App.Kv;
using Mars.Core.App.Lock;
using Mars.Core.App.Node;
using Mars.Core.App.Secrets;
using Mars.Core.App.SshCa;
using Mars.Core.Lib;
using Mars.Local.App.LocalEnvironment;
using Mars.Local.App.LocalKv;
using Mars.Local.App.LocalLock;
using Mars.Local.App.LocalNode;
using Mars.Local.App.LocalSecrets;
using Mars.Local.App.LocalSshCa;
using Mars.Local.App.LocalWorkflow;
using Mars.Local.Db;
using Mars.Local.Lib;
using Microsoft.Extensions.DependencyInjection;
using Mars.Workflow.App.Workflow;

namespace Mars.Cli.Boot;

public static class Container
{
	public static async Task<ServiceProvider> CreateAsync(bool needsApp)
	{
		var services = new ServiceCollection();
		var vfs = new LocalVfs();
		var process = new LocalVProcess();
		var timer = new LocalVTimer();
		var configService = new ConfigService(vfs);

		RegisterCommandHandlers(services);
		services.AddSingleton<IBinaryOutput, ConsoleBinaryOutput>();
		services.AddSingleton<IVfs>(vfs);
		services.AddSingleton<IVTimer>(timer);
		services.AddSingleton<IVProcess>(process);
		services.AddSingleton(configService);
		services.AddSingleton<IWorkflowStorageProvider, LocalWorkflowStorageProvider>();
		services.AddTransient<WorkflowService>();

		if (needsApp)
		{
			var currentDirectory = process.CurrentDirectory;
			var location = await configService.FindAsync(currentDirectory);
			var appRoot = location.Root;
			var config = location.Config;
			var marsHome = StateDbSession.ResolveHome(process);
			var database = new StateDbSession(config, marsHome, vfs);
			database.Initialize();

			var selection = new LocalEnvironmentSelectionStore(appRoot, vfs);

			services.AddSingleton(config);
			services.AddSingleton(database);
			services.AddSingleton(selection);
			services.AddSingleton<IPasswordSource, ConsolePasswordSource>();

			services.AddSingleton<LocalEnvironmentRepo>();
			services.AddSingleton<LocalKvRepo>();
			services.AddSingleton<LocalKvObjectStore>();
			services.AddSingleton<LocalLockRepo>();
			services.AddSingleton<LocalNodeRepo>();
			services.AddSingleton<LocalSecretsRepo>();
			services.AddSingleton<LocalSshCaRepo>();

			services.AddSingleton<IEnvironmentService, LocalEnvironmentService>();
			services.AddSingleton<IKvService, LocalKvService>();
			services.AddSingleton<ILockService, LocalLockService>();
			services.AddSingleton<INodeService, LocalNodeService>();
			services.AddSingleton<ISecretsService, LocalSecretsService>();

			var executable = process.ExecutablePath;
			if (executable is null)
			{
				throw new AppException("Cannot locate Mars executable.");
			}

			var commandLine = process.CommandLineArguments;
			string[] prefix = [];
			if (commandLine[0].EndsWith(".dll", StringComparison.OrdinalIgnoreCase))
			{
				prefix = [commandLine[0]];
			}

			services.AddSingleton<ISshKeygenTool>(
				provider =>
				{
					var session = provider.GetRequiredService<StateDbSession>();
					var tool = new SshKeygenTool(session, executable, prefix, vfs, process, timer);

					return tool;
				}
			);
			services.AddSingleton<ISshCaService, LocalSshCaService>();
		}

		var container = services.BuildServiceProvider(validateScopes: true);

		return container;
	}

	private static void RegisterCommandHandlers(ServiceCollection services)
	{
		services.AddTransient<InitCommandHandler>();
		services.AddTransient<PathCommandHandler>();
		services.AddTransient<WfRunCommandHandler>();
		services.AddTransient<WfListCommandHandler>();
		services.AddTransient<WfLogsCommandHandler>();
		services.AddTransient<WfCheckCommandHandler>();
		services.AddTransient<WfGraphCommandHandler>();

		services.AddTransient<EnvCreateCommandHandler>();
		services.AddTransient<EnvListCommandHandler>();
		services.AddTransient<EnvShowCommandHandler>();
		services.AddTransient<EnvSelectCommandHandler>();
		services.AddTransient<EnvDeleteCommandHandler>();
		services.AddTransient<EnvPropertySetCommandHandler>();
		services.AddTransient<EnvPropertyRemoveCommandHandler>();

		services.AddTransient<KvSetCommandHandler>();
		services.AddTransient<KvGetCommandHandler>();
		services.AddTransient<KvShowCommandHandler>();
		services.AddTransient<KvGetFileCommandHandler>();
		services.AddTransient<KvListCommandHandler>();
		services.AddTransient<KvRemoveCommandHandler>();

		services.AddTransient<SshCaCreateCommandHandler>();
		services.AddTransient<SshCaListCommandHandler>();
		services.AddTransient<SshCaShowCommandHandler>();
		services.AddTransient<SshCaRemoveCommandHandler>();
		services.AddTransient<SshCaIssueCommandHandler>();

		services.AddTransient<NodeCreateCommandHandler>();
		services.AddTransient<NodeListCommandHandler>();
		services.AddTransient<NodeShowCommandHandler>();
		services.AddTransient<NodeRemoveCommandHandler>();
		services.AddTransient<NodeStatusCommandHandler>();
		services.AddTransient<NodePropertySetCommandHandler>();
		services.AddTransient<NodePropertyGetCommandHandler>();
		services.AddTransient<NodePropertyRemoveCommandHandler>();
		services.AddTransient<NodeTagAddCommandHandler>();
		services.AddTransient<NodeTagRemoveCommandHandler>();
		services.AddTransient<NodeEventCommandHandler>();

		services.AddTransient<LockAcquireCommandHandler>();
		services.AddTransient<LockRenewCommandHandler>();
		services.AddTransient<LockReleaseCommandHandler>();
	}
}
