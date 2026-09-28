using Mars.Workflow.App.Compiler;
using Mars.Workflow.App.Language;
using Mars.Workflow.App.Modules;
using Mars.Workflow.App.Workflow;

namespace Mars.Lsp.App.Documents;

public class WorkflowValidator : IWorkflowValidator
{
	private readonly Dictionary<string, CachedModule> moduleCache = new(StringComparer.Ordinal);
	private readonly object cacheGate = new();
	private readonly TimeSpan descriptionTimeout;
	private static readonly TimeSpan CacheLifetime = TimeSpan.FromSeconds(30);

	public WorkflowValidator(TimeSpan? descriptionTimeout = null)
	{
		this.descriptionTimeout = descriptionTimeout ?? TimeSpan.FromSeconds(10);
	}

	public async Task<WorkflowValidationResult> ValidateAsync(
		IReadOnlyList<OpenWorkflowDocument> documents,
		bool trusted,
		CancellationToken cancellationToken
	)
	{
		var reader = new OverlayWorkflowSourceReader(documents);
		var diagnostics = new List<WorkflowDiagnostic>();
		foreach (var document in documents)
		{
			cancellationToken.ThrowIfCancellationRequested();
			if (trusted)
			{
				await ValidateFullAsync(document, reader, diagnostics, cancellationToken);
			}
			else
			{
				ValidateSyntax(document, diagnostics);
			}
		}

		var result = new WorkflowValidationResult(diagnostics, reader.Sources);

		return result;
	}

	private async Task ValidateFullAsync(
		OpenWorkflowDocument document,
		OverlayWorkflowSourceReader reader,
		List<WorkflowDiagnostic> diagnostics,
		CancellationToken cancellationToken
	)
	{
		try
		{
			var manifest = WorkflowManifestLoader.Find(document.Path);
			var modules = new EditorModuleCatalog(this, manifest);
			var compiler = new WorkflowCompiler(reader, modules);
			var compilation = await compiler.CompileAsync(document.Path, cancellationToken);
			diagnostics.AddRange(compilation.Diagnostics);
		}
		catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
		{
			throw;
		}
		catch (Exception exception)
		{
			var span = new SourceSpan(document.Path, 0, 0, 1, 1);
			var diagnostic = new WorkflowDiagnostic("WF202", exception.Message, span);
			diagnostics.Add(diagnostic);
		}
	}

	private async Task<WorkflowModule?> GetModuleAsync(
		WorkflowManifest? manifest,
		string modulePath,
		CancellationToken cancellationToken
	)
	{
		if (manifest is null)
		{
			return null;
		}

		var manifestText = File.ReadAllText(manifest.Path);
		var cacheKey = $"{manifest.Path}\n{modulePath}";
		lock (this.cacheGate)
		{
			if (this.moduleCache.TryGetValue(cacheKey, out var cached))
			{
				var manifestMatches = cached.ManifestText == manifestText;
				var isFresh = cached.ExpireDate > DateTimeOffset.UtcNow;
				if (manifestMatches && isFresh)
				{
					return cached.Module;
				}
			}
		}

		using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
		timeout.CancelAfter(this.descriptionTimeout);
		WorkflowModule? module;
		try
		{
			await using var catalog = new WorkflowModuleCatalog(manifest);
			module = await catalog.GetAsync(modulePath, timeout.Token);
		}
		catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
		{
			throw new TimeoutException(
				$"Module '{modulePath}' did not finish describing itself within {this.descriptionTimeout.TotalSeconds:0.##} seconds."
			);
		}

		if (module is not null)
		{
			var expireDate = DateTimeOffset.UtcNow.Add(CacheLifetime);
			var entry = new CachedModule(manifestText, module, expireDate);
			lock (this.cacheGate)
			{
				this.moduleCache[cacheKey] = entry;
			}
		}

		return module;
	}

	private static void ValidateSyntax(
		OpenWorkflowDocument document,
		List<WorkflowDiagnostic> diagnostics
	)
	{
		var lexer = new WorkflowLexer(document.Text, document.Path);
		var tokens = lexer.Lex();
		var parser = new WorkflowParser(tokens, document.Path);
		parser.Parse();
		diagnostics.AddRange(lexer.Diagnostics);
		diagnostics.AddRange(parser.Diagnostics);
	}

	private record CachedModule(string ManifestText, WorkflowModule Module, DateTimeOffset ExpireDate);

	private class EditorModuleCatalog : IWorkflowModuleCatalog
	{
		private readonly WorkflowValidator owner;
		private readonly WorkflowManifest? manifest;

		public EditorModuleCatalog(WorkflowValidator owner, WorkflowManifest? manifest)
		{
			this.owner = owner;
			this.manifest = manifest;
		}

		public Task<WorkflowModule?> GetAsync(
			string modulePath,
			CancellationToken cancellationToken
		)
		{
			return this.owner.GetModuleAsync(this.manifest, modulePath, cancellationToken);
		}
	}
}
