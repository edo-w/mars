using Mars.Cli.Lib;
using Mars.Core.App.Environment;

namespace Mars.Cli.Commands;

public class EnvShowCommandHandler
{
	private readonly IEnvironmentService environments;

	public EnvShowCommandHandler(IEnvironmentService environments)
	{
		this.environments = environments;
	}

	public async Task<int> HandleAsync(CommandContext<EnvShowCommandInput> context)
	{
		var environment = await this.environments.ResolveAsync(context.Input.FullName);
		var table = new CliTable();
		table.AddRow("env_id:", environment.Id.ToString());
		table.AddRow("name:", environment.FullName);

		var properties = environment.Properties.OrderBy(item => item.Key, StringComparer.Ordinal);
		foreach (var property in properties)
		{
			var label = $"{property.Key}:";
			table.AddRow(label, property.Value);
		}

		await table.WriteAsync(context.Output);

		return 0;
	}
}
