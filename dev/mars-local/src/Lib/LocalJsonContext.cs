using System.Text.Json.Serialization;
using Mars.Local.App.LocalNode;

namespace Mars.Local.Lib;

[JsonSourceGenerationOptions(
	GenerationMode = JsonSourceGenerationMode.Metadata,
	PropertyNamingPolicy = JsonKnownNamingPolicy.SnakeCaseLower
)]
[JsonSerializable(typeof(Dictionary<string, string>))]
[JsonSerializable(typeof(string))]
[JsonSerializable(typeof(NodePropertyEventContext))]
public partial class LocalJsonContext : JsonSerializerContext
{
}
