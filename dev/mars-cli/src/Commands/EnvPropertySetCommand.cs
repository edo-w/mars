using System.CommandLine;
using System.CommandLine.Parsing;
using Microsoft.Extensions.DependencyInjection;

namespace Mars.Cli.Commands;

public class EnvPropertySetCommand : Command
{
	private readonly IServiceProvider container;
	private readonly Argument<string> fullNameArgument;
	private readonly Argument<string> keyArgument;
	private readonly Argument<string> valueArgument;

	public EnvPropertySetCommand(IServiceProvider container)
		: base("set", "Set an environment property")
	{
		this.container = container;
		this.fullNameArgument = new Argument<string>("namespace/name");
		this.keyArgument = new Argument<string>("key");
		this.valueArgument = new Argument<string>("value");

		this.Arguments.Add(this.fullNameArgument);
		this.Arguments.Add(this.keyArgument);
		this.Arguments.Add(this.valueArgument);

		this.SetAction(this.HandleAsync);
	}

	private async Task<int> HandleAsync(
		ParseResult parseResult,
		CancellationToken cancellationToken
	)
	{
		var fullName = parseResult.GetValue(this.fullNameArgument)!;
		var key = parseResult.GetValue(this.keyArgument)!;
		var value = parseResult.GetValue(this.valueArgument)!;

		var input = new EnvPropertySetCommandInput(fullName, key, value);

		var output = parseResult.InvocationConfiguration.Output;
		var error = parseResult.InvocationConfiguration.Error;
		var context = new CommandContext<EnvPropertySetCommandInput>(
			input,
			output,
			error,
			cancellationToken
		);

		var handler = this.container.GetRequiredService<EnvPropertySetCommandHandler>();

		return await handler.HandleAsync(context);
	}
}

public record EnvPropertySetCommandInput(string FullName, string Key, string Value);
