---
name: write-csharp
description: Write, refactor, and review C# and .NET code using this repository's conventions for naming, API actions and shapes, HTTP clients, JSON and database serialization, startup organization, control flow, collections, NUnit tests, and object-oriented style. Use for any C# implementation, correction, code review, API, client, bootstrapping, model/shape, serialization, or NUnit test work in this repository.
---

# Write C#

Inspect nearby code before editing and preserve the repository's target framework, formatting, nullable annotations, and analyzer settings. Apply the rules below to new and modified code. When a requested change exposes nearby violations that directly conflict with the implementation, correct them coherently.

## Name types and files

- Call files or groups containing type definitions, inputs, outputs, enums, and other API data definitions **shapes**. Name files such as `GenerationShapes.cs`.
- Do not mark classes `sealed` unless the user explicitly asks for it or a framework requires it.
- Name a client `<Area>Client`, not `<Area>ApiClient`. Use `GenerationClient` and `IGenerationClient`, not `GenerationApiClient` and `IGenerationApiClient`.
- Use normal C# PascalCase for types, methods, and properties.
- Prefer explicit `this.` qualification for instance fields, properties, methods, and events.
- Prefer simplified collection expressions when the target type is known: `this.References = [];` instead of `this.References = new List<GSymbolReference>();`.
- Avoid redundant factories that only call a public constructor. Use `new GenerationOutput()` instead of a `CreateEmpty()` method that returns it.

## Model APIs as actions

Treat an API operation as an action. Name the action with a verb followed by a noun, where the noun is the resource or operation: `ListRuns`, `GetRun`, `CreateRun`, `UpdateRun`, `DeleteRun`, or `GenerateArtifacts`.

Name the action's parameters `<Action>Input` and its result `<Action>Output`. Do not use `Request`, `Response`, or `Contract` in these roles.

```csharp
public class GenerateInput
{
	public GenerateInput(IReadOnlyList<GenerateModelInput>? models = null)
	{
		this.Models = models ?? [];
	}

	public IReadOnlyList<GenerateModelInput> Models { get; }
}

public class GenerateOutput
{
	public GenerateOutput(IReadOnlyList<GeneratedFile>? files = null)
	{
		this.Files = files ?? [];
	}

	public IReadOnlyList<GeneratedFile> Files { get; }
}
```

Represent server-side action behavior with a clearly named action class when the operation needs injected dependencies. For example, use `GenerateAction.ExecuteAsync(GenerateInput input, CancellationToken cancellationToken)`.

## Write HTTP clients

Give each client the base URL of the server in its constructor. Store or apply that URL once and build relative action routes from it. Do not pass the server URL into every action method.

```csharp
public class GenerationClient : IGenerationClient
{
	private readonly HttpClient httpClient;

	public GenerationClient(Uri baseUrl, HttpClient httpClient)
	{
		this.httpClient = httpClient;
		this.httpClient.BaseAddress = baseUrl;
	}

	public Task<GenerateOutput> GenerateAsync(
		GenerateInput input,
		CancellationToken cancellationToken = default)
	{
		// Call the relative action route.
	}
}
```

Keep the action method focused on its input and execution context, normally the cancellation token. If callers select the server at runtime, create the appropriately configured client at that boundary or use a small client factory.

## Serialize external data as snake_case

Use snake_case for every JSON property sent to or returned from a service or API. Use snake_case for serialized values stored in database columns. Keep C# property names in PascalCase.

Prefer a shared serializer policy or source-generation setting over annotating every ordinary property:

```csharp
[JsonSourceGenerationOptions(
	JsonSerializerDefaults.Web,
	PropertyNamingPolicy = JsonKnownNamingPolicy.SnakeCaseLower)]
[JsonSerializable(typeof(GenerateInput))]
[JsonSerializable(typeof(GenerateOutput))]
internal partial class GenerationJsonContext : JsonSerializerContext
{
}
```

Use `[JsonPropertyName("...")]` only when a property needs a wire name the shared snake_case policy cannot express correctly. Apply the same snake_case policy to database JSON serializers and explicit column mappings.

Represent configuration collections as arrays consistently. For model source paths, use an `Inputs` C# property of type `string[]` and an `inputs` JSON array. Do not accept both a scalar and an array through a custom converter when one stable array shape is sufficient.

## Organize application bootstrapping

Do not use top-level statements. Define a normal `Program` class with a static `Main` entry point.

For server applications, put startup code in `src/Boot`, one file per area such as `Container.cs`, `Config.cs`, `Http.cs`, or another service/component area. Keep route registration out of `Program.cs`. Keep dependency registrations out of `Program.cs`.

Make `Program.Main` perform only high-level orchestration:

