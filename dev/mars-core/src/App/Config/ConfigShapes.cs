using System.Text.RegularExpressions;
using Mars.Core.Lib;

namespace Mars.Core.App.Config;

public class Config
{
	public Config(Guid id, string name, string defaultNamespace)
	{
		if (id.Version != 7)
		{
			throw new UnprocessableException("App ID must be a UUIDv7.");
		}

		if (string.IsNullOrWhiteSpace(name))
		{
			throw new BadRequestException("App name is required.");
		}

		this.Id = id;
		this.Name = name;
		this.DefaultNamespace = ValidateName(defaultNamespace);
	}

	public Guid Id { get; }
	public string Name { get; }
	public string DefaultNamespace { get; }

	public static string FromAppName(string appName)
	{
		var normalizedName = appName.Trim().ToLowerInvariant();
		var separatedWords = Regex.Replace(normalizedName, "[^a-z0-9]+", "-");
		var defaultNamespace = separatedWords.Trim('-');

		return ValidateName(defaultNamespace);
	}

	public static string ValidateName(string value)
	{
		var isEmpty = string.IsNullOrWhiteSpace(value);
		var hasValidFormat = Regex.IsMatch(value, "^[a-z][a-z0-9-]*$");
		if (isEmpty || !hasValidFormat)
		{
			throw new BadRequestException("Name must start with a lowercase letter and contain only lowercase letters, digits, or hyphens.");
		}

		return value;
	}
}
