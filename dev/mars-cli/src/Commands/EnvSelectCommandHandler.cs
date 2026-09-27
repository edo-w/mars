using Mars.Core.App.Environment;

namespace Mars.Cli.Commands;

public class EnvSelectCommandHandler
{
	private readonly IEnvironmentService environments;

	public EnvSelectCommandHandler(IEnvironmentService environments)
	{
		this.environments = environments;
	}

	public async Task<int> HandleAsync(CommandContext<EnvSelectCommandInput> context)
	{
		var environment = await this.environments.SelectAsync(context.Input.Name);

		await context.Output.WriteLineAsync(environment.FullName);

		return 0;
	}
}
