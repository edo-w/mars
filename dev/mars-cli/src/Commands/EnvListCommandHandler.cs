using Mars.Cli.Lib;
using Mars.Core.App.Environment;

namespace Mars.Cli.Commands;

public class EnvListCommandHandler
{
	private readonly IEnvironmentService environments;

	public EnvListCommandHandler(IEnvironmentService environments)
	{
		this.environments = environments;
	}

	public async Task<int> HandleAsync(CommandContext<EnvListCommandInput> context)
	{
		var selected = await this.environments.GetSelectedAsync();
		var environments = await this.environments.ListAsync();
		var table = new CliTable();

		foreach (var environment in environments)
		{
			var marker = selected?.Id == environment.Id ? "*" : " ";
			var id = environment.Id.ToString();
			table.AddRow(marker, environment.FullName, id);
		}

		await table.WriteAsync(context.Output);

		return 0;
	}
}
