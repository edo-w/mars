using Mars.Workflow.App.Language;

namespace Mars.Cli.Commands;

public static class WorkflowDiagnosticWriter
{
	public static async Task WriteAsync(
		IReadOnlyList<WorkflowDiagnostic> diagnostics,
		TextWriter error
	)
	{
		foreach (var item in diagnostics)
		{
			var location = $"{item.Span.Path}:{item.Span.Line}:{item.Span.Column}";
			await error.WriteLineAsync($"{location} {item.Code}: {item.Message}");
		}
	}
}
