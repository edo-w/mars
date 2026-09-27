using Mars.Core.App.Environment;

namespace Mars.Cli.Commands;

public class EnvDeleteCommandHandler
{
	private readonly IEnvironmentService environments;

	public EnvDeleteCommandHandler(IEnvironmentService environments)
	{
		this.environments = environments;
	}

	public async Task<int> HandleAsync(CommandContext<EnvDeleteCommandInput> context)
	{
		await this.environments.DeleteAsync(context.Input.FullName);

		await context.Output.WriteLineAsync($"Deleted {context.Input.FullName}");

		return 0;
	}
}
