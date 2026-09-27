using Mars.Core.App.Secrets;
using Mars.Core.Lib;

namespace Mars.Cli.Boot;

public class ConsolePasswordSource : IPasswordSource
{
	private readonly IVProcess process;

	public ConsolePasswordSource(IVProcess process)
	{
		this.process = process;
	}

	public string GetPassword(string environmentName)
	{
		var suffix = environmentName.ToUpperInvariant().Replace('-', '_');
		var scopedName = $"MARS_SECRETS_PASSWORD_{suffix}";
		var scopedPassword = this.process.GetEnvironmentVariable(scopedName);

		if (!string.IsNullOrEmpty(scopedPassword))
		{
			return scopedPassword;
		}

		var password = this.process.GetEnvironmentVariable("MARS_SECRETS_PASSWORD");

		if (!string.IsNullOrEmpty(password))
		{
			return password;
		}

		throw new UnprocessableException(
			$"Missing secrets password for '{environmentName}'. Set {scopedName} or MARS_SECRETS_PASSWORD."
		);
	}
}
