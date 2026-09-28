using System.CommandLine;
using Mars.Cli.Boot;
using Mars.Cli.Lib;
using Mars.Local.App.LocalSshCa;
using Mars.Local.Lib;

namespace Mars.Cli;

public class Program
{
	public static async Task<int> Main(string[] args)
	{
		var debug = args.Contains("--debug", StringComparer.Ordinal);

		try
		{
			if (args is ["ssh-askpass"])
			{
				var process = new LocalVProcess();
				var secret = await AskpassBridge.ReadFromEnvironmentAsync(process);
				await Console.Out.WriteLineAsync(secret);

				return 0;
			}

			var commandIndex = FindCommandIndex(args);
			var hasArguments = commandIndex < args.Length;
			var commandName = hasArguments ? args[commandIndex] : null;
			var isHelp = args.Contains("--help", StringComparer.Ordinal)
				|| args.Contains("-h", StringComparer.Ordinal);
			var isVersion = args.Contains("--version", StringComparer.Ordinal);
			var isInit = commandName == "init";
			var isPath = commandName == "path";
			var isWorkflow = commandName == "wf";
			var needsApp = hasArguments && !isInit && !isPath && !isWorkflow
				&& !isHelp && !isVersion;

			using var container = await Container.CreateAsync(needsApp);
			var rootCommand = CliCommands.Create(container);
			var parsedCommand = rootCommand.Parse(args);
			parsedCommand.InvocationConfiguration.EnableDefaultExceptionHandler = false;

			return await parsedCommand.InvokeAsync();
		}
		catch (Exception exception)
		{
			var message = debug ? exception.ToString() : ErrorFormatter.Format(exception);
			await Console.Error.WriteLineAsync(message);

			return 1;
		}
	}

	private static int FindCommandIndex(string[] arguments)
	{
		for (var index = 0; index < arguments.Length; index++)
		{
			var argument = arguments[index];
			if (argument == "--debug")
			{
				continue;
			}

			if (argument == "--env")
			{
				index++;
				continue;
			}

			if (argument.StartsWith("--env=", StringComparison.Ordinal))
			{
				continue;
			}

			return index;
		}

		return arguments.Length;
	}
}
