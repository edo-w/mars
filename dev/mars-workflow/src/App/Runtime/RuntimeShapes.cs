using System.Text.Json.Nodes;
using Mars.Workflow.App.Compiler;
using Mars.Workflow.App.Types;

namespace Mars.Workflow.App.Runtime;

public enum WorkflowRunState
{
	Pending,
	Running,
	Succeeded,
	Failed,
	Cancelled,
}

public class WorkflowRunRecord
{
	public Guid Id { get; init; }
	public string SourcePath { get; init; } = "";
	public string? ManifestPath { get; init; }
	public WorkflowRunState State { get; set; }
	public DateTimeOffset CreateDate { get; init; }
	public DateTimeOffset? EndDate { get; set; }
	public JsonNode? Input { get; init; }
	public JsonNode? Output { get; set; }
	public string? Error { get; set; }
}

public class WorkflowStepRecord
{
	public Guid Id { get; init; }
	public Guid RunId { get; init; }
	public string SourceId { get; init; } = "";
	public string SourcePath { get; init; } = "";
	public int SourceLine { get; init; }
	public int SourceColumn { get; init; }
	public string Kind { get; init; } = "";
	public string Target { get; init; } = "";
	public WorkflowRunState State { get; set; }
	public DateTimeOffset CreateDate { get; init; }
	public DateTimeOffset? EndDate { get; set; }
	public JsonNode? Input { get; init; }
	public JsonNode? Output { get; set; }
	public string? Error { get; set; }
}

public class WorkflowEventRecord
{
	public Guid Id { get; init; }
	public Guid RunId { get; init; }
	public Guid? StepId { get; init; }
	public string Name { get; init; } = "";
	public string? Message { get; init; }
	public JsonNode? Data { get; init; }
	public DateTimeOffset CreateDate { get; init; }
}

public class WorkflowExecutionResult
{
	public WorkflowExecutionResult(WorkflowRunRecord run)
	{
		this.Run = run;
	}

	public WorkflowRunRecord Run { get; }
	public bool Succeeded => this.Run.State == WorkflowRunState.Succeeded;
}

public class WorkflowLogFile
{
	public WorkflowLogFile(string name, string content)
	{
		this.Name = name;
		this.Content = content;
	}

	public string Name { get; }
	public string Content { get; }
}

public class WorkflowOperationContext
{
	public WorkflowOperationContext(
		Guid runId,
		Guid stepId,
		string workingDirectory,
		IReadOnlyDictionary<string, string> environment,
		Func<string, int?, CancellationToken, Task> progress
	)
	{
		this.RunId = runId;
		this.StepId = stepId;
		this.WorkingDirectory = workingDirectory;
		this.Environment = environment;
		this.Progress = progress;
	}

	public Guid RunId { get; }
	public Guid StepId { get; }
	public string WorkingDirectory { get; }
	public IReadOnlyDictionary<string, string> Environment { get; }
	public Func<string, int?, CancellationToken, Task> Progress { get; }
}

public interface IWorkflowStore
{
	Task CreateRunAsync(WorkflowRunRecord run, CancellationToken cancellationToken);
	Task UpdateRunAsync(WorkflowRunRecord run, CancellationToken cancellationToken);
	Task CreateStepAsync(WorkflowStepRecord step, CancellationToken cancellationToken);
	Task UpdateStepAsync(WorkflowStepRecord step, CancellationToken cancellationToken);
	Task AppendEventAsync(WorkflowEventRecord item, CancellationToken cancellationToken);
	Task<WorkflowRunRecord?> GetRunAsync(Guid id, CancellationToken cancellationToken);
	Task<IReadOnlyList<WorkflowRunRecord>> ListRunsAsync(CancellationToken cancellationToken);
}

public interface IWorkflowLogStore
{
	Task<IReadOnlyList<WorkflowLogFile>> ReadAsync(Guid runId, CancellationToken cancellationToken);
	Task<Stream> OpenWriteAsync(
		Guid runId,
		string fileName,
		bool append,
		CancellationToken cancellationToken
	);
}

public interface IWorkflowOperationHost
{
	Task<JsonNode?> InvokeTaskAsync(
		BoundStep step,
		JsonNode? input,
		WorkflowOperationContext context,
		CancellationToken cancellationToken
	);

	Task<JsonNode?> InvokeFunctionAsync(
		BoundFunction function,
		JsonNode? input,
		Guid runId,
		Func<string, int?, CancellationToken, Task> progress,
		CancellationToken cancellationToken
	);
}

public class WorkflowRuntimeException : Exception
{
	public WorkflowRuntimeException(string message) : base(message)
	{
	}

	public WorkflowRuntimeException(string message, Exception inner) : base(message, inner)
	{
	}
}
