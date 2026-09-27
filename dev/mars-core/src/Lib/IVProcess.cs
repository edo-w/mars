namespace Mars.Core.Lib;

public interface IVProcess
{
	string CurrentDirectory { get; }
	string UserHomeDirectory { get; }
	string? ExecutablePath { get; }
	IReadOnlyList<string> CommandLineArguments { get; }
	string? GetEnvironmentVariable(string name);
	Stream OpenStandardInput();
	Task<ProcessResult> RunAsync(ProcessCommand command, CancellationToken cancellationToken = default);
}

public class ProcessCommand
{
	public ProcessCommand(
		string executable,
		IReadOnlyList<string> arguments,
		string workingDirectory,
		IReadOnlyDictionary<string, string>? environment = null
	)
	{
		this.Executable = executable;
		this.Arguments = arguments;
		this.WorkingDirectory = workingDirectory;
		this.Environment = environment;
	}

	public string Executable { get; }
	public IReadOnlyList<string> Arguments { get; }
	public string WorkingDirectory { get; }
	public IReadOnlyDictionary<string, string>? Environment { get; }
}

public class ProcessResult
{
	public ProcessResult(int exitCode, string standardOutput, string standardError)
	{
		this.ExitCode = exitCode;
		this.StandardOutput = standardOutput;
		this.StandardError = standardError;
	}

	public int ExitCode { get; }
	public string StandardOutput { get; }
	public string StandardError { get; }
}
