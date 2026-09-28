using System.Collections.Concurrent;
using System.Globalization;
using System.Text.Json;
using System.Text.Json.Nodes;
using Mars.Workflow.App.Runtime;

namespace Mars.Workflow.App.Workflow;

public class WorkflowDiagnosticWriter
{
	private readonly IWorkflowLogStore logs;

	public WorkflowDiagnosticWriter(IWorkflowLogStore logs)
	{
		this.logs = logs;
	}

	public async Task WriteAsync(
		Guid runId,
		Guid? stepId,
		string modulePath,
		ConcurrentQueue<WorkflowDiagnosticLine> lines,
		CancellationToken cancellationToken
	)
	{
		if (lines.IsEmpty)
		{
			return;
		}

		var fileName = stepId is null
			? "run.module.stderr.jsonl"
			: $"{stepId}.module.stderr.jsonl";
		var stream = await this.logs.OpenWriteAsync(
			runId,
			fileName,
			true,
			cancellationToken
		);
		await using var writer = new StreamWriter(stream);

		while (lines.TryDequeue(out var line))
		{
			var item = new JsonObject
			{
				["create_date"] = line.CreateDate.ToString("O", CultureInfo.InvariantCulture),
				["module"] = modulePath,
				["step_id"] = stepId?.ToString(),
				["message"] = line.Message,
			};
			var structured = TryParseStructured(line.Message);
			if (structured is not null)
			{
				item["data"] = structured;
			}

			await writer.WriteLineAsync(item.ToJsonString().AsMemory(), cancellationToken);
		}
	}

	private static JsonObject? TryParseStructured(string line)
	{
		try
		{
			var parsed = JsonNode.Parse(line) as JsonObject;
			if (parsed is not null)
			{
				return parsed;
			}
		}
		catch (JsonException)
		{
		}

		return TryParseKeyValues(line);
	}

	private static JsonObject? TryParseKeyValues(string line)
	{
		var result = new JsonObject();
		var position = 0;
		while (position < line.Length)
		{
			while (position < line.Length && char.IsWhiteSpace(line[position]))
			{
				position++;
			}

			if (position == line.Length)
			{
				break;
			}

			var keyStart = position;
			while (position < line.Length && IsKeyCharacter(line[position]))
			{
				position++;
			}

			var hasKey = position > keyStart;
			var hasEquals = position < line.Length && line[position] == '=';
			if (!hasKey || !hasEquals)
			{
				return null;
			}

			var key = line[keyStart..position];
			position++;
			var quoted = position < line.Length && line[position] == '"';
			if (quoted)
			{
				position++;
			}

			var valueStart = position;
			while (position < line.Length)
			{
				var endOfValue = quoted
					? line[position] == '"'
					: char.IsWhiteSpace(line[position]);
				if (endOfValue)
				{
					break;
				}

				position++;
			}

			var missingQuote = quoted && position == line.Length;
			if (missingQuote)
			{
				return null;
			}

			var value = line[valueStart..position];
			if (quoted)
			{
				position++;
			}

			if (result.ContainsKey(key))
			{
				return null;
			}

			result[key] = ParseScalar(value);
		}

		return result.Count > 0 ? result : null;
	}

	private static bool IsKeyCharacter(char character)
	{
		return char.IsLetterOrDigit(character) || character == '_';
	}

	private static JsonValue? ParseScalar(string value)
	{
		if (bool.TryParse(value, out var boolean))
		{
			return JsonValue.Create(boolean);
		}

		if (long.TryParse(
			value,
			NumberStyles.Integer,
			CultureInfo.InvariantCulture,
			out var integer
		))
		{
			return JsonValue.Create(integer);
		}

		return JsonValue.Create(value);
	}
}
