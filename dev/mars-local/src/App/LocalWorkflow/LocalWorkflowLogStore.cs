using Mars.Local.Db;
using Mars.Workflow.App.Runtime;

namespace Mars.Local.App.LocalWorkflow;

public class LocalWorkflowLogStore : IWorkflowLogStore
{
	private readonly WorkflowDbSession session;

	public LocalWorkflowLogStore(WorkflowDbSession session)
	{
		this.session = session;
	}

	public async Task<IReadOnlyList<WorkflowLogFile>> ReadAsync(
		Guid runId,
		CancellationToken cancellationToken
	)
	{
		var directory = Path.Combine(this.session.LogDirectory, runId.ToString());
		if (!Directory.Exists(directory))
		{
			return [];
		}

		var paths = Directory.GetFiles(directory);
		Array.Sort(paths, StringComparer.Ordinal);
		var files = new List<WorkflowLogFile>(paths.Length);

		foreach (var path in paths)
		{
			var name = Path.GetFileName(path);
			var content = await File.ReadAllTextAsync(path, cancellationToken);
			var file = new WorkflowLogFile(name, content);
			files.Add(file);
		}

		return files;
	}

	public Task<Stream> OpenWriteAsync(
		Guid runId,
		string fileName,
		bool append,
		CancellationToken cancellationToken
	)
	{
		cancellationToken.ThrowIfCancellationRequested();
		var isFileName = Path.GetFileName(fileName) == fileName;
		if (!isFileName)
		{
			throw new ArgumentException("Log name must be a file name.", nameof(fileName));
		}

		var directory = Path.Combine(this.session.LogDirectory, runId.ToString());
		Directory.CreateDirectory(directory);
		var path = Path.Combine(directory, fileName);
		var mode = append ? FileMode.Append : FileMode.Create;
		Stream stream = new FileStream(
			path,
			mode,
			FileAccess.Write,
			FileShare.Read,
			4096,
			useAsync: true
		);

		return Task.FromResult(stream);
	}
}
