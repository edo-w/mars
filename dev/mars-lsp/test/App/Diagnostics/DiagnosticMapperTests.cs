using Mars.Lsp.App.Diagnostics;
using Mars.Workflow.App.Language;
using NUnit.Framework;
using Assert = NUnit.Framework.Legacy.ClassicAssert;

namespace Mars.Lsp.Tests.App.Diagnostics;

public class DiagnosticMapperTests
{
	[Test]
	public void MapsMultilineUtf16Offsets()
	{
		var source = "a😀\r\nbc\n";
		var span = new SourceSpan("example.mwf", 1, 6, 1, 2);
		var diagnostic = new WorkflowDiagnostic("WF100", "example", span);

		var mapped = DiagnosticMapper.Map(diagnostic, source);

		Assert.AreEqual(0, mapped.Range.Start.Line);
		Assert.AreEqual(1, mapped.Range.Start.Character);
		Assert.AreEqual(1, mapped.Range.End.Line);
		Assert.AreEqual(2, mapped.Range.End.Character);
		Assert.AreEqual("WF100", mapped.Code);
	}
}
