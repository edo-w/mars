using Mars.Lsp.App.Diagnostics;
using Mars.Lsp.Lib;
using Mars.Workflow.App.Language;

namespace Mars.Lsp.App.Documents;

public class DocumentService : IAsyncDisposable
{
	private readonly IWorkflowValidator validator;
	private readonly Func<LspPublishDiagnosticsParams, CancellationToken, Task> publish;
	private readonly Dictionary<string, OpenWorkflowDocument> documents = new(StringComparer.Ordinal);
	private readonly HashSet<string> previousDiagnosticUris = new(StringComparer.Ordinal);
	private readonly List<Task> validations = [];
	private readonly object gate = new();
	private CancellationTokenSource? activeCancellation;
	private readonly SemaphoreSlim publicationGate = new(1, 1);
	private long generation;
	private bool trusted;

	public DocumentService(
		IWorkflowValidator validator,
		Func<LspPublishDiagnosticsParams, CancellationToken, Task> publish
	)
	{
		this.validator = validator;
		this.publish = publish;
	}

	public void Open(string uri, string text, int version)
	{
		var path = PathFromUri(uri);
		var document = new OpenWorkflowDocument(uri, path, text, version);
		lock (this.gate)
		{
			this.documents[uri] = document;
			this.QueueValidation();
		}
	}

	public void Change(string uri, string text, int version)
	{
		lock (this.gate)
		{
			if (!this.documents.TryGetValue(uri, out var previous))
			{
				return;
			}

			if (version <= previous.Version)
			{
				return;
			}

			this.documents[uri] = new OpenWorkflowDocument(uri, previous.Path, text, version);
			this.QueueValidation();
		}
	}

	public void Close(string uri)
	{
		lock (this.gate)
		{
			this.documents.Remove(uri);
			this.QueueValidation();
		}
	}

	public void SetTrusted(bool trusted)
	{
		lock (this.gate)
		{
			if (this.trusted == trusted)
			{
				return;
			}

			this.trusted = trusted;
			this.QueueValidation();
		}
	}

	public void FilesChanged()
	{
		lock (this.gate)
		{
			this.QueueValidation();
		}
	}

	public Task WaitForCurrentValidationAsync()
	{
		lock (this.gate)
		{
			var current = this.validations.LastOrDefault() ?? Task.CompletedTask;

			return current;
		}
	}

	private void QueueValidation()
	{
		this.generation++;
		this.activeCancellation?.Cancel();

		var cancellation = new CancellationTokenSource();
		this.activeCancellation = cancellation;
		var generation = this.generation;
		var cancellationToken = cancellation.Token;
		var snapshot = this.documents.Values.ToArray();
		var trusted = this.trusted;

		var task = Task.Run(
			() => this.ValidateAfterDelayAsync(snapshot, trusted, generation, cancellationToken),
			CancellationToken.None
		);
		this.validations.Add(task);
		this.validations.RemoveAll(item => item.IsCompleted);

		_ = task.ContinueWith(
			_ => this.ReleaseCancellation(cancellation),
			CancellationToken.None,
			TaskContinuationOptions.ExecuteSynchronously,
			TaskScheduler.Default
		);
	}

	private void ReleaseCancellation(CancellationTokenSource cancellation)
	{
		lock (this.gate)
		{
			if (ReferenceEquals(this.activeCancellation, cancellation))
			{
				this.activeCancellation = null;
			}
		}

		cancellation.Dispose();
	}

	private async Task ValidateAfterDelayAsync(
		IReadOnlyList<OpenWorkflowDocument> documents,
		bool trusted,
		long generation,
		CancellationToken cancellationToken
	)
	{
		try
		{
			await Task.Delay(100, cancellationToken);
			var result = await this.validator.ValidateAsync(documents, trusted, cancellationToken);
			await this.PublishAsync(documents, result, generation, cancellationToken);
		}
		catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
		{
		}
		catch (Exception exception)
		{
			if (cancellationToken.IsCancellationRequested)
			{
				return;
			}

			var sources = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
			var diagnostics = new List<WorkflowDiagnostic>();
			foreach (var document in documents)
			{
				sources[document.Path] = document.Text;
				var span = new SourceSpan(document.Path, 0, 0, 1, 1);
				var diagnostic = new WorkflowDiagnostic(
					"WF202",
					exception.Message,
					span
				);
				diagnostics.Add(diagnostic);
			}

			var result = new WorkflowValidationResult(diagnostics, sources);
			await this.PublishAsync(documents, result, generation, cancellationToken);
		}
	}

