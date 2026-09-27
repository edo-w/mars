using Mars.Core.App.Environment;

namespace Mars.Cli.Commands;

public class EnvPropertyRemoveCommandHandler
{
	private readonly IEnvironmentService environments;

	public EnvPropertyRemoveCommandHandler(IEnvironmentService environments)
	{
		this.environments = environments;
	}

	public async Task<int> HandleAsync(CommandContext<EnvPropertyRemoveCommandInput> context)
	{
		await this.environments.RemovePropertyAsync(context.Input.FullName, context.Input.Key);

		return 0;
	}
}
