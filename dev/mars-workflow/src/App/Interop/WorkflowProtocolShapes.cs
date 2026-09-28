using Mars.Workflow.App.Runtime;

namespace Mars.Workflow.App.Interop;

public static class WorkflowProtocolCodes
{
	public const string InvalidMessage = "WFPROTO001";
	public const string UnknownRequest = "WFPROTO002";
	public const string MessageAfterReturn = "WFPROTO003";
	public const string InvalidReturn = "WFPROTO004";
	public const string UnknownMessageType = "WFPROTO005";
	public const string MissingReturn = "WFPROTO006";
}

public class WorkflowProtocolException : WorkflowRuntimeException
{
	public WorkflowProtocolException(string code, string message) : base(message)
	{
		this.Code = code;
	}

	public WorkflowProtocolException(string code, string message, Exception inner)
		: base(message, inner)
	{
		this.Code = code;
	}

	public string Code { get; }
}
