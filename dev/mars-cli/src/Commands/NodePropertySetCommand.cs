using System.CommandLine;
using System.CommandLine.Parsing;
using Microsoft.Extensions.DependencyInjection;

namespace Mars.Cli.Commands;

public class NodePropertySetCommand : Command
{
	private readonly IServiceProvider container;
	private readonly Option<string> environmentOption;
	private readonly Argument<string> nameOrIdArgument;
	private readonly Argument<string> keyArgument;
	private readonly Argument<string> valueArgument;

	public NodePropertySetCommand(IServiceProvider container, Option<string> environmentOption)
		: base("set", "Set a node property")
	{
		this.container = container;
		this.environmentOption = environmentOption;
		this.nameOrIdArgument = new Argument<string>("name-or-id");
		this.keyArgument = new Argument<string>("key");
		this.valueArgument = new Argument<string>("value");

		this.Arguments.Add(this.nameOrIdArgument);
		this.Arguments.Add(this.keyArgument);
		this.Arguments.Add(this.valueArgument);

		this.SetAction(this.HandleAsync);
	}

	private async Task<int> HandleAsync(
		ParseResult parseResult,
		CancellationToken cancellationToken
	)
	{
		var nameOrId = parseResult.GetValue(this.nameOrIdArgument)!;
		var key = parseResult.GetValue(this.keyArgument)!;
		var value = parseResult.GetValue(this.valueArgument)!;
		var environment = parseResult.GetValue(this.environmentOption);

		var input = new NodePropertySetCommandInput(nameOrId, key, value, environment);

		var output = parseResult.InvocationConfiguration.Output;
		var error = parseResult.InvocationConfiguration.Error;
		var context = new CommandContext<NodePropertySetCommandInput>(
			input,
			output,
			error,
			cancellationToken
		);

		var handler = this.container.GetRequiredService<NodePropertySetCommandHandler>();

		return await handler.HandleAsync(context);
	}
}

public record NodePropertySetCommandInput(string NameOrId, string Key, string Value, string? Environment);
