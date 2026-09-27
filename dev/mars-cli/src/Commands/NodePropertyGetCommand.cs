using System.CommandLine;
using System.CommandLine.Parsing;
using Microsoft.Extensions.DependencyInjection;

namespace Mars.Cli.Commands;

public class NodePropertyGetCommand : Command
{
	private readonly IServiceProvider container;
	private readonly Option<string> environmentOption;
	private readonly Argument<string> nameOrIdArgument;
	private readonly Argument<string> keyArgument;

	public NodePropertyGetCommand(IServiceProvider container, Option<string> environmentOption)
		: base("get", "Get a node property")
	{
		this.container = container;
		this.environmentOption = environmentOption;
		this.nameOrIdArgument = new Argument<string>("name-or-id");
		this.keyArgument = new Argument<string>("key");

		this.Arguments.Add(this.nameOrIdArgument);
		this.Arguments.Add(this.keyArgument);
		this.SetAction(this.HandleAsync);
	}

	private async Task<int> HandleAsync(
		ParseResult parseResult,
		CancellationToken cancellationToken
	)
	{
		var nameOrId = parseResult.GetValue(this.nameOrIdArgument)!;
		var key = parseResult.GetValue(this.keyArgument)!;
		var environment = parseResult.GetValue(this.environmentOption);
		var input = new NodePropertyGetCommandInput(nameOrId, key, environment);

		var output = parseResult.InvocationConfiguration.Output;
		var error = parseResult.InvocationConfiguration.Error;
		var context = new CommandContext<NodePropertyGetCommandInput>(
			input,
			output,
			error,
			cancellationToken
		);

		var handler = this.container.GetRequiredService<NodePropertyGetCommandHandler>();

		return await handler.HandleAsync(context);
	}
}

public record NodePropertyGetCommandInput(string NameOrId, string Key, string? Environment);
