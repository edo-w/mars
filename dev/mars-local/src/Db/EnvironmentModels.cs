namespace Mars.Local.Db;

public class EnvironmentModel
{
	public Guid Id { get; set; }
	public string Namespace { get; set; } = "";
	public string Name { get; set; } = "";
	public string PropertiesJson { get; set; } = "{}";
}
