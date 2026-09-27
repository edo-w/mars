namespace Mars.Core.Lib;

public interface IErrorCode
{
	int Code { get; }
}

public class AppException : Exception, IErrorCode
{
	public AppException(string message, Exception? innerException = null)
		: base(message, innerException)
	{
	}

	public virtual int Code => 500;

	public virtual string FriendlyName => "app error";
}

public class BadRequestException : AppException
{
	public BadRequestException(string message, Exception? innerException = null)
		: base(message, innerException)
	{
	}

	public override int Code => 400;

	public override string FriendlyName => "bad request error";
}

public class NotFoundException : AppException
{
	public NotFoundException(string message, Exception? innerException = null)
		: base(message, innerException)
	{
	}

	public override int Code => 404;

	public override string FriendlyName => "not found error";
}

public class ConflictException : AppException
{
	public ConflictException(string message, Exception? innerException = null)
		: base(message, innerException)
	{
	}

	public override int Code => 409;

	public override string FriendlyName => "conflict error";
}

public class UnprocessableException : AppException
{
	public UnprocessableException(string message, Exception? innerException = null)
		: base(message, innerException)
	{
	}

	public override int Code => 422;

	public override string FriendlyName => "unprocessable request error";
}
