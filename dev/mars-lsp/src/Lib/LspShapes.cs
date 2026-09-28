using System.Text.Json;
using System.Text.Json.Serialization;

namespace Mars.Lsp.Lib;

public class LspEnvelope
{
	public string Jsonrpc { get; init; } = "2.0";
	public JsonElement? Id { get; init; }
	public string? Method { get; init; }
	public JsonElement? Params { get; init; }
	public JsonElement? Result { get; init; }
	public LspError? Error { get; init; }
}

public class LspError
{
	public int Code { get; init; }
	public string Message { get; init; } = "";
}

public class LspInitializeResult
{
	public LspServerCapabilities Capabilities { get; init; } = new();
	public LspServerInfo ServerInfo { get; init; } = new();
}

public class LspServerCapabilities
{
	public int TextDocumentSync { get; init; } = 1;
	public string PositionEncoding { get; init; } = "utf-16";
}

public class LspServerInfo
{
	public string Name { get; init; } = "mars-lsp";
}

public class LspPublishDiagnosticsParams
{
	public string Uri { get; init; } = "";
	public int? Version { get; init; }
	public IReadOnlyList<LspDiagnostic> Diagnostics { get; init; } = [];
}

public class LspDiagnostic
{
	public LspRange Range { get; init; } = new();
	public int Severity { get; init; } = 1;
	public string Code { get; init; } = "";
	public string Source { get; init; } = "mars-workflow";
	public string Message { get; init; } = "";
}

public class LspRange
{
	public LspPosition Start { get; init; } = new();
	public LspPosition End { get; init; } = new();
}

public class LspPosition
{
	public int Line { get; init; }
	public int Character { get; init; }
}

[JsonSourceGenerationOptions(
	PropertyNamingPolicy = JsonKnownNamingPolicy.CamelCase,
	DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
)]
[JsonSerializable(typeof(LspEnvelope))]
[JsonSerializable(typeof(LspInitializeResult))]
[JsonSerializable(typeof(LspPublishDiagnosticsParams))]
public partial class LspJsonContext : JsonSerializerContext
{
}
