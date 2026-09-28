namespace Mars.Local.Db;

public class WorkflowRunModel
{
	public string Id { get; set; } = "";
	public string SourcePath { get; set; } = "";
	public string? ManifestPath { get; set; }
	public string State { get; set; } = "";
	public string CreateDate { get; set; } = "";
	public string? EndDate { get; set; }
	public string? InputJson { get; set; }
	public string? OutputJson { get; set; }
	public string? Error { get; set; }
}

public class WorkflowStepModel
{
	public string Id { get; set; } = "";
	public string RunId { get; set; } = "";
	public string SourceId { get; set; } = "";
	public string SourcePath { get; set; } = "";
	public int SourceLine { get; set; }
	public int SourceColumn { get; set; }
	public string Kind { get; set; } = "";
	public string Target { get; set; } = "";
	public string State { get; set; } = "";
	public string CreateDate { get; set; } = "";
	public string? EndDate { get; set; }
	public string? InputJson { get; set; }
	public string? OutputJson { get; set; }
	public string? Error { get; set; }
}

public class WorkflowEventModel
{
	public string Id { get; set; } = "";
	public string RunId { get; set; } = "";
	public string? StepId { get; set; }
	public string Name { get; set; } = "";
	public string? Message { get; set; }
	public string? DataJson { get; set; }
	public string CreateDate { get; set; } = "";
}
