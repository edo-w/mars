using System.CommandLine;
using System.CommandLine.Parsing;
using Mars.Core.App.Config;
using Microsoft.Extensions.DependencyInjection;

namespace Mars.Cli.Commands;

public class InitCommand : Command
{
	private readonly IServiceProvider container;
	private readonly Argument<string?> nameArgument;
	private readonly Option<string> namespaceOption;

	public InitCommand(IServiceProvider container)
		: base("init", "Initialize a Mars app in this directory")
	{
		this.container = container;
		this.nameArgument = new Argument<string?>("name")
		{
			Description = "Application display name (defaults to app).",
			Arity = ArgumentArity.ZeroOrOne,
		};
		this.namespaceOption = new Option<string>("--namespace")
		{
			Description = "Default environment namespace.",
		};

		this.Arguments.Add(this.nameArgument);
		this.Options.Add(this.namespaceOption);

		this.SetAction(this.HandleAsync);
	}

	private async Task<int> HandleAsync(
		ParseResult parseResult,
		CancellationToken cancellationToken
	)
	{
		var name = parseResult.GetValue(this.nameArgument) ?? "app";
		var parsedNamespace = parseResult.GetValue(this.namespaceOption);
		var defaultNamespace = parsedNamespace;
		if (defaultNamespace is null)
		{
			defaultNamespace = Config.FromAppName(name);
		}

		var input = new InitCommandInput(name, defaultNamespace);

		var output = parseResult.InvocationConfiguration.Output;
		var error = parseResult.InvocationConfiguration.Error;
		var context = new CommandContext<InitCommandInput>(
			input,
			output,
			error,
			cancellationToken
		);

		var handler = this.container.GetRequiredService<InitCommandHandler>();

		return await handler.HandleAsync(context);
	}
}

public record InitCommandInput(string Name, string DefaultNamespace);
