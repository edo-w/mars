using System.Globalization;
using Mars.Cli.Lib;
using Mars.Core.App.Environment;
using Mars.Core.App.Kv;
using Mars.Core.Lib;

namespace Mars.Cli.Commands;

public class KvShowCommandHandler
{
	private readonly IEnvironmentService environments;
	private readonly IKvService kv;

	public KvShowCommandHandler(IEnvironmentService environments, IKvService kv)
	{
		this.environments = environments;
		this.kv = kv;
	}

	public async Task<int> HandleAsync(CommandContext<KvShowCommandInput> context)
	{
		var environment = await this.environments.ResolveAsync(context.Input.Environment);

		var summary = await this.kv.GetSummaryAsync(environment.Id, context.Input.Key);
		if (summary is null)
		{
			throw new NotFoundException($"KV key '{context.Input.Key}' not found.");
		}

		var visibility = summary.IsSecret ? "yes" : "no";
		var createDate = CliDateFormatter.ForShow(summary.CreateDate);
		var updateDate = CliDateFormatter.ForShow(summary.UpdateDate);
		var table = new CliTable();

		table.AddRow("kv_id:", summary.Id.ToString());
		table.AddRow("key:", summary.Key);
		table.AddRow("version:", summary.Version.ToString(CultureInfo.InvariantCulture));
		table.AddRow("type:", summary.Type);
		table.AddRow("size:", summary.Size.ToString(CultureInfo.InvariantCulture));
		table.AddRow("secret:", visibility);
		table.AddRow("create_date:", createDate);
		table.AddRow("update_date:", updateDate);

		await table.WriteAsync(context.Output);

		return 0;
	}
}
