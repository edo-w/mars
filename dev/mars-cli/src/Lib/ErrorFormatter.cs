using System.Collections;
using System.Globalization;
using Mars.Core.Lib;

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

		var name = current is AppException appError
			? appError.FriendlyName
			: current.GetType().Name;
		var code = current is IErrorCode codedError
			? $" ({codedError.Code})"
			: "";

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
