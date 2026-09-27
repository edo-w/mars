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

			var hasArguments = args.Length > 0;
			var isHelp = args.Contains("--help", StringComparer.Ordinal)
				|| args.Contains("-h", StringComparer.Ordinal);
			var isVersion = args.Contains("--version", StringComparer.Ordinal);
			var isInit = hasArguments && args[0] == "init";
			var isPath = hasArguments && args[0] == "path";
			var needsApp = hasArguments && !isInit && !isPath && !isHelp && !isVersion;

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
}
