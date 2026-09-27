using System.CommandLine;
using System.CommandLine.Parsing;
using Microsoft.Extensions.DependencyInjection;

namespace Mars.Cli.Commands;

public class NodeListCommand : Command
{
	private readonly IServiceProvider container;
	private readonly Option<string> environmentOption;
	private readonly Option<string> tagOption;

	public NodeListCommand(IServiceProvider container, Option<string> environmentOption)
		: base("list", "List nodes")
	{
		this.container = container;
		this.environmentOption = environmentOption;
		this.tagOption = new Option<string>("--tag");

		this.Options.Add(this.tagOption);
		this.Aliases.Add("ls");

		this.SetAction(this.HandleAsync);
	}

	private async Task<int> HandleAsync(
		ParseResult parseResult,
		CancellationToken cancellationToken
	)
	{
		var tag = parseResult.GetValue(this.tagOption);
		var environment = parseResult.GetValue(this.environmentOption);

		var input = new NodeListCommandInput(tag, environment);

		var output = parseResult.InvocationConfiguration.Output;
		var error = parseResult.InvocationConfiguration.Error;
		var context = new CommandContext<NodeListCommandInput>(
			input,
			output,
			error,
			cancellationToken
		);

		var handler = this.container.GetRequiredService<NodeListCommandHandler>();

		return await handler.HandleAsync(context);
	}
}

public record NodeListCommandInput(string? Tag, string? Environment);
