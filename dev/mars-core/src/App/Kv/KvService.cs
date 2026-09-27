namespace Mars.Core.App.Kv;

public interface IKvService
{
	Task<KvEntry> SetAsync(Guid environmentId, string key, byte[] value, string type, bool isSecret);
	Task<KvEntry?> GetAsync(Guid environmentId, string key, int? version = null);
	Task<KvSummary?> GetSummaryAsync(Guid environmentId, string key);
	Task<IReadOnlyList<KvSummary>> ListAsync(Guid environmentId, string prefix = "/");
	Task<bool> DeleteAsync(Guid environmentId, string key);
}
