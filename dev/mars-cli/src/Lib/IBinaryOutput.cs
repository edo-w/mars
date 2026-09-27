namespace Mars.Cli.Lib;

public interface IBinaryOutput
{
	Task WriteAsync(ReadOnlyMemory<byte> bytes, CancellationToken cancellationToken);
}
