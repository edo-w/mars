using System.CommandLine;
using System.CommandLine.Parsing;
using Microsoft.Extensions.DependencyInjection;

namespace Mars.Cli.Commands;

public class SshCaListCommand : Command
{
	private readonly IServiceProvider container;
	private readonly Option<string> environmentOption;

	public SshCaListCommand(IServiceProvider container, Option<string> environmentOption)
		: base("list", "List SSH CAs")
	{
		this.container = container;
		this.environmentOption = environmentOption;
		this.Aliases.Add("ls");

		this.SetAction(this.HandleAsync);
	}

	private async Task<int> HandleAsync(
		ParseResult parseResult,
		CancellationToken cancellationToken
	)
	{
		var environment = parseResult.GetValue(this.environmentOption);

		var input = new SshCaListCommandInput(environment);

		var output = parseResult.InvocationConfiguration.Output;
		var error = parseResult.InvocationConfiguration.Error;
		var context = new CommandContext<SshCaListCommandInput>(
			input,
			output,
			error,
			cancellationToken
		);

		var handler = this.container.GetRequiredService<SshCaListCommandHandler>();

		return await handler.HandleAsync(context);
	}
}

public record SshCaListCommandInput(string? Environment);
