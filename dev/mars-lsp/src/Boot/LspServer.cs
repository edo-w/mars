using System.Text.Json;
using Mars.Lsp.App.Documents;
using Mars.Lsp.Lib;

namespace Mars.Lsp.Boot;

public class LspServer : IAsyncDisposable
{
	private readonly LspTransport transport;
	private readonly DocumentService documents;
	private readonly TextWriter error;
	private bool shutdown;

	public LspServer(Stream input, Stream output, TextWriter error)
	{
		this.transport = new LspTransport(input, output);
		this.error = error;
		var validator = new WorkflowValidator();
		this.documents = new DocumentService(validator, this.PublishDiagnosticsAsync);
	}

	public async Task<int> RunAsync(CancellationToken cancellationToken)
	{
		while (true)
		{
			JsonDocument? message;
			try
			{
				message = await this.transport.ReadAsync(cancellationToken);
			}
			catch (JsonException exception)
			{
				await this.error.WriteLineAsync($"Invalid LSP JSON message: {exception.Message}");

				continue;
			}
			catch (Exception exception) when (exception is not OperationCanceledException)
			{
				await this.error.WriteLineAsync($"LSP transport failed: {exception.Message}");

				return 1;
			}

			if (message is null)
			{
				return this.shutdown ? 0 : 1;
			}

			using var currentMessage = message;
			try
			{
				var root = currentMessage.RootElement;
				var method = ReadString(root, "method");
				if (method is null)
				{
					continue;
				}

				var shouldExit = await this.HandleAsync(root, method, cancellationToken);
				if (shouldExit)
				{
					return this.shutdown ? 0 : 1;
				}
			}
			catch (Exception exception) when (exception is not OperationCanceledException)
			{
				await this.error.WriteLineAsync(exception.ToString());
				var root = currentMessage.RootElement;
				var isObject = root.ValueKind == JsonValueKind.Object;
				if (isObject && root.TryGetProperty("id", out var id))
				{
					await this.SendErrorAsync(id, -32603, exception.Message, cancellationToken);
				}
			}
		}
	}

	private async Task<bool> HandleAsync(
		JsonElement root,
		string method,
		CancellationToken cancellationToken
	)
	{
		if (method == "initialize")
		{
			var parameters = root.GetProperty("params");
			var options = ReadObject(parameters, "initializationOptions");
			var trusted = ReadBoolean(options, "trusted");
			this.documents.SetTrusted(trusted);
			var result = new LspInitializeResult();
			var resultJson = JsonSerializer.SerializeToElement(
				result,
				LspJsonContext.Default.LspInitializeResult
			);
			var response = new LspEnvelope
			{
				Id = root.GetProperty("id").Clone(),
				Result = resultJson,
			};
			await this.transport.WriteAsync(response, cancellationToken);

			return false;
		}

		if (method == "shutdown")
		{
			this.shutdown = true;
			using var nullValue = JsonDocument.Parse("null");
			var response = new LspEnvelope
			{
				Id = root.GetProperty("id").Clone(),
				Result = nullValue.RootElement.Clone(),
			};
			await this.transport.WriteAsync(response, cancellationToken);

			return false;
		}

		if (method == "exit")
		{
			return true;
		}

		if (method == "textDocument/didOpen")
		{
			var document = root.GetProperty("params").GetProperty("textDocument");
			var uri = document.GetProperty("uri").GetString()!;
			var text = document.GetProperty("text").GetString()!;
			var version = document.GetProperty("version").GetInt32();
			this.documents.Open(uri, text, version);

			return false;
		}

		if (method == "textDocument/didChange")
		{
			var parameters = root.GetProperty("params");
			var document = parameters.GetProperty("textDocument");
			var changes = parameters.GetProperty("contentChanges");
			if (changes.GetArrayLength() == 0)
			{
				return false;
			}

			var uri = document.GetProperty("uri").GetString()!;
			var version = document.GetProperty("version").GetInt32();
			var text = changes[changes.GetArrayLength() - 1].GetProperty("text").GetString()!;
			this.documents.Change(uri, text, version);

			return false;
		}

		if (method == "textDocument/didClose")
		{
			var document = root.GetProperty("params").GetProperty("textDocument");
			var uri = document.GetProperty("uri").GetString()!;
			this.documents.Close(uri);

			return false;
		}

		if (method == "workspace/didChangeWatchedFiles")
		{
			this.documents.FilesChanged();

			return false;
		}

		if (method == "mars/workspaceTrustChanged")
		{
			var parameters = root.GetProperty("params");
			var trusted = ReadBoolean(parameters, "trusted");
			this.documents.SetTrusted(trusted);

			return false;
		}

		if (root.TryGetProperty("id", out var unknownId))
		{
			await this.SendErrorAsync(unknownId, -32601, "Method not found.", cancellationToken);
		}

		return false;
	}

	private Task PublishDiagnosticsAsync(
		LspPublishDiagnosticsParams parameters,
		CancellationToken cancellationToken
	)
	{
		var serialized = JsonSerializer.SerializeToElement(
			parameters,
			LspJsonContext.Default.LspPublishDiagnosticsParams
		);
		var message = new LspEnvelope
		{
			Method = "textDocument/publishDiagnostics",
			Params = serialized,
		};

		return this.transport.WriteAsync(message, cancellationToken);
	}

	private Task SendErrorAsync(
		JsonElement id,
		int code,
		string message,
		CancellationToken cancellationToken
	)
	{
		var error = new LspError { Code = code, Message = message };
		var response = new LspEnvelope { Id = id.Clone(), Error = error };

		return this.transport.WriteAsync(response, cancellationToken);
	}

	private static string? ReadString(JsonElement source, string name)
	{
		var found = source.TryGetProperty(name, out var value);
		if (!found || value.ValueKind != JsonValueKind.String)
		{
			return null;
		}

		return value.GetString();
	}

	private static JsonElement ReadObject(JsonElement source, string name)
	{
		var found = source.TryGetProperty(name, out var value);
		if (!found || value.ValueKind != JsonValueKind.Object)
		{
			return default;
		}

		return value;
	}

	private static bool ReadBoolean(JsonElement source, string name)
	{
		if (source.ValueKind != JsonValueKind.Object)
		{
			return false;
		}

		var found = source.TryGetProperty(name, out var value);
		if (!found)
		{
			return false;
		}

		return value.ValueKind == JsonValueKind.True;
	}

	public async ValueTask DisposeAsync()
	{
		await this.documents.DisposeAsync();
		await this.transport.DisposeAsync();
		GC.SuppressFinalize(this);
	}
}
