using System.CommandLine;
using System.CommandLine.Parsing;
using Microsoft.Extensions.DependencyInjection;

namespace Mars.Cli.Commands;

public class LockRenewCommand : Command
{
	private readonly IServiceProvider container;
	private readonly Option<string> environmentOption;
	private readonly Argument<string> nameArgument;
	private readonly Argument<string> ownerArgument;
	private readonly Argument<Guid> tokenArgument;
	private readonly Option<int> secondsOption;

	public LockRenewCommand(IServiceProvider container, Option<string> environmentOption)
		: base("renew", "Renew a lease by token")
	{
		this.container = container;
		this.environmentOption = environmentOption;
		this.nameArgument = new Argument<string>("name");
		this.ownerArgument = new Argument<string>("owner");
		this.tokenArgument = new Argument<Guid>("token");
		this.secondsOption = new Option<int>("--seconds");

		this.Arguments.Add(this.nameArgument);
		this.Arguments.Add(this.ownerArgument);
		this.Arguments.Add(this.tokenArgument);
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
		var leaseToken = parseResult.GetValue(this.tokenArgument);
		var seconds = parseResult.GetValue(this.secondsOption);
		var environment = parseResult.GetValue(this.environmentOption);

		var input = new LockRenewCommandInput(name, owner, leaseToken, seconds, environment);

		var output = parseResult.InvocationConfiguration.Output;
		var error = parseResult.InvocationConfiguration.Error;
		var context = new CommandContext<LockRenewCommandInput>(
			input,
			output,
			error,
			cancellationToken
		);

		var handler = this.container.GetRequiredService<LockRenewCommandHandler>();

		return await handler.HandleAsync(context);
	}
}

public record LockRenewCommandInput(string Name, string Owner, Guid Token, int Seconds, string? Environment);