	private async Task PublishAsync(
		IReadOnlyList<OpenWorkflowDocument> documents,
		WorkflowValidationResult result,
		long generation,
		CancellationToken cancellationToken
	)
	{
		var byUri = new Dictionary<string, List<LspDiagnostic>>(StringComparer.Ordinal);
		var pathComparer = OperatingSystem.IsWindows()
			? StringComparer.OrdinalIgnoreCase
			: StringComparer.Ordinal;
		var openUrisByPath = documents.ToDictionary(
			item => item.Path,
			item => item.Uri,
			pathComparer
		);
		var unique = new HashSet<DiagnosticKey>();
		foreach (var diagnostic in result.Diagnostics)
		{
			var path = Path.GetFullPath(diagnostic.Span.Path);
			var uri = openUrisByPath.TryGetValue(path, out var openUri)
				? openUri
				: new Uri(path).AbsoluteUri;
			var source = result.Sources.TryGetValue(diagnostic.Span.Path, out var text)
				? text
				: "";
			var mapped = DiagnosticMapper.Map(diagnostic, source);
			var key = new DiagnosticKey(uri, mapped);
			if (!unique.Add(key))
			{
				continue;
			}

			if (!byUri.TryGetValue(uri, out var list))
			{
				list = [];
				byUri.Add(uri, list);
			}

			list.Add(mapped);
		}

		var currentDocuments = documents.ToDictionary(item => item.Uri, StringComparer.Ordinal);
		var uris = new HashSet<string>(byUri.Keys, StringComparer.Ordinal);
		foreach (var document in documents)
		{
			uris.Add(document.Uri);
		}

		lock (this.gate)
		{
			uris.UnionWith(this.previousDiagnosticUris);
		}

		await this.publicationGate.WaitAsync(cancellationToken);
		try
		{
			foreach (var uri in uris.Order(StringComparer.Ordinal))
			{
				lock (this.gate)
				{
					if (generation != this.generation)
					{
						return;
					}
				}

				byUri.TryGetValue(uri, out var diagnostics);
				currentDocuments.TryGetValue(uri, out var document);
				var message = new LspPublishDiagnosticsParams
				{
					Uri = uri,
					Version = document?.Version,
					Diagnostics = diagnostics ?? [],
				};
				await this.publish(message, cancellationToken);

				lock (this.gate)
				{
					if (message.Diagnostics.Count > 0)
					{
						this.previousDiagnosticUris.Add(uri);
					}
					else
					{
						this.previousDiagnosticUris.Remove(uri);
					}
				}
			}
		}
		finally
		{
			this.publicationGate.Release();
		}
	}

	private static string PathFromUri(string uriText)
	{
		var uri = new Uri(uriText, UriKind.Absolute);
		if (!uri.IsFile)
		{
			throw new InvalidDataException("Mars workflow documents need file URIs.");
		}

		var path = Uri.UnescapeDataString(uri.AbsolutePath);
		if (OperatingSystem.IsWindows())
		{
			var hasLeadingSlash = path.Length > 0 && path[0] == '/';
			var hasDriveLetter = path.Length >= 3 && char.IsLetter(path[1]) && path[2] == ':';
			if (hasLeadingSlash && hasDriveLetter)
			{
				path = path[1..];
			}

			if (!string.IsNullOrEmpty(uri.Host))
			{
				path = $"//{uri.Host}{path}";
			}
		}

		var fullPath = Path.GetFullPath(path);

		return fullPath;
	}

	public async ValueTask DisposeAsync()
	{
		Task[] pending;
		lock (this.gate)
		{
			this.activeCancellation?.Cancel();
			pending = [.. this.validations];
		}

		await Task.WhenAll(pending);
		this.publicationGate.Dispose();
		GC.SuppressFinalize(this);
	}

	private readonly record struct DiagnosticKey(
		string Uri,
		string Code,
		string Message,
		int StartLine,
		int StartCharacter,
		int EndLine,
		int EndCharacter
	)
	{
		public DiagnosticKey(string uri, LspDiagnostic diagnostic)
			: this(
				uri,
				diagnostic.Code,
				diagnostic.Message,
				diagnostic.Range.Start.Line,
				diagnostic.Range.Start.Character,
				diagnostic.Range.End.Line,
				diagnostic.Range.End.Character
			)
		{
		}
	}
}
