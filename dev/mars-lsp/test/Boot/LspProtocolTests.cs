using System.Diagnostics;
using System.Globalization;
using System.Text;
using System.Text.Json;
using Mars.Lsp.Lib;
using NUnit.Framework;
using Assert = NUnit.Framework.Legacy.ClassicAssert;

namespace Mars.Lsp.Tests.Boot;

public class LspProtocolTests
{
	[Test]
	public async Task PublishesAndClearsDiagnosticsThroughStdio()
	{
		var executable = System.Environment.GetEnvironmentVariable("MARS_LSP_TEST_BINARY");
		if (string.IsNullOrWhiteSpace(executable))
		{
			var root = AppContext.BaseDirectory;
			var configurationDirectory = Directory.GetParent(root.TrimEnd(Path.DirectorySeparatorChar))!;
			var configuration = configurationDirectory.Name;
			var serverName = OperatingSystem.IsWindows() ? "Mars.Lsp.exe" : "Mars.Lsp";
			executable = Path.GetFullPath(
				$"../../../Mars.Lsp/{configuration}/net10.0/{serverName}",
				root
			);
		}

		Assert.IsTrue(File.Exists(executable), $"Server executable is missing: {executable}");
		var startInfo = new ProcessStartInfo(executable)
		{
			RedirectStandardInput = true,
			RedirectStandardOutput = true,
			RedirectStandardError = true,
			UseShellExecute = false,
		};
		using var process = Process.Start(startInfo);
		Assert.IsNotNull(process);
		await using var transport = new LspTransport(
			process!.StandardOutput.BaseStream,
			process.StandardInput.BaseStream
		);
		using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(15));
		var token = timeout.Token;

		await SendAsync(transport, "initialize", 1, "{\"initializationOptions\":{\"trusted\":false}}", token);
		using var initialized = await transport.ReadAsync(token);
		Assert.AreEqual(1, initialized!.RootElement.GetProperty("id").GetInt32());
		Assert.IsTrue(initialized.RootElement.GetProperty("result").TryGetProperty("capabilities", out _));

		var malformedFrame = Encoding.ASCII.GetBytes("Content-Length: 1\r\n\r\nx");
		await process.StandardInput.BaseStream.WriteAsync(malformedFrame, token);
		await process.StandardInput.BaseStream.FlushAsync(token);

		var path = Path.GetFullPath("protocol.mwf");
		var uri = new Uri(path).AbsoluteUri;
		var openParams = JsonSerializer.Serialize(new
		{
			textDocument = new { uri, languageId = "mars-workflow", version = 1, text = "workflow {" },
		});
		await SendAsync(transport, "textDocument/didOpen", null, openParams, token);
		using var invalid = await transport.ReadAsync(token);
		var invalidParams = invalid!.RootElement.GetProperty("params");
		Assert.AreEqual(uri, invalidParams.GetProperty("uri").GetString());
		Assert.IsTrue(invalidParams.GetProperty("diagnostics").GetArrayLength() > 0);

		var changeParams = JsonSerializer.Serialize(new
		{
			textDocument = new { uri, version = 2 },
			contentChanges = new[] { new { text = "run 'echo hello'" } },
		});
		await SendAsync(transport, "textDocument/didChange", null, changeParams, token);
		using var valid = await transport.ReadAsync(token);
		var validParams = valid!.RootElement.GetProperty("params");
		Assert.AreEqual(2, validParams.GetProperty("version").GetInt32());
		Assert.AreEqual(0, validParams.GetProperty("diagnostics").GetArrayLength());

		await SendAsync(transport, "shutdown", 2, "null", token);
		using var shutdown = await transport.ReadAsync(token);
		Assert.AreEqual(2, shutdown!.RootElement.GetProperty("id").GetInt32());
		await SendAsync(transport, "exit", null, "null", token);
		await process.WaitForExitAsync(token);
		Assert.AreEqual(0, process.ExitCode);
	}

	private static async Task SendAsync(
		LspTransport transport,
		string method,
		int? id,
		string parameters,
		CancellationToken cancellationToken
	)
	{
		using var parsed = JsonDocument.Parse(parameters);
		JsonElement? requestId = null;
		if (id is not null)
		{
			var idText = id.Value.ToString(CultureInfo.InvariantCulture);
			using var parsedId = JsonDocument.Parse(idText);
			requestId = parsedId.RootElement.Clone();
		}

		var message = new LspEnvelope
		{
			Method = method,
			Id = requestId,
			Params = parsed.RootElement.Clone(),
		};
		await transport.WriteAsync(message, cancellationToken);
	}
}
