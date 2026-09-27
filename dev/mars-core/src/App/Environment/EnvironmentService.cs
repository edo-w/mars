namespace Mars.Core.App.Environment;

public interface IEnvironmentService
{
	Task<Environment> CreateAsync(string name, string? environmentNamespace = null);
	Task<IReadOnlyList<Environment>> ListAsync();
	Task<Environment?> GetAsync(string fullName);
	Task<Environment> ResolveAsync(string? fullName = null);
	Task<Environment> SelectAsync(string name);
	Task<Environment?> GetSelectedAsync();
	Task DeleteAsync(string fullName);
	Task SetPropertyAsync(string fullName, string key, string value);
	Task RemovePropertyAsync(string fullName, string key);
}
