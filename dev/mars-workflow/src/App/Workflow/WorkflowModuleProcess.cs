using System.Diagnostics;
using System.Text;
using System.Text.Json.Nodes;
using System.Threading.Channels;
using Mars.Workflow.App.Interop;
using Mars.Workflow.App.Runtime;

namespace Mars.Workflow.App.Workflow;

public class WorkflowModuleProcess : IAsyncDisposable
{
	private readonly Process process;
	private readonly TimeSpan cancellationGrace;
	private readonly SemaphoreSlim invocationGate = new(1, 1);
	private readonly SemaphoreSlim inputGate = new(1, 1);
	private readonly Channel<JsonObject> outputMessages = Channel.CreateUnbounded<JsonObject>();
	private readonly HashSet<string> completedIds = new(StringComparer.Ordinal);
	private readonly object protocolGate = new();
	private readonly StringBuilder diagnostics = new();
	private readonly Task stdoutTask;
	private readonly Task stderrTask;
	private string? activeId;
	private WorkflowRuntimeException? protocolError;
	private volatile bool disposing;
	private int disposeStarted;

	public WorkflowModuleProcess(
		WorkflowModuleEntry entry,
		string workingDirectory,
		TimeSpan? cancellationGrace = null,
		Action<string>? diagnostic = null
	)
	{
		this.cancellationGrace = cancellationGrace ?? TimeSpan.FromSeconds(5);
		var start = new ProcessStartInfo
		{
			FileName = entry.Command,
			WorkingDirectory = workingDirectory,
			UseShellExecute = false,
			RedirectStandardInput = true,
			RedirectStandardOutput = true,
			RedirectStandardError = true,
			CreateNoWindow = true,
		};
		foreach (var argument in entry.Arguments)
		{
			start.ArgumentList.Add(argument);
		}
		WorkflowShellRunner.CopyMinimalEnvironment(start);

		this.process = new Process { StartInfo = start };
		this.process.Start();
		if (diagnostic is not null)
		{
			this.Diagnostic += diagnostic;
		}

		this.stdoutTask = this.ReadOutputAsync();
		this.stderrTask = this.ReadDiagnosticsAsync();
	}

	public event Action<string>? Diagnostic;

	public Task<JsonNode?> DescribeAsync(CancellationToken cancellationToken)
	{
		return this.InvokeAsync("describe", null, null, false, null, cancellationToken);
	}

	public Task<JsonNode?> InvokeFunctionAsync(
		string name,
		JsonNode? input,
		bool outputIsVoid,
		Func<string, int?, CancellationToken, Task> progress,
		CancellationToken cancellationToken
	)
	{
		return this.InvokeAsync(
			"fn",
			name,
			input,
			outputIsVoid,
			progress,
			cancellationToken
		);
	}

	public Task<JsonNode?> InvokeTaskAsync(
		string name,
		JsonNode? input,
		bool outputIsVoid,
		Func<string, int?, CancellationToken, Task> progress,
		CancellationToken cancellationToken
	)
	{
		return this.InvokeAsync(
			"task",
			name,
			input,
			outputIsVoid,
			progress,
			cancellationToken
		);
	}