1. Create the builder/container.
2. Apply configuration and dependency registration through boot components.
3. Build the application/server.
4. Apply HTTP routes and other components through boot components.
5. Run the application.

Design boot components so later services can be added as another focused boot file and one orchestration call.

## Handle errors at application boundaries

When a command boundary exists to format an error and return a nonzero exit code, catch `Exception` without listing arbitrary framework exception types. The boundary does not need to predict every operational failure merely to print its message.

```csharp
try
{
	return await this.ExecuteAsync(context);
}
catch (Exception exception)
{
		await context.Error.WriteLineAsync(exception.Message);
	return 1;
}
```

Do not swallow errors inside domain or infrastructure code. Do not catch exceptions where no useful translation, cleanup, retry, or boundary behavior occurs. Preserve cancellation behavior when the application has a distinct cancellation policy.

## Add cancellation only when it is real

Do not add `CancellationToken cancellationToken = default` mechanically to internal operations. Omit the token when callers have no cancellation source or the implementation cannot meaningfully consume it. For example, prefer `Task<Config> LoadAsync(string path)` for an internal loader whose callers never cancel it.

Keep and propagate cancellation tokens at boundaries that provide real cancellation, including ASP.NET Core actions, HTTP client calls, hosted services, and framework operations whose invocation can be cancelled. Once accepted, pass the token through every cancellable operation in that path. Do not retain an unused token merely for symmetry.

## Keep control flow readable

Favor named intermediate values over nested construction or long expressions.
Declare SQL as readable multiline text, declare parameter objects separately,
then call the repository method. Put each parameter on its own line when a
method signature or call no longer reads clearly on one line. Use blank lines
to group setup, execution, and results. Give collection transformations a
name before returning them when the transformation has several steps.
Use a blank line whenever the method moves to a new operation, even in a
short method. Group related declarations together, then separate validation,
construction, persistence, mapping, output, and return. Do not add comments
that merely label these groups; the blank lines and names should make them
clear.
Separate a return from the preceding work with a blank line when a method
contains more than two statements. Keep one or two statement methods compact.
When a call needs a constructed model, options object, or parameter object,
assign it to a named local before the call. Keep `if` conditions short; name
the result of any collection query or compound check before testing it.
Use a named result object when a method returns several related values.
Avoid tuple return types and deconstruction in application interfaces.

Do not use `?? throw` or conditional operators for side effects. Use an
explicit `if` for validation and failure paths.

Use a normal `Environment` import or a narrow alias to resolve a collision;
avoid fully qualifying framework type names throughout methods.

Use a ternary only for a simple two-value assignment:

```csharp
var mode = enabled ? activeMode : inactiveMode;
```

Never nest ternaries. Use `if`/`else` when selecting among more than two values or when either branch is complex.

Extract compound decisions into named booleans before an `if`:

```csharp
ImportStatement? statement = null;
var hasStatement = imports.TryGetValue(moduleName, out statement);
var createImportStatement = !hasStatement || isDefaultImport || isNamespaceImport;
if (createImportStatement)
{
	// ...
}
```

For loops with several boundary and equality checks, keep the loop condition simple and place named checks in the body. Break or continue explicitly so each stopping condition is readable.

## Write NUnit tests

- Name test methods in PascalCase, like other C# methods.
- Structure each test as Arrange, Act, Assert. Separate the phases with blank lines when each phase has statements.
- Use classic, direct assertions. Do not use `Assert.That` or constraint syntax.
- Prefer `Assert.IsEmpty`, `Assert.IsNotEmpty`, `Assert.IsNull`, `Assert.IsNotNull`, `Assert.AreEqual`, and `Assert.IsTrue`.
- With NUnit 4, alias `NUnit.Framework.Legacy.ClassicAssert` to `Assert` when necessary.
- Keep tests isolated. Create fresh dependencies and state for every test.
- When setup repeats, use a `CreateSut()` helper that returns the system under test and the collaborators/state the test needs. Do not retain mutable fixtures across tests merely to avoid setup.
- Use shared class state only when the framework or scenario makes isolated construction impractical.

```csharp
using Assert = NUnit.Framework.Legacy.ClassicAssert;

[Test]
public async Task GenerateReturnsAnEmptyOutput()
{
	var sut = CreateSut();

	var output = await sut.Action.ExecuteAsync(new GenerateInput());

	Assert.IsEmpty(output.Files);
}
```

## Verify

Build affected projects with warnings treated as errors and run focused tests. Search modified code for `sealed class`, `Assert.That`, nested ternaries, `Request`, `Response`, `Contract`, redundant empty factories, and top-level program statements. Confirm external JSON and stored JSON use snake_case.
