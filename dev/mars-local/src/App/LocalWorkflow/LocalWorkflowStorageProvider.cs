using Mars.Core.App.Config;
using Mars.Core.Lib;
using Mars.Local.Db;
using Mars.Workflow.App.Runtime;
using Mars.Workflow.App.Workflow;

namespace Mars.Local.App.LocalWorkflow;

public class LocalWorkflowStorageProvider : IWorkflowStorageProvider
{
	private readonly ConfigService configService;
	private readonly IVProcess process;

	public LocalWorkflowStorageProvider(ConfigService configService, IVProcess process)
	{
		this.configService = configService;
		this.process = process;
	}

	public async Task<IWorkflowStorage> OpenForRunAsync(
		string sourcePath,
		CancellationToken cancellationToken
	)
	{
		cancellationToken.ThrowIfCancellationRequested();
		var sourceDirectory = Path.GetDirectoryName(sourcePath)!;
		var location = await this.configService.TryFindAsync(sourceDirectory);
		var session = this.CreateSession(location?.Config.Id);
		session.Initialize();

		return CreateStorage(session);
	}

	public async Task<IWorkflowStorage?> OpenForHistoryAsync(CancellationToken cancellationToken)
	{
		cancellationToken.ThrowIfCancellationRequested();
		var currentDirectory = this.process.CurrentDirectory;
		var location = await this.configService.TryFindAsync(currentDirectory);
		var session = this.CreateSession(location?.Config.Id);
		var databaseExists = File.Exists(session.DatabasePath);
		if (!databaseExists)
		{
			return null;
		}

		session.Initialize();

		return CreateStorage(session);
	}

	private WorkflowDbSession CreateSession(Guid? appId)
	{
		var marsHome = StateDbSession.ResolveHome(this.process);
		var session = new WorkflowDbSession(marsHome, appId);

		return session;
	}

	private static LocalWorkflowStorage CreateStorage(WorkflowDbSession session)
	{
		var repo = new LocalWorkflowRepo(session);
		var store = new LocalWorkflowStore(repo);
		var logs = new LocalWorkflowLogStore(session);
		var storage = new LocalWorkflowStorage(store, logs);

		return storage;
	}
}

public class LocalWorkflowStorage : IWorkflowStorage
{
	private readonly LocalWorkflowStore store;

	public LocalWorkflowStorage(LocalWorkflowStore store, LocalWorkflowLogStore logs)
	{
		this.store = store;
		this.Store = store;
		this.Logs = logs;
	}

	public IWorkflowStore Store { get; }
	public IWorkflowLogStore Logs { get; }

	public ValueTask DisposeAsync()
	{
		this.store.Dispose();
		GC.SuppressFinalize(this);

		return ValueTask.CompletedTask;
	}
}
