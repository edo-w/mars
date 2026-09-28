using Mars.Lsp.Boot;

namespace Mars.Lsp;

public class Program
{
	public static async Task<int> Main()
	{
		var input = Console.OpenStandardInput();
		var output = Console.OpenStandardOutput();
		await using var server = new LspServer(input, output, Console.Error);
		var exitCode = await server.RunAsync(CancellationToken.None);

		return exitCode;
	}
}