	private async Task<JsonNode?> InvokeAsync(
		string type,
		string? name,
		JsonNode? input,
		bool outputIsVoid,
		Func<string, int?, CancellationToken, Task>? progress,
		CancellationToken cancellationToken
	)
	{
		await this.invocationGate.WaitAsync(cancellationToken);
		try
		{
			var id = Guid.CreateVersion7().ToString();
			var request = new JsonObject
			{
				["v"] = 1,
				["id"] = id,
				["type"] = type,
			};
			lock (this.protocolGate)
			{
				if (this.protocolError is not null)
				{
					throw this.protocolError;
				}

				this.activeId = id;
			}

			if (name is not null)
			{
				request["name"] = name;
			}

			if (input is not null)
			{
				request["input"] = input.DeepClone();
			}

			await this.SendAsync(request, cancellationToken);
			using var timeout = new CancellationTokenSource();
			using var registration = cancellationToken.Register(
				() =>
				{
					timeout.CancelAfter(this.cancellationGrace);
					_ = this.SendCancelAsync(id);
				}
			);

			while (true)
			{
				JsonObject message;
				try
				{
					message = await this.outputMessages.Reader.ReadAsync(timeout.Token);
				}
				catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
				{
					this.Kill();
					throw new OperationCanceledException(cancellationToken);
				}
				catch (ChannelClosedException exception)
				{
					WorkflowRuntimeException? protocolFailure;
					lock (this.protocolGate)
					{
						protocolFailure = this.protocolError;
					}

					if (protocolFailure is not null)
					{
						throw protocolFailure;
					}

					throw new WorkflowProtocolException(
						WorkflowProtocolCodes.MissingReturn,
						$"Module process exited without a return. {this.DiagnosticTail}",
						exception
					);
				}

				ValidateHeader(message, id);
				var messageType = message["type"]?.GetValue<string>();
				if (messageType == "progress")
				{
					var text = message["message"]?.GetValue<string>() ?? "";
					var percent = message["percent"]?.GetValue<int>();
					if (progress is not null)
					{
						await progress(text, percent, CancellationToken.None);
					}
					continue;
				}

				if (messageType != "ret")
				{
					throw new WorkflowProtocolException(
						WorkflowProtocolCodes.UnknownMessageType,
						$"Unknown module message type '{messageType}'."
					);
				}

				var status = message["status"]?.GetValue<string>();
				if (status == "ok")
				{
					var hasOutput = message.ContainsKey("output");
					var outputMatchesContract = outputIsVoid ? !hasOutput : hasOutput;
					if (!outputMatchesContract || message.ContainsKey("error"))
					{
						throw new WorkflowProtocolException(
							WorkflowProtocolCodes.InvalidReturn,
							"Module return does not match its output contract."
						);
					}

					return message["output"]?.DeepClone();
				}

				if (status == "cancel")
				{
					if (message.ContainsKey("output") || message.ContainsKey("error"))
					{
						throw new WorkflowProtocolException(
							WorkflowProtocolCodes.InvalidReturn,
							"Cancelled module return must omit output and error."
						);
					}

					throw new OperationCanceledException(cancellationToken);
				}

				if (status == "error")
				{
					var hasError = message["error"] is JsonObject;
					if (!hasError || message.ContainsKey("output"))
					{
						throw new WorkflowProtocolException(
							WorkflowProtocolCodes.InvalidReturn,
							"Failed module return needs error and no output."
						);
					}

					throw this.CreateModuleError(message);
				}

				throw new WorkflowProtocolException(
					WorkflowProtocolCodes.InvalidReturn,
					$"Unknown module return status '{status}'."
				);
			}
		}
		finally
		{
			this.invocationGate.Release();
		}
	}

	private async Task ReadOutputAsync()
	{
		try
		{
			while (true)
			{
				var line = await this.process.StandardOutput.ReadLineAsync();
				if (line is null)
				{
					break;
				}

				JsonObject message;
				try
				{
					var parsed = JsonNode.Parse(line);
					if (parsed is not JsonObject obj)
					{
						throw new FormatException("Protocol line must be an object.");
					}

					message = obj;
				}
				catch (Exception exception) when (
					exception is FormatException
						or System.Text.Json.JsonException
				)
				{
					this.FailProtocol(
						WorkflowProtocolCodes.InvalidMessage,
						"Module emitted invalid JSON protocol data.",
						exception
					);
					return;
				}

				if (!this.AcceptMessage(message))
				{
					return;
				}

				this.outputMessages.Writer.TryWrite(message);
			}

			this.outputMessages.Writer.TryComplete();
		}
		catch (IOException exception)
		{
			if (!this.disposing)
			{
				this.FailProtocol(
					WorkflowProtocolCodes.MissingReturn,
					"Module output stream failed.",
					exception
				);
			}
		}
	}

