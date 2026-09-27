using Mars.Core.App.Environment;

namespace Mars.Cli.Commands;

public class EnvCreateCommandHandler
{
	private readonly IEnvironmentService environments;

	public EnvCreateCommandHandler(IEnvironmentService environments)
	{
		this.environments = environments;
	}

	public async Task<int> HandleAsync(CommandContext<EnvCreateCommandInput> context)
	{
		var environment = await this.environments.CreateAsync(context.Input.Name, context.Input.Namespace);

		await context.Output.WriteLineAsync($"{environment.FullName} {environment.Id}");

		return 0;
	}
}
