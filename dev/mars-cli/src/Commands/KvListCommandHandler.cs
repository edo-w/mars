using System.Globalization;
using Mars.Cli.Lib;
using Mars.Core.App.Environment;
using Mars.Core.App.Kv;

namespace Mars.Cli.Commands;

public class KvListCommandHandler
{
	private readonly IEnvironmentService environments;
	private readonly IKvService kv;

	public KvListCommandHandler(IEnvironmentService environments, IKvService kv)
	{
		this.environments = environments;
		this.kv = kv;
	}

	public async Task<int> HandleAsync(CommandContext<KvListCommandInput> context)
	{
		var environment = await this.environments.ResolveAsync(context.Input.Environment);

		var prefix = context.Input.Prefix ?? "/";
		var values = await this.kv.ListAsync(environment.Id, prefix);
		var table = new CliTable();
		table.RightAlignColumn(3);
		table.SetMinimumWidth(4, 3);

		foreach (var value in values)
		{
			var visibility = value.IsSecret ? "yes" : "no";
			var version = $"v{value.Version}";
			var size = value.Size.ToString(CultureInfo.InvariantCulture);
			var updateDate = CliDateFormatter.ForList(value.UpdateDate);

			table.AddRow(value.Key, version, value.Type, size, visibility, updateDate);
		}

		await table.WriteAsync(context.Output);

		return 0;
	}
}
