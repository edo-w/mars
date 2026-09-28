using Mars.Workflow.App.Workflow;
using Mars.Cli.Lib;

namespace Mars.Cli.Commands;

public class WfListCommandHandler
{
	private readonly WorkflowService service;

	public WfListCommandHandler(WorkflowService service)
	{
		this.service = service;
	}

	public async Task<int> HandleAsync(CommandContext<WfListCommandInput> context)
	{
		var runs = await this.service.ListRunsAsync(context.CancellationToken);
		var table = new CliTable();
		table.AddRow("run_id", "status", "workflow", "start_date", "end_date");

		foreach (var run in runs)
		{
			var state = run.State.ToString().ToLowerInvariant();
			var startDate = CliDateFormatter.ForList(run.CreateDate);
			var endDate = run.EndDate is null ? "" : CliDateFormatter.ForList(run.EndDate.Value);
			table.AddRow(run.Id.ToString(), state, run.SourcePath, startDate, endDate);
		}

		await table.WriteAsync(context.Output);

		return 0;
	}
}
