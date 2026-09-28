using System.IO.Pipes;
using System.Security.Cryptography;
using System.Text;
using Mars.Core.Lib;

namespace Mars.Local.App.LocalSshCa;

public class AskpassBridge : IAsyncDisposable
{
	private readonly CancellationTokenSource cancellation = new();
	private readonly IVTimer timer;
	private readonly string passphrase;
	private readonly int allowedReads;
	private Task? serverTask;
	private Task? timeoutTask;

	public AskpassBridge(string passphrase, int allowedReads, IVTimer timer)
	{
		this.passphrase = passphrase;
		this.allowedReads = allowedReads;
		this.timer = timer;
		this.PipeName = $"mars-askpass-{Guid.NewGuid():N}";

		var tokenBytes = RandomNumberGenerator.GetBytes(32);
		this.Token = Convert.ToHexString(tokenBytes);
	}

	public string PipeName { get; }
	public string Token { get; }

	public void Start()
	{
		this.serverTask = this.ServeAsync();
		this.timeoutTask = this.TimeoutAsync();
	}

	public async ValueTask DisposeAsync()
	{
		await this.cancellation.CancelAsync();

		if (this.serverTask is not null)
		{
			try
			{
				await this.serverTask;
			}
			catch (OperationCanceledException)
			{
				// The request window closed before another read.
			}
		}

		if (this.timeoutTask is not null)
		{
			await this.timeoutTask;
		}

		this.cancellation.Dispose();
		GC.SuppressFinalize(this);
	}

	public static async Task<string> ReadFromEnvironmentAsync(IVProcess process)
	{
		var pipeName = process.GetEnvironmentVariable("MARS_ASKPASS_PIPE");

		if (pipeName is null)
		{
			throw new AppException("Missing askpass pipe.");
		}

		var token = process.GetEnvironmentVariable("MARS_ASKPASS_TOKEN");

		if (token is null)
		{
			throw new AppException("Missing askpass token.");
		}

		using var client = new NamedPipeClientStream(".", pipeName, PipeDirection.InOut, PipeOptions.Asynchronous);
		await client.ConnectAsync(10_000);

		var encoding = new UTF8Encoding(false);
		using var writer = new StreamWriter(client, encoding, leaveOpen: true) { AutoFlush = true };
		using var reader = new StreamReader(client, Encoding.UTF8, leaveOpen: true);

		await writer.WriteLineAsync(token);
		var passphrase = await reader.ReadLineAsync();

		if (passphrase is null)
		{
			throw new AppException("Askpass bridge closed.");
		}

		return passphrase;
	}

	private async Task TimeoutAsync()
	{
		try
		{
			await this.timer.DelayAsync(TimeSpan.FromSeconds(30), this.cancellation.Token);
		}
		catch (OperationCanceledException)
		{
			return;
		}

		await this.cancellation.CancelAsync();
	}

	private async Task ServeAsync()
	{
		for (var readCount = 0; readCount < this.allowedReads; readCount++)
		{
			using var pipe = new NamedPipeServerStream(
				this.PipeName,
				PipeDirection.InOut,
				1,
				PipeTransmissionMode.Byte,
				PipeOptions.Asynchronous | PipeOptions.CurrentUserOnly
			);
			await pipe.WaitForConnectionAsync(this.cancellation.Token);

			using var reader = new StreamReader(pipe, Encoding.UTF8, leaveOpen: true);
			var encoding = new UTF8Encoding(false);
			using var writer = new StreamWriter(pipe, encoding, leaveOpen: true) { AutoFlush = true };

			var suppliedToken = await reader.ReadLineAsync(this.cancellation.Token);
			var expectedBytes = Encoding.UTF8.GetBytes(this.Token);
			var suppliedBytes = Encoding.UTF8.GetBytes(suppliedToken ?? "");
			var valid = suppliedBytes.Length == expectedBytes.Length &&
				CryptographicOperations.FixedTimeEquals(suppliedBytes, expectedBytes);

			if (!valid)
			{
				throw new UnauthorizedAccessException("Invalid askpass token.");
			}

			await writer.WriteLineAsync(this.passphrase);
		}
	}
}
