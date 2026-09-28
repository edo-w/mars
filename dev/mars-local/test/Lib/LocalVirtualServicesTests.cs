using Mars.Core.Lib;
using Mars.Local.Lib;
using NUnit.Framework;
using Assert = NUnit.Framework.Legacy.ClassicAssert;

namespace Mars.Local.Tests.Lib;

public class LocalVirtualServicesTests
{
	[Test]
	public async Task VfsReadsWritesAndDeletesFiles()
	{
		var root = Path.Combine(
			TestContext.CurrentContext.WorkDirectory,
			"test-state",
			Guid.NewGuid().ToString("N")
		);
		var directory = Path.Combine(root, "nested");
		var textPath = Path.Combine(directory, "config.txt");
		var bytesPath = Path.Combine(directory, "data.bin");
		var privatePath = Path.Combine(directory, "private.key");
		var vfs = new LocalVfs();

		vfs.CreateDirectory(directory);
		await vfs.WriteTextAsync(textPath, "hello");
		await vfs.WriteBytesAsync(bytesPath, [0, 1, 255]);
		using (var privateFile = vfs.CreateNewFile(privatePath, privateFile: true))
		{
			privateFile.WriteByte(42);
		}

		Assert.IsTrue(vfs.DirectoryExists(directory));
		Assert.IsTrue(vfs.FileExists(textPath));
		Assert.IsTrue(vfs.ListDirectory(directory).SequenceEqual(["config.txt", "data.bin", "private.key"]));
		Assert.AreEqual("hello", await vfs.ReadTextAsync(textPath));
		Assert.AreEqual("hello", vfs.ReadText(textPath));
		Assert.IsTrue(vfs.FileExists(privatePath));
		Assert.Throws<IOException>(() => vfs.CreateNewFile(privatePath, privateFile: true));
		var expectedBytes = new byte[] { 0, 1, 255 };
		var actualBytes = await vfs.ReadBytesAsync(bytesPath);
		Assert.IsTrue(actualBytes.AsSpan().SequenceEqual(expectedBytes));

		vfs.DeleteFile(textPath);
		Assert.IsFalse(vfs.FileExists(textPath));
		vfs.DeleteDirectory(directory, recursive: true);
		Assert.IsFalse(vfs.DirectoryExists(directory));
		Assert.IsEmpty(vfs.ListDirectory(directory));
	}

	[Test]
	public async Task VTimerProvidesUtcTimeAndHonorsCancellation()
	{
		var timer = new LocalVTimer();
		using var cancellation = new CancellationTokenSource();
		cancellation.Cancel();

		Assert.AreEqual(TimeSpan.Zero, timer.UtcNow.Offset);
		Assert.ThrowsAsync<TaskCanceledException>(async () =>
		{
			await timer.DelayAsync(TimeSpan.FromMinutes(1), cancellation.Token);
		});
	}

	[Test]
	public async Task VProcessCapturesCommandOutputAndEnvironment()
	{
		var process = new LocalVProcess();
		var command = new ProcessCommand(
			"dotnet",
			["--version"],
			TestContext.CurrentContext.WorkDirectory
		);

		var result = await process.RunAsync(command);

		Assert.AreEqual(0, result.ExitCode);
		Assert.IsNotEmpty(result.StandardOutput.Trim());
		Assert.IsNotEmpty(process.CurrentDirectory);
		Assert.IsNotEmpty(process.UserHomeDirectory);
		Assert.IsNotEmpty(process.CommandLineArguments);
	}
}
