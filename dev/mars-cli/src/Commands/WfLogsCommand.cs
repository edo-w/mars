using System.CommandLine;
using System.CommandLine.Parsing;
using Microsoft.Extensions.DependencyInjection;

namespace Mars.Cli.Commands;

public class WfLogsCommand : Command
{
	private readonly IServiceProvider container;
	private readonly Argument<Guid?> runIdArgument;

	public WfLogsCommand(IServiceProvider container)
		: base("logs", "Show logs for a workflow run")
	{
		this.container = container;
		this.runIdArgument = new Argument<Guid?>("run-id")
		{
			Arity = ArgumentArity.ZeroOrOne,
		};

		this.Arguments.Add(this.runIdArgument);
		this.SetAction(this.HandleAsync);
	}

	private async Task<int> HandleAsync(ParseResult parse, CancellationToken cancellationToken)
	{
		var runId = parse.GetValue(this.runIdArgument);
		var input = new WfLogsCommandInput(runId);
		var context = new CommandContext<WfLogsCommandInput>(
			input,
			parse.InvocationConfiguration.Output,
			parse.InvocationConfiguration.Error,
			cancellationToken
		);
		var handler = this.container.GetRequiredService<WfLogsCommandHandler>();

		return await handler.HandleAsync(context);
	}
}

public record WfLogsCommandInput(Guid? RunId);
