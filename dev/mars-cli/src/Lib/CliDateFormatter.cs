using System.Globalization;

namespace Mars.Cli.Lib;

public static class CliDateFormatter
{
	public static string ForList(DateTimeOffset date)
	{
		var utcDate = date.ToUniversalTime();
		var formatted = utcDate.ToString("yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture);

		return formatted;
	}

	public static string ForShow(DateTimeOffset date)
	{
		var utcDate = date.ToUniversalTime();
		var formatted = utcDate.ToString("yyyy-MM-dd HH:mm:ss.fff", CultureInfo.InvariantCulture);

		return formatted;
	}
}
