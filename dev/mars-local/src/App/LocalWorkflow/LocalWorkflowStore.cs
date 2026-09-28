using System.Globalization;
using System.Text.Json.Nodes;
using Mars.Local.Db;
using Mars.Workflow.App.Runtime;

namespace Mars.Local.App.LocalWorkflow;

public class LocalWorkflowStore : IWorkflowStore, IDisposable
{
	private readonly LocalWorkflowRepo repo;

	public LocalWorkflowStore(LocalWorkflowRepo repo)
	{
		this.repo = repo;
	}

	public Task CreateRunAsync(WorkflowRunRecord run, CancellationToken cancellationToken)
	{
		cancellationToken.ThrowIfCancellationRequested();
		var model = ToModel(run);
		this.repo.CreateRun(model);

		return Task.CompletedTask;
	}

	public Task UpdateRunAsync(WorkflowRunRecord run, CancellationToken cancellationToken)
	{
		cancellationToken.ThrowIfCancellationRequested();
		var model = ToModel(run);
		this.repo.UpdateRun(model);

		return Task.CompletedTask;
	}

	public Task CreateStepAsync(WorkflowStepRecord step, CancellationToken cancellationToken)
	{
		cancellationToken.ThrowIfCancellationRequested();
		var model = ToModel(step);
		this.repo.CreateStep(model);

		return Task.CompletedTask;
	}

	public Task UpdateStepAsync(WorkflowStepRecord step, CancellationToken cancellationToken)
	{
		cancellationToken.ThrowIfCancellationRequested();
		var model = ToModel(step);
		this.repo.UpdateStep(model);

		return Task.CompletedTask;
	}

	public Task AppendEventAsync(WorkflowEventRecord item, CancellationToken cancellationToken)
	{
		cancellationToken.ThrowIfCancellationRequested();
		var model = ToModel(item);
		this.repo.AppendEvent(model);

		return Task.CompletedTask;
	}

	public Task<WorkflowRunRecord?> GetRunAsync(Guid id, CancellationToken cancellationToken)
	{
		cancellationToken.ThrowIfCancellationRequested();
		var model = this.repo.GetRun(id.ToString());
		if (model is null)
		{
			return Task.FromResult<WorkflowRunRecord?>(null);
		}

		var run = ToRun(model);

		return Task.FromResult<WorkflowRunRecord?>(run);
	}

	public Task<IReadOnlyList<WorkflowRunRecord>> ListRunsAsync(CancellationToken cancellationToken)
	{
		cancellationToken.ThrowIfCancellationRequested();
		var models = this.repo.ListRuns();
		var runs = models.Select(ToRun).ToArray();
		IReadOnlyList<WorkflowRunRecord> result = runs;

		return Task.FromResult(result);
	}

	private static WorkflowRunRecord ToRun(WorkflowRunModel model)
	{
		var run = new WorkflowRunRecord
		{
			Id = Guid.Parse(model.Id),
			SourcePath = model.SourcePath,
			ManifestPath = model.ManifestPath,
			State = Enum.Parse<WorkflowRunState>(model.State),
			CreateDate = DateTimeOffset.Parse(model.CreateDate, CultureInfo.InvariantCulture),
			EndDate = ParseDate(model.EndDate),
			Input = ParseJson(model.InputJson),
			Output = ParseJson(model.OutputJson),
			Error = model.Error,
		};

		return run;
	}

	public void Dispose()
	{
		GC.SuppressFinalize(this);
	}

	private static WorkflowRunModel ToModel(WorkflowRunRecord run)
	{
		return new WorkflowRunModel
		{
			Id = run.Id.ToString(),
			SourcePath = run.SourcePath,
			ManifestPath = run.ManifestPath,
			State = run.State.ToString(),
			CreateDate = run.CreateDate.ToString("O", CultureInfo.InvariantCulture),
			EndDate = run.EndDate?.ToString("O", CultureInfo.InvariantCulture),
			InputJson = run.Input?.ToJsonString(),
			OutputJson = run.Output?.ToJsonString(),
			Error = run.Error,
		};
	}

	private static WorkflowStepModel ToModel(WorkflowStepRecord step)
	{
		return new WorkflowStepModel
		{
			Id = step.Id.ToString(),
			RunId = step.RunId.ToString(),
			SourceId = step.SourceId,
			SourcePath = step.SourcePath,
			SourceLine = step.SourceLine,
			SourceColumn = step.SourceColumn,
			Kind = step.Kind,
			Target = step.Target,
			State = step.State.ToString(),
			CreateDate = step.CreateDate.ToString("O", CultureInfo.InvariantCulture),
			EndDate = step.EndDate?.ToString("O", CultureInfo.InvariantCulture),
			InputJson = step.Input?.ToJsonString(),
			OutputJson = step.Output?.ToJsonString(),
			Error = step.Error,
		};
	}

	private static WorkflowEventModel ToModel(WorkflowEventRecord item)
	{
		return new WorkflowEventModel
		{
			Id = item.Id.ToString(),
			RunId = item.RunId.ToString(),
			StepId = item.StepId?.ToString(),
			Name = item.Name,
			Message = item.Message,
			DataJson = item.Data?.ToJsonString(),
			CreateDate = item.CreateDate.ToString("O", CultureInfo.InvariantCulture),
		};
	}

	private static DateTimeOffset? ParseDate(string? value)
	{
		if (value is null)
		{
			return null;
		}

		return DateTimeOffset.Parse(value, CultureInfo.InvariantCulture);
	}

	private static JsonNode? ParseJson(string? value)
	{
		return value is null ? null : JsonNode.Parse(value);
	}
}
