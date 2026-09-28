using Mars.Lsp.App.Documents;
using Mars.Lsp.Lib;
using Mars.Workflow.App.Language;
using NUnit.Framework;
using Assert = NUnit.Framework.Legacy.ClassicAssert;

namespace Mars.Lsp.Tests.App.Documents;

public class DocumentServiceTests
{
	[Test]
	public async Task DeduplicatesSharedDiagnosticsAndClearsAfterEdit()
	{
		var published = new List<LspPublishDiagnosticsParams>();
		var path = Path.GetFullPath("shared.mwf");
		var uri = new Uri(path).AbsoluteUri;
		var validator = new SharedDiagnosticValidator(path);
		await using var service = new DocumentService(validator, (message, _) =>
		{
			published.Add(message);

			return Task.CompletedTask;
		});

		service.Open(uri, "bad", 1);
		await service.WaitForCurrentValidationAsync();

		Assert.AreEqual(1, published.Count);
		Assert.AreEqual(1, published[0].Diagnostics.Count);
		Assert.AreEqual(1, published[0].Version);

		service.Change(uri, "good", 2);
		await service.WaitForCurrentValidationAsync();

		Assert.AreEqual(2, published.Count);
		Assert.IsEmpty(published[1].Diagnostics);
		Assert.AreEqual(2, published[1].Version);
	}

	[Test]
	public async Task IgnoresStaleVersions()
	{
		var published = new List<LspPublishDiagnosticsParams>();
		var path = Path.GetFullPath("stale.mwf");
		var uri = new Uri(path).AbsoluteUri;
		var validator = new SharedDiagnosticValidator(path);
		await using var service = new DocumentService(validator, (message, _) =>
		{
			published.Add(message);

			return Task.CompletedTask;
		});

		service.Open(uri, "good", 2);
		service.Change(uri, "bad", 1);
		await service.WaitForCurrentValidationAsync();

		Assert.AreEqual(1, published.Count);
		Assert.IsEmpty(published[0].Diagnostics);
		Assert.AreEqual(2, published[0].Version);
	}

	[Test]
	public async Task RevalidatesSavedManifestAndClearsDiagnostic()
	{
		var directory = Path.Combine(
			TestContext.CurrentContext.WorkDirectory,
			$"manifest-change-{Guid.NewGuid():N}"
		);
		Directory.CreateDirectory(directory);
		try
		{
			var configPath = Path.Combine(directory, "mars.yml");
			var manifestPath = Path.Combine(directory, "mars-workflow.yml");
			var workflowPath = Path.Combine(directory, "example.mwf");
			var uri = new Uri(workflowPath).AbsoluteUri;
			File.WriteAllText(configPath, "mars_id: test\n");
			File.WriteAllText(manifestPath, "version: 2\n");
			var published = new List<LspPublishDiagnosticsParams>();
			await using var service = new DocumentService(
				new WorkflowValidator(),
				(message, _) =>
				{
					published.Add(message);

					return Task.CompletedTask;
				}
			);
			service.SetTrusted(true);
			service.Open(uri, "run 'echo hello'", 1);
			await service.WaitForCurrentValidationAsync();

			Assert.AreEqual(1, published.Count);
			Assert.IsNotEmpty(published[0].Diagnostics);

			File.WriteAllText(manifestPath, "version: 1\n");
			service.FilesChanged();
			await service.WaitForCurrentValidationAsync();

			Assert.AreEqual(2, published.Count);
			Assert.IsEmpty(published[1].Diagnostics);
		}
		finally
		{
			Directory.Delete(directory, true);
		}
	}

	[Test]
	public async Task MergesSharedDependencyAndClearsWhenLastRootCloses()
	{
		var firstPath = Path.GetFullPath("first-root.mwf");
		var secondPath = Path.GetFullPath("second-root.mwf");
		var sharedPath = Path.GetFullPath("shared-dependency.mwf");
		var firstUri = new Uri(firstPath).AbsoluteUri;
		var secondUri = new Uri(secondPath).AbsoluteUri;
		var sharedUri = new Uri(sharedPath).AbsoluteUri;
		var published = new List<LspPublishDiagnosticsParams>();
		var validator = new SharedDependencyValidator(sharedPath);
		await using var service = new DocumentService(validator, (message, _) =>
		{
			published.Add(message);

			return Task.CompletedTask;
		});

		service.Open(firstUri, "call ./shared-dependency", 1);
		service.Open(secondUri, "call ./shared-dependency", 1);
		await service.WaitForCurrentValidationAsync();

		var sharedReports = published.Where(item => item.Uri == sharedUri).ToArray();
		Assert.AreEqual(1, sharedReports.Length);
		Assert.AreEqual(1, sharedReports[0].Diagnostics.Count);

		service.Close(firstUri);
		await service.WaitForCurrentValidationAsync();
		var latestShared = published.Last(item => item.Uri == sharedUri);
		Assert.AreEqual(1, latestShared.Diagnostics.Count);

		service.Close(secondUri);
		await service.WaitForCurrentValidationAsync();
		latestShared = published.Last(item => item.Uri == sharedUri);
		Assert.IsEmpty(latestShared.Diagnostics);
	}

