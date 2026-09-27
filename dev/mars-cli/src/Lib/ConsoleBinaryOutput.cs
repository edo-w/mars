namespace Mars.Cli.Lib;

public class ConsoleBinaryOutput : IBinaryOutput
{
	public async Task WriteAsync(ReadOnlyMemory<byte> bytes, CancellationToken cancellationToken)
	{
		using var output = Console.OpenStandardOutput();
		await output.WriteAsync(bytes, cancellationToken);
		await output.FlushAsync(cancellationToken);
	}
}
