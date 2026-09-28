using Mars.Workflow.App.Workflow;
using Mars.Workflow.App.Runtime;

namespace Mars.Cli.Commands;

public class WfRunCommandHandler
{
	private readonly WorkflowService service;

	public WfRunCommandHandler(WorkflowService service)
	{
		this.service = service;
	}

	public async Task<int> HandleAsync(CommandContext<WfRunCommandInput> context)
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

		var root = session.Compilation.Root!;
		var input = await this.service.ParseInputAsync(
			root.Input,
			context.Input.InputFile,
			context.Input.InputJson,
			context.Input.InputPairs,
			context.CancellationToken
		);
		var result = await this.service.RunAsync(
			session,
			input,
			item => WriteEventAsync(item, context.Output),
			context.CancellationToken
		);
		await context.Output.WriteLineAsync($"run_id  {result.Run.Id}");
		await context.Output.WriteLineAsync($"status  {result.Run.State.ToString().ToLowerInvariant()}");

		if (result.Run.Output is not null)
		{
			await context.Output.WriteLineAsync(result.Run.Output.ToJsonString());
		}

		if (!result.Succeeded)
		{
			await context.Error.WriteLineAsync(result.Run.Error);

			return result.Run.State == WorkflowRunState.Cancelled ? 130 : 1;
		}

		return 0;
	}

	private static Task WriteEventAsync(WorkflowEventRecord item, TextWriter output)
	{
		if (item.Name != "step.progress" || item.Message is null)
		{
			return Task.CompletedTask;
		}

		return output.WriteLineAsync(item.Message);
	}
}
