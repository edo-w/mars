using System.Collections;
using System.Globalization;
using Mars.Core.Lib;
using Mars.Workflow.App.Interop;

namespace Mars.Cli.Lib;

public static class ErrorFormatter
{
	public static string Format(Exception exception)
	{
		var lines = new List<string>();
		Exception? current = exception;
		var seen = new HashSet<Exception>(ReferenceEqualityComparer.Instance);

		while (current is not null)
		{
			var isNewException = seen.Add(current);
			if (!isNewException)
			{
				break;
			}

			if (lines.Count > 0)
			{
				lines.Add("");
			}

			string name;
			if (current is AppException appError)
			{
				name = appError.FriendlyName;
			}
			else if (current is WorkflowProtocolException)
			{
				name = "workflow protocol error";
			}
			else
			{
				name = current.GetType().Name;
			}

			string code;
			if (current is IErrorCode codedError)
			{
				code = $" ({codedError.Code})";
			}
			else if (current is WorkflowProtocolException protocolError)
			{
				code = $" ({protocolError.Code})";
			}
			else
			{
				code = "";
			}

			lines.Add($"{name}{code}: {current.Message}");

			foreach (DictionaryEntry entry in current.Data)
			{
				if (entry.Key is not string key)
				{
					continue;
				}

				var value = FormatValue(entry.Value);
				if (value is not null)
				{
					lines.Add($"{key}: {value}");
				}
			}

			current = current.InnerException;
		}

		return string.Join(Environment.NewLine, lines);
	}

	private static string? FormatValue(object? value)
	{
		if (value is string text)
		{
			return text;
		}

		if (value is bool boolean)
		{
			return boolean ? "true" : "false";
		}

		var isNumber = value is byte or sbyte or short or ushort or int or uint or long or ulong
			or float or double or decimal;
		if (isNumber)
		{
			return Convert.ToString(value, CultureInfo.InvariantCulture);
		}

		return null;
	}
}
