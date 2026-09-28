using Mars.Workflow.App.Workflow;
using NUnit.Framework;
using Assert = NUnit.Framework.Legacy.ClassicAssert;

namespace Mars.Lsp.Tests.App.Documents;

public class WorkflowManifestLoaderTests
{
	[Test]
	public void UsesMarsConfigAsManifestAnchor()
	{
		var testDirectory = Path.Combine(
			TestContext.CurrentContext.WorkDirectory,
			$"manifest-{Guid.NewGuid():N}"
		);
		var childDirectory = Path.Combine(testDirectory, "nested");
		Directory.CreateDirectory(childDirectory);
		try
		{
			File.WriteAllText(Path.Combine(testDirectory, "mars.yml"), "mars_id: test\n");
			File.WriteAllText(Path.Combine(testDirectory, "mars-workflow.yml"), "version: 1\n");
			File.WriteAllText(Path.Combine(childDirectory, "mars-workflow.yml"), "version: 2\n");
			var source = Path.Combine(childDirectory, "deploy.mwf");

			var manifest = WorkflowManifestLoader.Find(source);

			Assert.IsNotNull(manifest);
			Assert.AreEqual(
				Path.Combine(testDirectory, "mars-workflow.yml"),
				manifest!.Path
			);
		}
		finally
		{
			Directory.Delete(testDirectory, true);
		}
	}
}
