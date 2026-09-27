using Mars.Core.Lib;
using Mars.Local.App.LocalEnvironment;
using Moq;
using NUnit.Framework;
using Assert = NUnit.Framework.Legacy.ClassicAssert;

namespace Mars.Local.Tests.App.LocalEnvironment;

public class LocalEnvironmentSelectionStoreTests
{
	[Test]
	public void SelectionUsesCheckoutLocalFileAndClearsOnlyMatchingValue()
	{
		var root = Path.Combine(Path.GetTempPath(), "mars-checkout");
		var directory = Path.Combine(root, ".mars");
		var path = Path.Combine(directory, "selected-environment");
		string? contents = null;
		var vfs = new Mock<IVfs>();
		vfs.Setup(item => item.FileExists(path)).Returns(() => contents is not null);
		vfs.Setup(item => item.ReadText(path)).Returns(() => contents!);
		vfs.Setup(item => item.WriteText(path, It.IsAny<string>()))
			.Callback<string, string>((_, value) => contents = value);
		var selection = new LocalEnvironmentSelectionStore(root, vfs.Object);

		Assert.IsNull(selection.Read());

		selection.Write("team/dev");
		Assert.AreEqual("team/dev", selection.Read());
		vfs.Verify(item => item.CreateDirectory(directory), Times.Once());

		selection.ClearIfSelected("team/prod");
		vfs.Verify(item => item.DeleteFile(path), Times.Never());

		selection.ClearIfSelected("team/dev");
		vfs.Verify(item => item.DeleteFile(path), Times.Once());
	}
}
