using System.Globalization;
using System.Text;
using System.Text.Json;

namespace Mars.Lsp.Lib;

public class LspTransport : IAsyncDisposable
{
	private const int MaximumHeaderBytes = 8192;
	private const int MaximumBodyBytes = 16 * 1024 * 1024;
	private readonly Stream input;
	private readonly Stream output;
	private readonly SemaphoreSlim writeGate = new(1, 1);

	public LspTransport(Stream input, Stream output)
	{
		this.input = input;
		this.output = output;
	}

	public async Task<JsonDocument?> ReadAsync(CancellationToken cancellationToken)
	{
		var header = new List<byte>();
		var singleByte = new byte[1];
		while (true)
		{
			var count = await this.input.ReadAsync(singleByte, cancellationToken);
			if (count == 0)
			{
				if (header.Count == 0)
				{
					return null;
				}

				throw new EndOfStreamException("Incomplete LSP header.");
			}

			header.Add(singleByte[0]);
			if (header.Count > MaximumHeaderBytes)
			{
				throw new InvalidDataException("LSP header is too large.");
			}

			if (HeaderComplete(header))
			{
				break;
			}
		}

		var headerText = Encoding.ASCII.GetString([.. header]);
		var contentLength = ParseContentLength(headerText);
		var body = new byte[contentLength];
		await this.input.ReadExactlyAsync(body, cancellationToken);
		var document = JsonDocument.Parse(body);

		return document;
	}

	private static bool HeaderComplete(List<byte> header)
	{
		if (header.Count < 4)
		{
			return false;
		}

		var start = header.Count - 4;
		var firstReturn = header[start] == 13;
		var firstNewline = header[start + 1] == 10;
		var secondReturn = header[start + 2] == 13;
		var secondNewline = header[start + 3] == 10;
		var result = firstReturn && firstNewline && secondReturn && secondNewline;

		return result;
	}

	public async Task WriteAsync(LspEnvelope message, CancellationToken cancellationToken)
	{
		var body = JsonSerializer.SerializeToUtf8Bytes(message, LspJsonContext.Default.LspEnvelope);
		var header = $"Content-Length: {body.Length.ToString(CultureInfo.InvariantCulture)}\r\n\r\n";
		var headerBytes = Encoding.ASCII.GetBytes(header);

		await this.writeGate.WaitAsync(cancellationToken);
		try
		{
			await this.output.WriteAsync(headerBytes, cancellationToken);
			await this.output.WriteAsync(body, cancellationToken);
			await this.output.FlushAsync(cancellationToken);
		}
		finally
		{
			this.writeGate.Release();
		}
	}

	private static int ParseContentLength(string header)
	{
		var lines = header.Split("\r\n", StringSplitOptions.RemoveEmptyEntries);
		foreach (var line in lines)
		{
			var separator = line.IndexOf(':');
			if (separator < 0)
			{
				continue;
			}

			var name = line[..separator].Trim();
			if (!name.Equals("Content-Length", StringComparison.OrdinalIgnoreCase))
			{
				continue;
			}

			var value = line[(separator + 1)..].Trim();
			var isNumber = int.TryParse(
				value,
				NumberStyles.None,
				CultureInfo.InvariantCulture,
				out var length
			);
			if (!isNumber || length < 0 || length > MaximumBodyBytes)
			{
				throw new InvalidDataException("Invalid LSP Content-Length.");
			}

			return length;
		}

		throw new InvalidDataException("LSP message has no Content-Length.");
	}

	public ValueTask DisposeAsync()
	{
		this.writeGate.Dispose();
		GC.SuppressFinalize(this);

		return ValueTask.CompletedTask;
	}
}
