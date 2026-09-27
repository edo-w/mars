# Idle workspace examples

These are examples from the Idle migration, not fixed requirements for another repository. Replace project names, versions, and package references to match the target.

## Layout and solution

```text
<repository>/
  <name>.slnx
  dev/
    Directory.Build.props
    Directory.Build.targets
    Directory.Packages.props
    <component>/
      src/<Assembly>.csproj
      test/<Assembly>.Tests.csproj
```

The root solution includes every source and test project. A representative component group is:

```xml
<Solution>
  <Folder Name="/dev/my-component/">
    <Project Path="dev/my-component/src/My.Component.csproj" />
    <Project Path="dev/my-component/test/My.Component.Tests.csproj" />
  </Folder>
</Solution>
```

## Shared build files

Idle's `dev/Directory.Build.props` sets:

```xml
<Project>
  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>enable</Nullable>
    <TreatWarningsAsErrors>true</TreatWarningsAsErrors>
    <AnalysisLevel>latest-recommended</AnalysisLevel>
    <Deterministic>true</Deterministic>
    <BaseOutputPath>../bin/$(MSBuildProjectName)/</BaseOutputPath>
    <BaseIntermediateOutputPath>../obj/$(MSBuildProjectName)/</BaseIntermediateOutputPath>
  </PropertyGroup>
</Project>
```

The output paths place artifacts beside each component's `src` or `test` directory, grouped by project name. Idle also has narrow analyzer suppressions for inherited framework APIs and a conditional `Directory.Build.targets` rule for its test projects. Add such rules only when a concrete diagnostic in the target justifies them.

`dev/Directory.Packages.props` enables central package management and records package versions once:

```xml
<Project>
  <PropertyGroup>
    <ManagePackageVersionsCentrally>true</ManagePackageVersionsCentrally>
  </PropertyGroup>
  <ItemGroup>
    <PackageVersion Include="Microsoft.NET.Test.Sdk" Version="<compatible-version>" />
    <PackageVersion Include="NUnit" Version="<compatible-version>" />
    <PackageVersion Include="NUnit3TestAdapter" Version="<compatible-version>" />
  </ItemGroup>
</Project>
```

Add package versions as needed. A project then uses `<PackageReference Include="NUnit" />` without a `Version` attribute. Use framework references supplied by the Web SDK where possible.

## Project shapes

Library source:

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <RootNamespace>My.Component</RootNamespace>
    <AssemblyName>My.Component</AssemblyName>
  </PropertyGroup>
</Project>
```

CLI source adds `<OutputType>Exe</OutputType>` and its command-line and DI package references when those features are used. Web API source uses `Sdk="Microsoft.NET.Sdk.Web"`.

Test project:

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <RootNamespace>My.Component.Tests</RootNamespace>
    <AssemblyName>My.Component.Tests</AssemblyName>
    <IsTestProject>true</IsTestProject>
    <IsPackable>false</IsPackable>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="Microsoft.NET.Test.Sdk" />
    <PackageReference Include="NUnit" />
    <PackageReference Include="NUnit3TestAdapter" />
  </ItemGroup>
  <ItemGroup>
    <ProjectReference Include="../src/My.Component.csproj" />
  </ItemGroup>
</Project>
```

## Repository integration

Idle's `.editorconfig` uses UTF-8, LF, final newlines, tabs with width 4 for C# and MSBuild XML, and C# suggestions to avoid primary constructors and qualify instance members with `this.`. Copy these preferences only if they fit the target repository. Its `.gitignore` excludes `bin`, `obj`, and `.vs`.

The solution can be checked with:

```sh
dotnet restore <name>.slnx
dotnet build <name>.slnx --no-restore
dotnet test <name>.slnx --no-build
```

Idle wraps these commands with `mise exec --` because that is how its repository documentation invokes tools. Its `mise.toml` currently pins Node and pnpm, not .NET; the wrapper is not part of the .NET layout itself.
