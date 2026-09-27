namespace Mars.Core.Lib;

public interface IVTimer
{
	DateTimeOffset UtcNow { get; }
	Task DelayAsync(TimeSpan duration, CancellationToken cancellationToken = default);
}