	private bool AcceptMessage(JsonObject message)
	{
		string? id;
		string? type;
		int? version;
		try
		{
			id = message["id"]?.GetValue<string>();
			type = message["type"]?.GetValue<string>();
			version = message["v"]?.GetValue<int>();
		}
		catch (InvalidOperationException exception)
		{
			this.FailProtocol(
				WorkflowProtocolCodes.InvalidMessage,
				"Module protocol header has invalid types.",
				exception
			);
			return false;
		}

		string? error = null;
		string? code = null;
		lock (this.protocolGate)
		{
			if (version != 1 || id is null || type is null)
			{
				error = "Module protocol header is incomplete.";
				code = WorkflowProtocolCodes.InvalidMessage;
			}
			else if (this.completedIds.Contains(id))
			{
				error = $"Module sent a message after terminal return for '{id}'.";
				code = WorkflowProtocolCodes.MessageAfterReturn;
			}
			else if (id != this.activeId)
			{
				error = $"Module sent a message for unknown request '{id}'.";
				code = WorkflowProtocolCodes.UnknownRequest;
			}
			else if (type != "progress" && type != "ret")
			{
				error = $"Module sent unknown message type '{type}'.";
				code = WorkflowProtocolCodes.UnknownMessageType;
			}
			else if (type == "ret")
			{
				this.completedIds.Add(id);
				this.activeId = null;
			}
		}

		if (error is not null)
		{
			var protocolCode = code ?? WorkflowProtocolCodes.InvalidMessage;
			this.FailProtocol(protocolCode, error);
			return false;
		}

		return true;
	}

	private void FailProtocol(string code, string message, Exception? inner = null)
	{
		WorkflowProtocolException error;
		if (inner is null)
		{
			error = new WorkflowProtocolException(code, message);
		}
		else
		{
			error = new WorkflowProtocolException(code, message, inner);
		}
		lock (this.protocolGate)
		{
			this.protocolError = error;
		}

		this.outputMessages.Writer.TryComplete(error);
		this.Kill();
	}

	private static void ValidateHeader(JsonObject message, string id)
	{
		var version = message["v"]?.GetValue<int>();
		var messageId = message["id"]?.GetValue<string>();
		if (version != 1 || messageId != id)
		{
			throw new WorkflowProtocolException(
				WorkflowProtocolCodes.InvalidMessage,
				"Module protocol version or request ID mismatch."
			);
		}
	}

	private WorkflowRuntimeException CreateModuleError(JsonObject message)
	{
		var error = message["error"] as JsonObject;
		var name = error?["name"]?.GetValue<string>() ?? "ModuleError";
		var code = error?["code"]?.GetValue<string>();
		var detail = error?["message"]?.GetValue<string>() ?? "Module failed.";
		var label = code is null ? name : $"{name} ({code})";

		return new WorkflowRuntimeException($"{label}: {detail} {this.DiagnosticTail}");
	}

	private async Task SendCancelAsync(string id)
	{
		try
		{
			var cancel = new JsonObject
			{
				["v"] = 1,
				["id"] = id,
				["type"] = "cancel",
			};
			await this.SendAsync(cancel, CancellationToken.None);
		}
		catch (IOException)
		{
			this.Kill();
		}
		catch (InvalidOperationException)
		{
			// The module may finish while cancellation is being sent.
		}
	}

	private async Task SendAsync(JsonObject message, CancellationToken cancellationToken)
	{
		await this.inputGate.WaitAsync(cancellationToken);
		try
		{
			var line = message.ToJsonString();
			await this.process.StandardInput.WriteLineAsync(line);
			await this.process.StandardInput.FlushAsync(cancellationToken);
		}
		finally
		{
			this.inputGate.Release();
		}
	}

	private async Task ReadDiagnosticsAsync()
	{
		while (true)
		{
			var line = await this.process.StandardError.ReadLineAsync();
			if (line is null)
			{
				break;
			}

			lock (this.diagnostics)
			{
				this.diagnostics.AppendLine(line);
				if (this.diagnostics.Length > 8192)
				{
					this.diagnostics.Remove(0, this.diagnostics.Length - 8192);
				}
			}

			this.Diagnostic?.Invoke(line);
		}
	}

	private string DiagnosticTail
	{
		get
		{
			lock (this.diagnostics)
			{
				return this.diagnostics.ToString();
			}
		}
	}

	private void Kill()
	{
		try
		{
			if (!this.process.HasExited)
			{
				this.process.Kill(entireProcessTree: true);
			}
		}
		catch (InvalidOperationException)
		{
			// A process that already exited needs no termination.
		}
	}

	public async ValueTask DisposeAsync()
	{
		if (Interlocked.Exchange(ref this.disposeStarted, 1) != 0)
		{
			return;
		}

		this.disposing = true;
		this.Kill();
		await this.process.WaitForExitAsync();
		await this.stdoutTask;
		await this.stderrTask;
		this.process.Dispose();
		this.inputGate.Dispose();
		this.invocationGate.Dispose();
		GC.SuppressFinalize(this);

		if (this.protocolError is not null)
		{
			throw this.protocolError;
		}
	}
}
