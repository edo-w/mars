using Mars.Core.App.Environment;

namespace Mars.Cli.Commands;

public class EnvPropertySetCommandHandler
{
	private readonly IEnvironmentService environments;

	public EnvPropertySetCommandHandler(IEnvironmentService environments)
	{
		this.environments = environments;
	}

	public async Task<int> HandleAsync(CommandContext<EnvPropertySetCommandInput> context)
	{
		await this.environments.SetPropertyAsync(
					context.Input.FullName,
					context.Input.Key,
					context.Input.Value
				);

		return 0;
	}
}
