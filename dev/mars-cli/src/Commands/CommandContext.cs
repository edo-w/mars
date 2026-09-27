namespace Mars.Cli.Commands;

public class CommandContext<TInput>
{
	public CommandContext(
		TInput input,
		TextWriter output,
		TextWriter error,
		CancellationToken cancellationToken
	)
	{
		this.Input = input;
		this.Output = output;
		this.Error = error;
		this.CancellationToken = cancellationToken;
	}

	public TInput Input { get; }
	public TextWriter Output { get; }
	public TextWriter Error { get; }
	public CancellationToken CancellationToken { get; }
}
