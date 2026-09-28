using Mars.Workflow.App.Workflow;
using Mars.Workflow.App.Graph;

namespace Mars.Cli.Commands;

public class WfGraphCommandHandler
{
	private readonly WorkflowService service;

	public WfGraphCommandHandler(WorkflowService service)
	{
		this.service = service;
	}

	public async Task<int> HandleAsync(CommandContext<WfGraphCommandInput> context)
	{
		var format = context.Input.Format;
		if (format != "dot" && format != "json")
		{
			await context.Error.WriteLineAsync("--format must be dot or json.");

			return 1;
		}

		await using var session = await this.service.CompileAsync(
			context.Input.Path,
			context.CancellationToken
		);
		if (!session.Compilation.IsValid)
		{
			await WorkflowDiagnosticWriter.WriteAsync(session.Compilation.Diagnostics, context.Error);

			return 1;
		}

		var builder = new WorkflowGraphBuilder();
		var graph = builder.Build(session.Compilation.Root!);
		var text = format == "json"
			? WorkflowGraphRenderer.ToJson(graph)
			: WorkflowGraphRenderer.ToDot(graph);
		await context.Output.WriteLineAsync(text);

		return 0;
	}
}
