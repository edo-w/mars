using System.CommandLine;
using System.CommandLine.Parsing;
using Microsoft.Extensions.DependencyInjection;

namespace Mars.Cli.Commands;

public class LockReleaseCommand : Command
{
	private readonly IServiceProvider container;
	private readonly Option<string> environmentOption;
	private readonly Argument<string> nameArgument;
	private readonly Argument<string> ownerArgument;
	private readonly Argument<Guid> tokenArgument;

	public LockReleaseCommand(IServiceProvider container, Option<string> environmentOption)
		: base("release", "Release a lease by token")
	{
		this.container = container;
		this.environmentOption = environmentOption;
		this.nameArgument = new Argument<string>("name");
		this.ownerArgument = new Argument<string>("owner");
		this.tokenArgument = new Argument<Guid>("token");

		this.Arguments.Add(this.nameArgument);
		this.Arguments.Add(this.ownerArgument);
		this.Arguments.Add(this.tokenArgument);

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
		var environment = parseResult.GetValue(this.environmentOption);

		var input = new LockReleaseCommandInput(name, owner, leaseToken, environment);

		var output = parseResult.InvocationConfiguration.Output;
		var error = parseResult.InvocationConfiguration.Error;
		var context = new CommandContext<LockReleaseCommandInput>(
			input,
			output,
			error,
			cancellationToken
		);

		var handler = this.container.GetRequiredService<LockReleaseCommandHandler>();

		return await handler.HandleAsync(context);
	}
}

public record LockReleaseCommandInput(string Name, string Owner, Guid Token, string? Environment);
