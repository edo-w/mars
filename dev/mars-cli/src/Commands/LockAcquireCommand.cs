using System.CommandLine;
using System.CommandLine.Parsing;
using Microsoft.Extensions.DependencyInjection;

namespace Mars.Cli.Commands;

public class LockAcquireCommand : Command
{
	private readonly IServiceProvider container;
	private readonly Option<string> environmentOption;
	private readonly Argument<string> nameArgument;
	private readonly Argument<string> ownerArgument;
	private readonly Option<int> secondsOption;

	public LockAcquireCommand(IServiceProvider container, Option<string> environmentOption)
		: base("acquire", "Acquire a lease")
	{
		this.container = container;
		this.environmentOption = environmentOption;
		this.nameArgument = new Argument<string>("name");
		this.ownerArgument = new Argument<string>("owner");
		this.secondsOption = new Option<int>("--seconds");

		this.Arguments.Add(this.nameArgument);
		this.Arguments.Add(this.ownerArgument);
		this.Options.Add(this.secondsOption);

		this.SetAction(this.HandleAsync);
	}

	private async Task<int> HandleAsync(
		ParseResult parseResult,
		CancellationToken cancellationToken
	)
	{
		var name = parseResult.GetValue(this.nameArgument)!;
		var owner = parseResult.GetValue(this.ownerArgument)!;
		var seconds = parseResult.GetValue(this.secondsOption);
		var environment = parseResult.GetValue(this.environmentOption);

		var input = new LockAcquireCommandInput(name, owner, seconds, environment);

		var output = parseResult.InvocationConfiguration.Output;
		var error = parseResult.InvocationConfiguration.Error;
		var context = new CommandContext<LockAcquireCommandInput>(
			input,
			output,
			error,
			cancellationToken
		);

		var handler = this.container.GetRequiredService<LockAcquireCommandHandler>();

		return await handler.HandleAsync(context);
	}
}

public record LockAcquireCommandInput(string Name, string Owner, int Seconds, string? Environment);
