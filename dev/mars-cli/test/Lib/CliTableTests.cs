using Mars.Cli.Lib;
using NUnit.Framework;
using Assert = NUnit.Framework.Legacy.ClassicAssert;

namespace Mars.Cli.Tests.Lib;

public class CliTableTests
{
	[Test]
	public async Task WritesAlignedColumnsWithTwoSpaceGaps()
	{
		var table = new CliTable();
		table.RightAlignColumn(1);
		table.SetMinimumWidth(2, 3);
		table.AddRow("a", "2", "no", "x");
		table.AddRow("long", "12", "yes", "y");
		using var output = new StringWriter();

		await table.WriteAsync(output);

		var expected = string.Join(output.NewLine,
			"a      2  no   x",
			"long  12  yes  y",
			"");
		Assert.AreEqual(expected, output.ToString());
	}
}
