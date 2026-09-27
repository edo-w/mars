using Mars.Core.App.Config;
using Mars.Core.Lib;

namespace Mars.Cli.Commands;

public class InitCommandHandler
{
	private readonly ConfigService configService;
	private readonly IVProcess process;

	public InitCommandHandler(ConfigService configService, IVProcess process)
	{
		this.configService = configService;
		this.process = process;
	}

	public async Task<int> HandleAsync(CommandContext<InitCommandInput> context)
	{
		var directory = this.process.CurrentDirectory;
		var config = await this.configService.InitAsync(
			directory,
			context.Input.Name,
			context.Input.DefaultNamespace
		);

		await context.Output.WriteLineAsync($"Mars app {config.Id} ready");

		return 0;
	}
}
