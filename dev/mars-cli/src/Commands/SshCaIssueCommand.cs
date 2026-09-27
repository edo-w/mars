using System.CommandLine;
using System.CommandLine.Parsing;
using Microsoft.Extensions.DependencyInjection;

namespace Mars.Cli.Commands;

public class SshCaIssueCommand : Command
{
	private readonly IServiceProvider container;
	private readonly Option<string> environmentOption;
	private readonly Option<string> nameOption;
	private readonly Option<string> userOption;
	private readonly Option<string> identityOption;
	private readonly Option<string> outputOption;

	public SshCaIssueCommand(IServiceProvider container, Option<string> environmentOption)
		: base("issue", "Issue a short lived client certificate")
	{
		this.container = container;
		this.environmentOption = environmentOption;
		this.nameOption = new Option<string>("--name")
		{
			Description = "SSH CA name (default: default)",
		};
		this.userOption = new Option<string>("--user")
		{
			Description = "SSH principal to authorize",
			Required = true,
		};
		this.identityOption = new Option<string>("--identity")
		{
			Description = "Certificate identity (default: user)",
		};
		this.outputOption = new Option<string>("--output")
		{
			Description = "Private key base path (default: current directory/name_yyyyMMddHHmmss)",
		};

		this.Options.Add(this.nameOption);
		this.Options.Add(this.userOption);
		this.Options.Add(this.identityOption);
		this.Options.Add(this.outputOption);

		this.SetAction(this.HandleAsync);
	}

	private async Task<int> HandleAsync(
		ParseResult parseResult,
		CancellationToken cancellationToken
	)
	{
		var parsedName = parseResult.GetValue(this.nameOption);
		var name = parsedName ?? "default";
		var user = parseResult.GetValue(this.userOption)!;
		var parsedIdentity = parseResult.GetValue(this.identityOption);
		var identity = parsedIdentity ?? user;
		var outputPath = parseResult.GetValue(this.outputOption);
		var environment = parseResult.GetValue(this.environmentOption);

		var input = new SshCaIssueCommandInput(name, user, identity, outputPath, environment);

		var output = parseResult.InvocationConfiguration.Output;
		var error = parseResult.InvocationConfiguration.Error;
		var context = new CommandContext<SshCaIssueCommandInput>(
			input,
			output,
			error,
			cancellationToken
		);

		var handler = this.container.GetRequiredService<SshCaIssueCommandHandler>();

		return await handler.HandleAsync(context);
	}
}

public record SshCaIssueCommandInput(string Name, string User, string Identity, string? OutputPath, string? Environment);
