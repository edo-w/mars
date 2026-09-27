using Mars.Cli.Commands;
using Mars.Core.App.Environment;
using Mars.Core.App.Kv;
using Moq;
using NUnit.Framework;
using Assert = NUnit.Framework.Legacy.ClassicAssert;
using MarsEnvironment = Mars.Core.App.Environment.Environment;

namespace Mars.Cli.Tests.Commands;

public class KvOutputTests
{
	[Test]
	public async Task ListAlignsColumnsAndShowsDatesToSeconds()
	{
		var environment = new MarsEnvironment(Guid.CreateVersion7(), "dev", "app", new Dictionary<string, string>());
		var environments = new Mock<IEnvironmentService>();
		environments.Setup(item => item.ResolveAsync(null)).ReturnsAsync(environment);
		var firstDate = new DateTimeOffset(2026, 9, 27, 11, 9, 54, 504, TimeSpan.Zero);
		var secondDate = new DateTimeOffset(2026, 9, 27, 11, 11, 9, 769, TimeSpan.Zero);
		IReadOnlyList<KvSummary> values =
		[
			new KvSummary(Guid.CreateVersion7(), "/foobar", 1, "text", false, 1, firstDate, firstDate),
			new KvSummary(Guid.CreateVersion7(), "/mysecret", 1, "text", true, 12, secondDate, secondDate),
		];
		var kv = new Mock<IKvService>();
		kv.Setup(item => item.ListAsync(environment.Id, "/")).ReturnsAsync(values);
		var handler = new KvListCommandHandler(environments.Object, kv.Object);
		var input = new KvListCommandInput(null, null);
		using var output = new StringWriter();
		var context = new CommandContext<KvListCommandInput>(input, output, TextWriter.Null, CancellationToken.None);

		var exitCode = await handler.HandleAsync(context);

		var expected = string.Join(output.NewLine,
			"/foobar    v1  text   1  no   2026-09-27 11:09:54",
			"/mysecret  v1  text  12  yes  2026-09-27 11:11:09",
			"");
		Assert.AreEqual(0, exitCode);
		Assert.AreEqual(expected, output.ToString());
	}

	[Test]
	public async Task ShowDisplaysUtcDatesToMilliseconds()
	{
		var environment = new MarsEnvironment(Guid.CreateVersion7(), "dev", "app", new Dictionary<string, string>());
		var environments = new Mock<IEnvironmentService>();
		environments.Setup(item => item.ResolveAsync(null)).ReturnsAsync(environment);
		var localDate = new DateTimeOffset(2026, 9, 27, 13, 9, 54, 504, TimeSpan.FromHours(2));
		var summary = new KvSummary(Guid.CreateVersion7(), "/foobar", 1, "text", false, 1, localDate, localDate);
		var kv = new Mock<IKvService>();
		kv.Setup(item => item.GetSummaryAsync(environment.Id, "/foobar")).ReturnsAsync(summary);
		var handler = new KvShowCommandHandler(environments.Object, kv.Object);
		var input = new KvShowCommandInput("/foobar", null);
		using var output = new StringWriter();
		var context = new CommandContext<KvShowCommandInput>(input, output, TextWriter.Null, CancellationToken.None);

		var exitCode = await handler.HandleAsync(context);

		Assert.AreEqual(0, exitCode);
		var lines = output.ToString().Split(System.Environment.NewLine, StringSplitOptions.RemoveEmptyEntries);
		Assert.IsTrue(lines[0].StartsWith("kv_id:", StringComparison.Ordinal));
		var createDateLine = lines.Single(line => line.StartsWith("create_date:", StringComparison.Ordinal));
		var updateDateLine = lines.Single(line => line.StartsWith("update_date:", StringComparison.Ordinal));
		Assert.IsTrue(createDateLine.EndsWith("2026-09-27 11:09:54.504", StringComparison.Ordinal));
		Assert.IsTrue(updateDateLine.EndsWith("2026-09-27 11:09:54.504", StringComparison.Ordinal));
	}
}
