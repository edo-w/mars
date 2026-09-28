using Mars.Workflow.App.Language;
using Mars.Workflow.App.Modules;

namespace Mars.Workflow.App.Compiler;

public class WorkflowCompiler
{
	private readonly IWorkflowSourceReader sourceReader;
	private readonly IWorkflowModuleCatalog moduleCatalog;
	private readonly Dictionary<string, CompiledWorkflow> workflows = new(StringComparer.OrdinalIgnoreCase);
	private readonly HashSet<string> activePaths = new(StringComparer.OrdinalIgnoreCase);
	private readonly List<WorkflowDiagnostic> diagnostics = [];

	public WorkflowCompiler(
		IWorkflowSourceReader sourceReader,
		IWorkflowModuleCatalog moduleCatalog
	)
	{
		this.sourceReader = sourceReader;
		this.moduleCatalog = moduleCatalog;
	}

	public async Task<WorkflowCompilation> CompileAsync(
		string path,
		CancellationToken cancellationToken = default
	)
	{
		this.workflows.Clear();
		this.activePaths.Clear();
		this.diagnostics.Clear();

		var fullPath = Path.GetFullPath(path);
		var root = await this.CompileFileAsync(fullPath, cancellationToken);
		var result = new WorkflowCompilation(
			root,
			[.. this.diagnostics],
			new Dictionary<string,
			CompiledWorkflow>(this.workflows, StringComparer.OrdinalIgnoreCase)
		);

		return result;
	}

	private async Task<CompiledWorkflow?> CompileFileAsync(
		string path,
		CancellationToken cancellationToken
	)
	{
		var fullPath = Path.GetFullPath(path);
		if (this.workflows.TryGetValue(fullPath, out var existing))
		{
			return existing;
		}

		if (!this.activePaths.Add(fullPath))
		{
			var span = new SourceSpan(fullPath, 0, 0, 1, 1);
			this.diagnostics.Add(new WorkflowDiagnostic("WF200", "Workflow call cycle detected.", span));

			return null;
		}

		try
		{
			string source;
			try
			{
				source = await this.sourceReader.ReadAsync(fullPath, cancellationToken);
			}
			catch (Exception exception) when (exception is IOException or UnauthorizedAccessException)
			{
				var isRoot = this.activePaths.Count == 1;
				if (isRoot)
				{
					var span = new SourceSpan(fullPath, 0, 0, 1, 1);
					this.diagnostics.Add(new WorkflowDiagnostic("WF201", exception.Message, span));
				}

				return null;
			}

			var lexer = new WorkflowLexer(source, fullPath);
			var tokens = lexer.Lex();
			var parser = new WorkflowParser(tokens, fullPath);
			var document = parser.Parse();
			this.diagnostics.AddRange(lexer.Diagnostics);
			this.diagnostics.AddRange(parser.Diagnostics);

			if (document.Properties is null)
			{
				return null;
			}

			var imports = await this.BindImportsAsync(document, cancellationToken);
			var binder = new WorkflowBinder(
				document,
				imports,
				this.diagnostics,
				this.CompileFileAsync
			);
			var compiled = await binder.BindAsync(cancellationToken);
			this.workflows.Add(fullPath, compiled);

			return compiled;
		}
		finally
		{
			this.activePaths.Remove(fullPath);
		}
	}

	private async Task<Dictionary<string, BoundSymbol>> BindImportsAsync(
		WorkflowDocument document,
		CancellationToken cancellationToken
	)
	{
		var imports = new Dictionary<string, BoundSymbol>(StringComparer.Ordinal);
		foreach (var syntax in document.Imports)
		{
			WorkflowModule? module;
			try
			{
				module = await this.moduleCatalog.GetAsync(syntax.ModulePath, cancellationToken);
			}
			catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
			{
				throw;
			}
			catch (Exception exception)
			{
				this.diagnostics.Add(new WorkflowDiagnostic("WF202", exception.Message, syntax.Span));
				continue;
			}

			if (module is null)
			{
				var message = $"Module '{syntax.ModulePath}' is not in the resolved package set.";
				this.diagnostics.Add(new WorkflowDiagnostic("WF203", message, syntax.Span));
				continue;
			}

			if (module.Path != syntax.ModulePath)
			{
				var message = $"Module '{syntax.ModulePath}' described itself as '{module.Path}'.";
				this.diagnostics.Add(new WorkflowDiagnostic("WF204", message, syntax.Span));
				continue;
			}

			if (syntax.Mode is UseMode.Module or UseMode.Alias)
			{
				var leaf = syntax.ModulePath.Split('/').Last();
				var name = syntax.Alias ?? leaf;
				this.AddImport(imports, name, new BoundSymbol(name, module), syntax.Span);
				continue;
			}

			var exports = syntax.Mode == UseMode.Wildcard
				? module.Exports
				: module.Exports.Where(item => syntax.Names.Contains(item.Name, StringComparer.Ordinal)).ToArray();
			foreach (var export in exports)
			{
				var symbol = new BoundSymbol(export.Name, module, export);
				this.AddImport(imports, export.Name, symbol, syntax.Span);
			}

			if (syntax.Mode == UseMode.Selective)
			{
				foreach (var name in syntax.Names)
				{
					var found = module.Exports.Any(item => item.Name == name);
					if (!found)
					{
						this.diagnostics.Add(
							new WorkflowDiagnostic(
								"WF205",
								$"Module '{module.Path}' does not export '{name}'.",
								syntax.Span
							)
						);
					}
				}
			}
		}

		return imports;
	}

	private void AddImport(
		Dictionary<string, BoundSymbol> imports,
		string name,
		BoundSymbol symbol,
		SourceSpan span
	)
	{
		if (!imports.TryAdd(name, symbol))
		{
			this.diagnostics.Add(new WorkflowDiagnostic("WF206", $"Duplicate binding '{name}'.", span));
		}
	}
}
