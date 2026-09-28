using Mars.Workflow.App.Modules;

namespace Mars.Lsp.App.Documents;

public class OverlayWorkflowSourceReader : IWorkflowSourceReader
{
	private readonly Dictionary<string, string> sources;

	public OverlayWorkflowSourceReader(IReadOnlyList<OpenWorkflowDocument> documents)
	{
		var pathComparer = OperatingSystem.IsWindows()
			? StringComparer.OrdinalIgnoreCase
			: StringComparer.Ordinal;
		this.sources = new Dictionary<string, string>(pathComparer);
		foreach (var document in documents)
		{
			this.sources[document.Path] = document.Text;
		}
	}

	public IReadOnlyDictionary<string, string> Sources => this.sources;

	public async Task<string> ReadAsync(string path, CancellationToken cancellationToken)
	{
		var fullPath = Path.GetFullPath(path);
		if (this.sources.TryGetValue(fullPath, out var openText))
		{
			return openText;
		}

		var text = await File.ReadAllTextAsync(fullPath, cancellationToken);
		this.sources[fullPath] = text;

		return text;
	}
}
