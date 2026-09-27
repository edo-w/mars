using System.CommandLine;
using System.CommandLine.Parsing;
using Microsoft.Extensions.DependencyInjection;

namespace Mars.Cli.Commands;

public class NodeCreateCommand : Command
{
	private readonly IServiceProvider container;
	private readonly Option<string> environmentOption;
	private readonly Argument<string> nameArgument;
	private readonly Option<string> publicIpOption;

	public NodeCreateCommand(IServiceProvider container, Option<string> environmentOption)
		: base("create", "Create a node")
	{
		this.container = container;
		this.environmentOption = environmentOption;
		this.nameArgument = new Argument<string>("name");
		this.publicIpOption = new Option<string>("--public-ip");

		this.Arguments.Add(this.nameArgument);
		this.Options.Add(this.publicIpOption);

		this.SetAction(this.HandleAsync);
	}

	private async Task<int> HandleAsync(
		ParseResult parseResult,
		CancellationToken cancellationToken
	)
	{
		var name = parseResult.GetValue(this.nameArgument)!;
		var publicIp = parseResult.GetValue(this.publicIpOption);
		var environment = parseResult.GetValue(this.environmentOption);

		var input = new NodeCreateCommandInput(name, publicIp, environment);

		var output = parseResult.InvocationConfiguration.Output;
		var error = parseResult.InvocationConfiguration.Error;
		var context = new CommandContext<NodeCreateCommandInput>(
			input,
			output,
			error,
			cancellationToken
		);

		var handler = this.container.GetRequiredService<NodeCreateCommandHandler>();

		return await handler.HandleAsync(context);
	}
}

public record NodeCreateCommandInput(string Name, string? PublicIp, string? Environment);
