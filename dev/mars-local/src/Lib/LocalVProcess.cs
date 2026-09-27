using System.Diagnostics;
using Mars.Core.Lib;
using Environment = System.Environment;

namespace Mars.Local.Lib;

public class LocalVProcess : IVProcess
{
	public string CurrentDirectory => Directory.GetCurrentDirectory();
	public string UserHomeDirectory => Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
	public string? ExecutablePath => Environment.ProcessPath;
	public IReadOnlyList<string> CommandLineArguments => Environment.GetCommandLineArgs();

	public string? GetEnvironmentVariable(string name)
	{
		return Environment.GetEnvironmentVariable(name);
	}

	public Stream OpenStandardInput()
	{
		return Console.OpenStandardInput();
	}

	public async Task<ProcessResult> RunAsync(
		ProcessCommand command,
		CancellationToken cancellationToken = default
	)
	{
		var info = new ProcessStartInfo(command.Executable)
		{
			WorkingDirectory = command.WorkingDirectory,
			RedirectStandardOutput = true,
			RedirectStandardError = true,
			UseShellExecute = false,
			CreateNoWindow = true,
		};

		foreach (var argument in command.Arguments)
		{
			info.ArgumentList.Add(argument);
		}

		if (command.Environment is not null)
		{
			foreach (var item in command.Environment)
			{
				info.Environment[item.Key] = item.Value;
			}
		}

		using var process = Process.Start(info);
		if (process is null)
		{
			throw new AppException($"Could not start '{command.Executable}'.");
		}

		var errorTask = process.StandardError.ReadToEndAsync(cancellationToken);
		var outputTask = process.StandardOutput.ReadToEndAsync(cancellationToken);

		try
		{
			await process.WaitForExitAsync(cancellationToken);
		}
		catch (OperationCanceledException)
		{
			if (!process.HasExited)
			{
				process.Kill(entireProcessTree: true);
				await process.WaitForExitAsync(CancellationToken.None);
			}

			throw;
		}

		var error = await errorTask;
		var output = await outputTask;
		var result = new ProcessResult(process.ExitCode, output, error);

		return result;
	}
}
