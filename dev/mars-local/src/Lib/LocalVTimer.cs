using Mars.Core.Lib;

namespace Mars.Local.Lib;

public class LocalVTimer : IVTimer
{
	public DateTimeOffset UtcNow => DateTimeOffset.UtcNow;

	public Task DelayAsync(TimeSpan duration, CancellationToken cancellationToken = default)
	{
		return Task.Delay(duration, cancellationToken);
	}
}
