---
name: setup-dotnet10-workspace
description: Set up or incrementally migrate a multi-component repository to a .NET 10 workspace with shared MSBuild configuration, central NuGet versions, a root solution, and per-component src/test projects. Use for repository structure and build setup, including migrations from Bun or TypeScript; use ordinary C# guidance for implementation inside projects.
---

# Set up a .NET 10 workspace

Use the structure established in the Idle repository's `dev/` directory as a starting point. Adapt names, components, dependencies, and tooling to the target repository. The goal is one buildable .NET 10 workspace with clear component boundaries and test projects, while preserving behavior during any migration.

## Discover the target

- Inspect its current layout, package/workspace metadata, CI, existing .NET files, and the runtime entry points being migrated. Identify which packages are libraries, applications, APIs, CLIs, or consumer SDKs. Do not assume each TypeScript package needs a matching C# project.
- Check the installed .NET SDK and repository tool manager. Use `dotnet` directly unless the target already uses a wrapper such as `mise exec --`. Do not add or replace a tool manager solely to copy Idle's commands.
- Preserve existing work. If conversion is in progress, keep the old implementation available as a behavior reference until the requested portion is ported and verified. Report any intentionally deferred behavior.

## Establish the workspace

- Put new components in a dedicated directory such as `dev/` when the repository is mixed-language. Give each component `<component>/src/<Assembly>.csproj` and `<component>/test/<Assembly>.Tests.csproj`. Keeping the project file directly in `src` and `test` prevents `Src` or `Test` from entering default namespaces. Use explicit `RootNamespace` and `AssemblyName` where the folder name is not the desired identity.
- Create one root `.slnx` containing every source and test project. Group projects by component when that makes the solution easier to navigate. Use `ProjectReference` for local dependencies and reference the source project from its test project.
- Put `Directory.Build.props`, `Directory.Build.targets`, and `Directory.Packages.props` at the shared component root. Use the first for common build properties, the second only for conditional overrides, and the third for central package management. Keep package versions out of individual project files.
- Apply relevant `.editorconfig` rules and ignore `bin`, `obj`, and IDE outputs. Extend existing files in place; preserve unrelated language settings and project conventions.
- Pick the appropriate SDK per source project: `Microsoft.NET.Sdk` for libraries and CLIs, `Microsoft.NET.Sdk.Web` for ASP.NET Core servers. Set `OutputType=Exe` for a CLI. Give every test project `IsTestProject=true`, `IsPackable=false`, a test SDK/runner/framework, and a source project reference. Idle uses NUnit; follow an existing target-repository test framework if one is established.

See [workspace examples](references/workspace-examples.md) for the concrete file shapes used by Idle. Adapt versions to the target's available packages and compatibility requirements; the recorded versions are examples, not a requirement to upgrade.

## Migrate by component

- Map behavior and public contracts before moving code. Separate shared library code, server code, consumer SDKs, and local CLI code only where those boundaries exist in the target.
- Keep applications' composition roots small. In an ASP.NET Core app, use a regular `Program.Main` for orchestration and focused boot files for configuration, dependency registration, and routes when the app warrants that structure. In a CLI, register dependencies and commands at the composition root. Avoid creating empty layers just to match Idle's folders.
- Implement enough of each component for its project to build and its focused tests to pass. Wire references and central package entries as dependencies are introduced. Do not label unported behavior as complete.

## Verify and report

Restore, build, and test the root solution. If the target uses a tool wrapper, run these through that wrapper. Build/test individual projects while iterating, then check the whole solution. Resolve warnings under the repository's analyzer policy instead of adding broad suppressions.

Report the created structure, chosen component mapping, commands run and results, and any behavior that remains in the old runtime.
