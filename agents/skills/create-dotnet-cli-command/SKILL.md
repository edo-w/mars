---
name: create-dotnet-cli-command
description: Create or modify System.CommandLine commands in a dependency-injected .NET CLI using a thin Command object, an immutable command input, CommandContext<TInput>, a DI-resolved handler, explicit exit codes, stream-based output, cancellation propagation, registration, and focused tests. Use when adding a CLI command, subcommand, option, argument, validator, command handler, or command test to a C# project that follows or should adopt this pattern. Apply the repository's general C# skill alongside this command-specific architecture when available.
---

# Create a .NET CLI command

Follow the host project's naming, namespaces, formatting, test framework, and `System.CommandLine` version. Inspect one existing command and its registration before editing. If no example exists, use the pattern below.

## Preserve the boundary

Split every command into these roles:

- `XCommand : Command` defines the command name, description, aliases, options, arguments, and parse-time validators.
- `XCommandInput` is the immutable, CLI-independent value passed to application code.
- `CommandContext<XCommandInput>` carries the input, standard output, standard error, and cancellation token.
- `XCommandHandler` receives application dependencies through constructor injection and implements the use case.
- The composition root registers the handler and attaches the command to its parent.

Keep parsing and `System.CommandLine` types out of the handler. Keep business logic and infrastructure dependencies out of the command object.

## Implement the command object

Define each option or argument once as a private readonly field so the action can retrieve the same symbol instance. Configure defaults, descriptions, aliases, arity, and requiredness in the constructor. Add validation to the symbol when invalid syntax can be rejected without calling application services.

Set the command action to a private async adapter. In that adapter:

1. Read parsed values from `ParseResult`.
2. Construct the typed input.
3. Construct `CommandContext<TInput>` using `InvocationConfiguration.Output`, `InvocationConfiguration.Error`, and the received cancellation token.
4. Resolve the handler from the command's `IServiceProvider`.
5. Return the handler's exit code.

Use this shape, adapting APIs to the installed `System.CommandLine` version:

```csharp
using System.CommandLine;
using System.CommandLine.Parsing;
using Microsoft.Extensions.DependencyInjection;

namespace Product.Cli.Commands.Example;

public class ExampleCommand : Command
{
	private readonly IServiceProvider container;
	private readonly Option<string> valueOption;

	public ExampleCommand(IServiceProvider container)
		: base("example", "Perform the example operation")
	{
		this.container = container;
		this.valueOption = new Option<string>("--value", "-v")
		{
			Description = "Value to process.",
		};

		this.Options.Add(this.valueOption);
		this.SetAction(this.HandleAsync);
	}

	private async Task<int> HandleAsync(
		ParseResult parseResult,
		CancellationToken cancellationToken)
	{
		var input = new ExampleCommandInput(parseResult.GetValue(this.valueOption)!);
		var context = new CommandContext<ExampleCommandInput>(
			input,
			parseResult.InvocationConfiguration.Output,
			parseResult.InvocationConfiguration.Error,
			cancellationToken);
		var handler = this.container.GetRequiredService<ExampleCommandHandler>();

		return await handler.HandleAsync(context);
	}
}
```

Do not resolve the handler in the constructor. Resolution at invocation time preserves DI lifetimes and keeps command construction cheap.

## Define the input

Represent already-parsed values, not raw CLI tokens. Prefer the local immutable-class or record convention. Use domain-friendly types such as `Uri`, enum, `FileInfo`, or nullable values when parsing can establish them safely.

```csharp
public class ExampleCommandInput
{
	public ExampleCommandInput(string value)
	{
		this.Value = value;
	}

	public string Value { get; }
}
```

Do not put `Option`, `Argument`, `ParseResult`, writers, the service provider, or service dependencies in the input.

## Reuse or add the command context

Reuse the project's shared context when it exists. Otherwise add it once near the common command infrastructure:

```csharp
namespace Product.Cli.Commands;

public class CommandContext<TInput>
{
	public CommandContext(
		TInput input,
		TextWriter output,
		TextWriter error,
		CancellationToken cancellationToken)
	{
		this.Input = input;
		this.Output = output;
		this.Error = error;
		this.CancellationToken = cancellationToken;
	}

	public TInput Input { get; }
	public TextWriter Output { get; }
	public TextWriter Error { get; }
	public CancellationToken CancellationToken { get; }
}
```

Use the context writers rather than `Console.Out` or `Console.Error`; command invocation and tests can then redirect output correctly.

## Implement the handler

Inject the narrow interfaces needed by the use case. Expose one `HandleAsync(CommandContext<XCommandInput> context)` method returning `Task<int>`.

```csharp
public class ExampleCommandHandler
{
	private readonly IExampleService service;

	public ExampleCommandHandler(IExampleService service)
	{
		this.service = service;
	}

	public async Task<int> HandleAsync(CommandContext<ExampleCommandInput> context)
	{
		try
		{
			await this.service.ExecuteAsync(
				context.Input.Value,
				context.CancellationToken);
			await context.Output.WriteLineAsync("Example completed.");
			return 0;
		}
		catch (Exception exception)
		{
			await context.Error.WriteLineAsync(exception.Message);
			return 1;
		}
	}
}
```

Propagate `context.CancellationToken` through every cancellable call. Catch `Exception` at this command boundary when its purpose is to format any failure for standard error and return a nonzero exit code. Do not add an arbitrary exception-type filter.

Treat exit code `0` as success. Use the repository's established nonzero codes; if it has no policy, use `1` for an expected operational failure and let parse errors be handled by `System.CommandLine`.

## Register and attach

Register the handler with a lifetime compatible with its dependencies, normally transient:

```csharp
services.AddTransient<ExampleCommandHandler>();
```

After building the provider, attach the command to the correct parent:

```csharp
rootCommand.Subcommands.Add(new ExampleCommand(container));
```

Register every new handler dependency. Preserve service-provider validation when the project enables it.

## Test through the CLI boundary

Add a focused command test that builds a small service collection with capturing or stub dependencies, parses realistic command text, invokes the result, and asserts:

- the exit code;
- option and argument mapping into typed values;
- delegation to the handler's dependencies;
- output or error text when it is part of the behavior.

```csharp
using Assert = NUnit.Framework.Legacy.ClassicAssert;

[Test]
public async Task CommandMapsInputAndResolvesHandlerFromContainer()
{
	var service = new CaptureExampleService();
	var services = new ServiceCollection();
	services.AddSingleton<IExampleService>(service);
	services.AddTransient<ExampleCommandHandler>();
	await using var container = services.BuildServiceProvider();
	var command = new ExampleCommand(container);

	var exitCode = await command.Parse("--value sample").InvokeAsync();

	Assert.AreEqual(0, exitCode);
	Assert.AreEqual("sample", service.Value);
}
```

Also test validators and expected failure paths when they contain meaningful behavior. Prefer small fakes that capture calls over mocks unless the project already standardizes on a mocking library.

## Verify the change

Build the affected CLI project and run its focused test project. Check the final diff for all five pieces: command object, input, handler, DI registration, and tests. Confirm there is no direct console access, no parsing in the handler, and no dropped cancellation token.
