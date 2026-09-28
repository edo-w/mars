using System.Globalization;
using System.Text.Json.Nodes;
using Mars.Workflow.App.Runtime;

namespace Mars.Workflow.App.Workflow;

public class WorkflowEventLogWriter : IDisposable
{
	private readonly IWorkflowLogStore logs;
	private readonly SemaphoreSlim gate = new(1, 1);

	public WorkflowEventLogWriter(IWorkflowLogStore logs)
	{
		this.logs = logs;
	}

	public async Task WriteAsync(WorkflowEventRecord item, CancellationToken cancellationToken)
	{
		var record = new JsonObject
		{
			["id"] = item.Id.ToString(),
			["run_id"] = item.RunId.ToString(),
			["step_id"] = item.StepId?.ToString(),
			["name"] = item.Name,
			["message"] = item.Message,
			["data"] = item.Data?.DeepClone(),
			["create_date"] = item.CreateDate.ToString("O", CultureInfo.InvariantCulture),
		};
		var line = record.ToJsonString();

		await this.gate.WaitAsync(cancellationToken);
		try
		{
			var stream = await this.logs.OpenWriteAsync(
				item.RunId,
				"events.jsonl",
				true,
				cancellationToken
			);
			await using var writer = new StreamWriter(stream);
			await writer.WriteLineAsync(line.AsMemory(), cancellationToken);
		}
		finally
		{
			this.gate.Release();
		}
	}

	public void Dispose()
	{
		this.gate.Dispose();
		GC.SuppressFinalize(this);
	}
}
