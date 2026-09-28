using Mars.Workflow.App.Workflow;

namespace Mars.Cli.Commands;

public class WfLogsCommandHandler
{
	private readonly WorkflowService service;

	public WfLogsCommandHandler(WorkflowService service)
	{
		this.service = service;
	}

	public async Task<int> HandleAsync(CommandContext<WfLogsCommandInput> context)
	{
		var logs = await this.service.ReadLogsAsync(
			context.Input.RunId,
			context.CancellationToken
		);
		var state = logs.Run.State.ToString().ToLowerInvariant();
		await context.Output.WriteLineAsync($"run_id  {logs.Run.Id}");
		await context.Output.WriteLineAsync($"status  {state}");

		foreach (var file in logs.Files)
		{
			if (string.IsNullOrWhiteSpace(file.Content))
			{
				continue;
			}

			await context.Output.WriteLineAsync();
			await context.Output.WriteLineAsync($"== {file.Name} ==");
			await context.Output.WriteAsync(file.Content);

			if (!file.Content.EndsWith('\n'))
			{
				await context.Output.WriteLineAsync();
			}
		}

		return 0;
	}
}