	[Test]
	public async Task DiscardsSlowValidationFromOlderEdit()
	{
		var path = Path.GetFullPath("slow.mwf");
		var uri = new Uri(path).AbsoluteUri;
		var published = new List<LspPublishDiagnosticsParams>();
		await using var service = new DocumentService(
			new SlowValidator(path),
			(message, _) =>
			{
				published.Add(message);

				return Task.CompletedTask;
			}
		);

		service.Open(uri, "bad", 1);
		await Task.Delay(150);
		service.Change(uri, "good", 2);
		await service.WaitForCurrentValidationAsync();

		Assert.AreEqual(1, published.Count);
		Assert.AreEqual(2, published[0].Version);
		Assert.IsEmpty(published[0].Diagnostics);
	}

	[Test]
	public async Task DecodesVsCodeWindowsFileUri()
	{
		if (!OperatingSystem.IsWindows())
		{
			Assert.Ignore("Windows file URI encoding applies only on Windows.");
		}

		var path = Path.GetFullPath("encoded-uri.mwf");
		var drive = char.ToLowerInvariant(path[0]);
		var remainder = path[2..].Replace('\\', '/');
		var uri = $"file:///{drive}%3A{remainder}";
		var validator = new RecordingPathValidator();
		await using var service = new DocumentService(validator, (_, _) => Task.CompletedTask);

		service.Open(uri, "workflow {}", 1);
		await service.WaitForCurrentValidationAsync();

		var pathsMatch = string.Equals(path, validator.LastPath, StringComparison.OrdinalIgnoreCase);
		Assert.IsTrue(pathsMatch);
	}

	private class SharedDiagnosticValidator : IWorkflowValidator
	{
		private readonly string path;

		public SharedDiagnosticValidator(string path)
		{
			this.path = path;
		}

		public Task<WorkflowValidationResult> ValidateAsync(
			IReadOnlyList<OpenWorkflowDocument> documents,
			bool trusted,
			CancellationToken cancellationToken
		)
		{
			var text = documents[0].Text;
			var diagnostics = new List<WorkflowDiagnostic>();
			if (text == "bad")
			{
				var span = new SourceSpan(this.path, 0, 3, 1, 1);
				var diagnostic = new WorkflowDiagnostic("WF100", "bad", span);
				diagnostics.Add(diagnostic);
				diagnostics.Add(diagnostic);
			}

			var sources = new Dictionary<string, string> { [this.path] = text };
			var result = new WorkflowValidationResult(diagnostics, sources);

			return Task.FromResult(result);
		}
	}

	private class SharedDependencyValidator : IWorkflowValidator
	{
		private readonly string sharedPath;

		public SharedDependencyValidator(string sharedPath)
		{
			this.sharedPath = sharedPath;
		}

		public Task<WorkflowValidationResult> ValidateAsync(
			IReadOnlyList<OpenWorkflowDocument> documents,
			bool trusted,
			CancellationToken cancellationToken
		)
		{
			var diagnostics = new List<WorkflowDiagnostic>();
			foreach (var document in documents)
			{
				if (!document.Text.Contains("call", StringComparison.Ordinal))
				{
					continue;
				}

				var span = new SourceSpan(this.sharedPath, 0, 3, 1, 1);
				var diagnostic = new WorkflowDiagnostic("WF100", "bad dependency", span);
				diagnostics.Add(diagnostic);
			}

			var sources = new Dictionary<string, string> { [this.sharedPath] = "bad" };
			var result = new WorkflowValidationResult(diagnostics, sources);

			return Task.FromResult(result);
		}
	}

	private class SlowValidator : IWorkflowValidator
	{
		private readonly string path;

		public SlowValidator(string path)
		{
			this.path = path;
		}

		public async Task<WorkflowValidationResult> ValidateAsync(
			IReadOnlyList<OpenWorkflowDocument> documents,
			bool trusted,
			CancellationToken cancellationToken
		)
		{
			var text = documents[0].Text;
			var diagnostics = new List<WorkflowDiagnostic>();
			if (text == "bad")
			{
				await Task.Delay(500, cancellationToken);
				var span = new SourceSpan(this.path, 0, 3, 1, 1);
				diagnostics.Add(new WorkflowDiagnostic("WF100", "bad", span));
			}

			var sources = new Dictionary<string, string> { [this.path] = text };
			var result = new WorkflowValidationResult(diagnostics, sources);

			return result;
		}
	}

	private class RecordingPathValidator : IWorkflowValidator
	{
		public string? LastPath { get; private set; }

		public Task<WorkflowValidationResult> ValidateAsync(
			IReadOnlyList<OpenWorkflowDocument> documents,
			bool trusted,
			CancellationToken cancellationToken
		)
		{
			this.LastPath = documents[0].Path;
			var sources = new Dictionary<string, string>();
			var result = new WorkflowValidationResult([], sources);

			return Task.FromResult(result);
		}
	}
}
