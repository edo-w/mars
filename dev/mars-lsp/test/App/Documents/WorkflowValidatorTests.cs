using Mars.Lsp.App.Documents;
using NUnit.Framework;
using Assert = NUnit.Framework.Legacy.ClassicAssert;

namespace Mars.Lsp.Tests.App.Documents;

public class WorkflowValidatorTests
{
	[Test]
	public async Task ChecksUnsavedTextWithoutWritingState()
	{
		var path = Path.GetFullPath("unsaved.mwf");
		var uri = new Uri(path).AbsoluteUri;
		var document = new OpenWorkflowDocument(uri, path, "workflow {", 1);
		var validator = new WorkflowValidator();

		var invalid = await validator.ValidateAsync([document], false, CancellationToken.None);

		Assert.IsNotEmpty(invalid.Diagnostics);
		Assert.IsFalse(File.Exists(path));

		var fixedDocument = new OpenWorkflowDocument(uri, path, "run 'echo hello'", 2);
		var valid = await validator.ValidateAsync([fixedDocument], false, CancellationToken.None);

		Assert.IsEmpty(valid.Diagnostics);
		Assert.IsFalse(File.Exists(path));
	}

	[Test]
	public async Task UntrustedValidationSkipsModuleDiscovery()
	{
		var path = Path.GetFullPath("untrusted.mwf");
		var uri = new Uri(path).AbsoluteUri;
		var source = "use fixture/missing\n";
		var document = new OpenWorkflowDocument(uri, path, source, 1);
		var validator = new WorkflowValidator();

		var syntaxOnly = await validator.ValidateAsync([document], false, CancellationToken.None);
		var trusted = await validator.ValidateAsync([document], true, CancellationToken.None);

		Assert.IsEmpty(syntaxOnly.Diagnostics);
		Assert.IsNotEmpty(trusted.Diagnostics);
	}

	[Test]
	public async Task ReadsUnsavedCalledWorkflowWithMwfExtension()
	{
		var root = Path.GetFullPath("parent.mwf");
		var child = Path.GetFullPath("child.mwf");
		var rootDocument = new OpenWorkflowDocument(
			new Uri(root).AbsoluteUri,
			root,
			"call ./child",
			1
		);
		var invalidChild = new OpenWorkflowDocument(
			new Uri(child).AbsoluteUri,
			child,
			"workflow {",
			1
		);
		var validator = new WorkflowValidator();

		var invalid = await validator.ValidateAsync(
			[rootDocument, invalidChild],
			true,
			CancellationToken.None
		);

		Assert.IsTrue(invalid.Diagnostics.Any(item => item.Span.Path == child));
		Assert.IsFalse(File.Exists(child));

		var validChild = new OpenWorkflowDocument(
			invalidChild.Uri,
			child,
			"workflow {}",
			2
		);
		var valid = await validator.ValidateAsync(
			[rootDocument, validChild],
			true,
			CancellationToken.None
		);

		Assert.IsEmpty(valid.Diagnostics);
	}

	[Test]
	public async Task DescribesOnlyImportedModule()
	{
		var workspace = FindWorkspaceRoot();
		var directory = Path.Combine(
			TestContext.CurrentContext.WorkDirectory,
			$"module-{Guid.NewGuid():N}"
		);
		Directory.CreateDirectory(directory);
		try
		{
			var fixture = Path.Combine(
				workspace,
				"dev",
				"mars-workflow",
				"sdk",
				"typescript",
				"test",
				"fixture-module.ts"
			);
			var fixtureArgument = fixture.Replace('\\', '/');
			var manifest = $"""
				version: 1
				modules:
				  - path: fixture/math
				    command: bun
				    args:
				      - '{fixtureArgument}'
				  - path: fixture/unused
				    command: deliberately-missing-mars-program
				""";
			File.WriteAllText(Path.Combine(directory, "mars.yml"), "mars_id: test\n");
			File.WriteAllText(Path.Combine(directory, "mars-workflow.yml"), manifest);
			var path = Path.Combine(directory, "example.mwf");
			var uri = new Uri(path).AbsoluteUri;
			var document = new OpenWorkflowDocument(uri, path, "use fixture/math *\n", 1);
			var validator = new WorkflowValidator();

			var result = await validator.ValidateAsync([document], true, CancellationToken.None);

			Assert.IsEmpty(result.Diagnostics);
		}
		finally
		{
			Directory.Delete(directory, true);
		}
	}

	[Test]
	public async Task ReportsMissingCalledWorkflowInCallingFile()
	{
		var root = Path.GetFullPath("missing-call-root.mwf");
		var uri = new Uri(root).AbsoluteUri;
		var document = new OpenWorkflowDocument(uri, root, "call ./missing-child", 1);
		var validator = new WorkflowValidator();

		var result = await validator.ValidateAsync([document], true, CancellationToken.None);

		Assert.IsTrue(result.Diagnostics.Any(item => item.Code == "WF201"));
		Assert.IsTrue(result.Diagnostics.All(item => item.Span.Path == root));
	}

