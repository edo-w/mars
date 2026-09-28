using Mars.Workflow.App.Language;

namespace Mars.Lsp.App.Documents;

public class OpenWorkflowDocument
{
	public OpenWorkflowDocument(string uri, string path, string text, int version)
	{
		this.Uri = uri;
		this.Path = path;
		this.Text = text;
		this.Version = version;
	}

	public string Uri { get; }
	public string Path { get; }
	public string Text { get; }
	public int Version { get; }
}

public class WorkflowValidationResult
{
	public WorkflowValidationResult(
		IReadOnlyList<WorkflowDiagnostic> diagnostics,
		IReadOnlyDictionary<string, string> sources
	)
	{
		this.Diagnostics = diagnostics;
		this.Sources = sources;
	}

	public IReadOnlyList<WorkflowDiagnostic> Diagnostics { get; }
	public IReadOnlyDictionary<string, string> Sources { get; }
}

public interface IWorkflowValidator
{
	Task<WorkflowValidationResult> ValidateAsync(
		IReadOnlyList<OpenWorkflowDocument> documents,
		bool trusted,
		CancellationToken cancellationToken
	);
}
