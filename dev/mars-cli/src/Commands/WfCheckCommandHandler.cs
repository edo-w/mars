using Mars.Workflow.App.Workflow;

namespace Mars.Cli.Commands;

public class WfCheckCommandHandler
{
	private readonly WorkflowService service;

	public WfCheckCommandHandler(WorkflowService service)
	{
		this.service = service;
	}

	public async Task<int> HandleAsync(CommandContext<WfCheckCommandInput> context)
	{
		await using var session = await this.service.CompileAsync(
			context.Input.Path,
			context.CancellationToken
		);
		if (!session.Compilation.IsValid)
		{
			await WorkflowDiagnosticWriter.WriteAsync(session.Compilation.Diagnostics, context.Error);

			return 1;
		}

		await context.Output.WriteLineAsync("Workflow is valid.");

		return 0;
	}
}
