using Mars.Lsp.Lib;
using Mars.Workflow.App.Language;

namespace Mars.Lsp.App.Diagnostics;

public static class DiagnosticMapper
{
	public static LspDiagnostic Map(WorkflowDiagnostic diagnostic, string source)
	{
		var span = diagnostic.Span;
		var start = PositionAt(source, span.Offset);
		var end = PositionAt(source, span.Offset + span.Length);
		var range = new LspRange { Start = start, End = end };
		var result = new LspDiagnostic
		{
			Range = range,
			Code = diagnostic.Code,
			Message = diagnostic.Message,
		};

		return result;
	}

	private static LspPosition PositionAt(string source, int offset)
	{
		var limit = Math.Clamp(offset, 0, source.Length);
		var line = 0;
		var character = 0;
		for (var index = 0; index < limit; index++)
		{
			if (source[index] == '\n')
			{
				line++;
				character = 0;
			}
			else
			{
				character++;
			}
		}

		return new LspPosition { Line = line, Character = character };
	}
}
