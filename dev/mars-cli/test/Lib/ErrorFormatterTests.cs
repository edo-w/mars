using Mars.Cli.Lib;
using Mars.Core.Lib;
using Mars.Workflow.App.Interop;
using NUnit.Framework;
using Assert = NUnit.Framework.Legacy.ClassicAssert;

namespace Mars.Cli.Tests.Lib;

public class ErrorFormatterTests
{
	[Test]
	public void FormatsSemanticErrorContextAndInnerCause()
	{
		var cause = new IOException("disk unavailable");
		var error = new ConflictException("Environment already exists.", cause);
		error.Data["environment"] = "team/dev";
		error.Data["retryable"] = false;
		error.Data["attempts"] = 2;

		var result = ErrorFormatter.Format(error);

		Assert.IsTrue(result.Contains("conflict error (409): Environment already exists.", StringComparison.Ordinal));
		Assert.IsTrue(result.Contains("environment: team/dev", StringComparison.Ordinal));
		Assert.IsTrue(result.Contains("retryable: false", StringComparison.Ordinal));
		Assert.IsTrue(result.Contains("attempts: 2", StringComparison.Ordinal));
		Assert.IsTrue(result.Contains("IOException: disk unavailable", StringComparison.Ordinal));
		Assert.IsFalse(result.Contains(" at ", StringComparison.Ordinal));
	}

	[Test]
	public void FormatsUnknownErrorWithoutInventingAStatusCode()
	{
		var error = new InvalidOperationException("Unexpected failure.");
		error.Data["internal"] = new object();

		var result = ErrorFormatter.Format(error);

		Assert.AreEqual("InvalidOperationException: Unexpected failure.", result);
	}

	[Test]
	public void FormatsErrorCodesFromOtherImplementations()
	{
		var error = new ExternalError("Remote service failed.");

		var result = ErrorFormatter.Format(error);

		Assert.AreEqual("ExternalError (503): Remote service failed.", result);
	}

	[Test]
	public void FormatsWorkflowProtocolCode()
	{
		var error = new WorkflowProtocolException(
			WorkflowProtocolCodes.MessageAfterReturn,
			"Module sent two returns."
		);

		var result = ErrorFormatter.Format(error);

		Assert.AreEqual(
			"workflow protocol error (WFPROTO003): Module sent two returns.",
			result
		);
	}

	private class ExternalError : Exception, IErrorCode
	{
		public ExternalError(string message)
			: base(message)
		{
		}

		public int Code => 503;
	}
}
