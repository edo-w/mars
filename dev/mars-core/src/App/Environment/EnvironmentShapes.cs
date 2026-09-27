namespace Mars.Core.App.Environment;

public class Environment
{
	public Environment(Guid id, string name, string environmentNamespace, IReadOnlyDictionary<string, string> properties)
	{
		this.Id = id;
		this.Name = name;
		this.Namespace = environmentNamespace;
		this.Properties = properties;
	}

	public Guid Id { get; }
	public string Name { get; }
	public string Namespace { get; }
	public string FullName => $"{this.Namespace}/{this.Name}";
	public IReadOnlyDictionary<string, string> Properties { get; }
}
