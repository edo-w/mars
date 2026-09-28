using System.ComponentModel;
using System.Diagnostics;
using System.Text;
using Mars.Workflow.App.Runtime;

namespace Mars.Workflow.App.Workflow;

public class WorkflowShellRunner
{
	private readonly IWorkflowLogStore logs;

	public WorkflowShellRunner(IWorkflowLogStore logs)
	{
		this.logs = logs;
	}

	public async Task<int> RunAsync(
		string command,
		WorkflowOperationContext context,
		CancellationToken cancellationToken
	)
	{
		var errorTail = new StringBuilder();
		var stdoutFileName = $"{context.StepId}.stdout.log";
		var stderrFileName = $"{context.StepId}.stderr.log";
		await using var stdoutStream = await this.logs.OpenWriteAsync(
			context.RunId,
			stdoutFileName,
			false,
			cancellationToken
		);
		await using var stderrStream = await this.logs.OpenWriteAsync(
			context.RunId,
			stderrFileName,
			false,
			cancellationToken
		);

		using var process = StartShell(command, context);
		var stdoutTask = CopyLinesAsync(
			process.StandardOutput,
			stdoutStream,
			context,
			null,
			cancellationToken
		);
		var stderrTask = CopyLinesAsync(
			process.StandardError,
			stderrStream,
			context,
			errorTail,
			cancellationToken
		);
		await WaitForExitAsync(process, cancellationToken);
		await Task.WhenAll(stdoutTask, stderrTask);

		if (process.ExitCode != 0)
		{
			var message = $"Command exited with code {process.ExitCode}.";
			if (errorTail.Length > 0)
			{
				message = $"{message} {errorTail}";
			}

			throw new WorkflowRuntimeException(message);
		}

		return process.ExitCode;
	}

	private static Process StartShell(string command, WorkflowOperationContext context)
	{
		if (OperatingSystem.IsWindows())
		{
			try
			{
				return StartProcess("pwsh", ["-NoProfile", "-NonInteractive", "-Command", command], context);
			}
			catch (Win32Exception)
			{
				return StartProcess(
					"powershell.exe",
					["-NoProfile", "-NonInteractive", "-Command", command],
					context
				);
			}
		}

		return StartProcess("bash", ["--noprofile", "--norc", "-c", command], context);
	}

	private static Process StartProcess(
		string executable,
		IReadOnlyList<string> arguments,
		WorkflowOperationContext context
	)
	{
		var start = new ProcessStartInfo
		{
			FileName = executable,
			WorkingDirectory = context.WorkingDirectory,
			UseShellExecute = false,
			RedirectStandardInput = true,
			RedirectStandardOutput = true,
			RedirectStandardError = true,
			CreateNoWindow = true,
		};
		foreach (var argument in arguments)
		{
			start.ArgumentList.Add(argument);
		}

		CopyMinimalEnvironment(start);
		foreach (var item in context.Environment)
		{
			start.Environment[item.Key] = item.Value;
		}

		var process = new Process { StartInfo = start };
		try
		{
			process.Start();
			process.StandardInput.Close();

			return process;
		}
		catch
		{
			process.Dispose();
			throw;
		}
	}

	private static async Task CopyLinesAsync(
		StreamReader reader,
		Stream stream,
		WorkflowOperationContext context,
		StringBuilder? errorTail,
		CancellationToken cancellationToken
	)
	{
		var encoding = new UTF8Encoding(false);
		await using var writer = new StreamWriter(
			stream,
			encoding,
			1024,
			leaveOpen: true
		);
		while (true)
		{
			var line = await reader.ReadLineAsync(cancellationToken);
			if (line is null)
			{
				break;
			}

			await writer.WriteLineAsync(line);
			if (errorTail is not null)
			{
				if (errorTail.Length > 4096)
				{
					errorTail.Remove(0, errorTail.Length - 4096);
				}
				errorTail.Append(line).Append(' ');
			}
			else
			{
				await context.Progress(line, null, cancellationToken);
			}
		}
	}

	private static async Task WaitForExitAsync(Process process, CancellationToken cancellationToken)
	{
		try
		{
			await process.WaitForExitAsync(cancellationToken);
		}
		catch (OperationCanceledException)
		{
			process.StandardInput.Close();
			var grace = Task.Delay(TimeSpan.FromSeconds(5), CancellationToken.None);
			var exited = process.WaitForExitAsync(CancellationToken.None);
			var finished = await Task.WhenAny(exited, grace);
			if (finished != exited && !process.HasExited)
			{
				process.Kill(entireProcessTree: true);
				await process.WaitForExitAsync(CancellationToken.None);
			}

			throw;
		}
	}

	public static void CopyMinimalEnvironment(ProcessStartInfo start)
	{
		var names = OperatingSystem.IsWindows()
			? new[] { "PATH", "SystemRoot", "WINDIR", "ComSpec", "PATHEXT", "TEMP", "TMP" }
			: ["PATH", "HOME", "TMPDIR"];
		start.Environment.Clear();
		foreach (var name in names)
		{
			var value = Environment.GetEnvironmentVariable(name);
			if (value is not null)
			{
				start.Environment[name] = value;
			}
		}
	}
}
