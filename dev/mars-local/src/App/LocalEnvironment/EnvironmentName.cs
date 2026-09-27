namespace Mars.Local.App.LocalEnvironment;

public class EnvironmentName
{
	public EnvironmentName(string environmentNamespace, string name)
	{
		this.Namespace = environmentNamespace;
		this.Name = name;
	}

	public string Namespace { get; }
	public string Name { get; }
}