	[Test]
	public async Task TimesOutModuleThatDoesNotDescribeItself()
	{
		var directory = CreateTestDirectory("module-timeout");
		try
		{
			var scriptPath = Path.Combine(directory, "hang.js");
			File.WriteAllText(scriptPath, "process.stdin.resume();\n");
			var document = CreateModuleDocument(directory, "fixture/hang", scriptPath);
			var validator = new WorkflowValidator(TimeSpan.FromMilliseconds(200));

			var result = await validator.ValidateAsync([document], true, CancellationToken.None);

			Assert.IsTrue(result.Diagnostics.Any(item => item.Message.Contains(
				"did not finish describing itself",
				StringComparison.Ordinal
			)));
		}
		finally
		{
			Directory.Delete(directory, true);
		}
	}

	[Test]
	public async Task ReusesModuleDescriptionUntilManifestChanges()
	{
		var directory = CreateTestDirectory("module-cache");
		try
		{
			var scriptPath = Path.Combine(directory, "describe.js");
			var countPath = Path.Combine(directory, "describe-count.txt");
			var script = """
				import { appendFileSync } from 'node:fs';
				let buffer = '';
				process.stdin.setEncoding('utf8');
				process.stdin.on('data', chunk => {
				  buffer += chunk;
				  const lines = buffer.split('\n');
				  buffer = lines.pop() ?? '';
				  for (const line of lines) {
				    const request = JSON.parse(line);
				    if (request.type !== 'describe') continue;
				    appendFileSync(process.argv[2], '1\n');
				    const output = { module: 'fixture/cached', exports: [] };
				    const response = { v: 1, id: request.id, type: 'ret', status: 'ok', output };
				    process.stdout.write(JSON.stringify(response) + '\n');
				  }
				});
				""";
			File.WriteAllText(scriptPath, script);
			var document = CreateModuleDocument(
				directory,
				"fixture/cached",
				scriptPath,
				countPath
			);
			var validator = new WorkflowValidator();

			var first = await validator.ValidateAsync([document], true, CancellationToken.None);
			var second = await validator.ValidateAsync([document], true, CancellationToken.None);
			var firstCount = File.ReadAllLines(countPath).Length;

			var manifestPath = Path.Combine(directory, "mars-workflow.yml");
			File.AppendAllText(manifestPath, "# changed\n");
			var third = await validator.ValidateAsync([document], true, CancellationToken.None);
			var secondCount = File.ReadAllLines(countPath).Length;

			Assert.IsEmpty(first.Diagnostics);
			Assert.IsEmpty(second.Diagnostics);
			Assert.IsEmpty(third.Diagnostics);
			Assert.AreEqual(1, firstCount);
			Assert.AreEqual(2, secondCount);
		}
		finally
		{
			Directory.Delete(directory, true);
		}
	}

	private static string CreateTestDirectory(string name)
	{
		var directory = Path.Combine(
			TestContext.CurrentContext.WorkDirectory,
			$"{name}-{Guid.NewGuid():N}"
		);
		Directory.CreateDirectory(directory);

		return directory;
	}

	private static OpenWorkflowDocument CreateModuleDocument(
		string directory,
		string modulePath,
		string scriptPath,
		string? extraArgument = null
	)
	{
		var scriptArgument = scriptPath.Replace('\\', '/');
		var arguments = $"      - '{scriptArgument}'\n";
		if (extraArgument is not null)
		{
			var additionalArgument = extraArgument.Replace('\\', '/');
			arguments += $"      - '{additionalArgument}'\n";
		}
		var manifest = $"""
			version: 1
			modules:
			  - path: {modulePath}
			    command: bun
			    args:
			{arguments}
			""";
		File.WriteAllText(Path.Combine(directory, "mars.yml"), "mars_id: test\n");
		File.WriteAllText(Path.Combine(directory, "mars-workflow.yml"), manifest);
		var path = Path.Combine(directory, "example.mwf");
		var uri = new Uri(path).AbsoluteUri;
		var source = $"use {modulePath} *\n";

		return new OpenWorkflowDocument(uri, path, source, 1);
	}

	private static string FindWorkspaceRoot()
	{
		DirectoryInfo? directory = new(TestContext.CurrentContext.TestDirectory);
		while (directory is not null)
		{
			var solutionPath = Path.Combine(directory.FullName, "dev", "mars.slnx");
			if (File.Exists(solutionPath))
			{
				return directory.FullName;
			}

			directory = directory.Parent;
		}

		throw new InvalidOperationException("Cannot locate the Mars workspace.");
	}
}
