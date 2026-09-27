namespace Mars.Core.App.Config;

public class ConfigLocation
{
	public ConfigLocation(string root, Config config)
	{
		this.Root = root;
		this.Config = config;
	}

	public string Root { get; }
	public Config Config { get; }
}
