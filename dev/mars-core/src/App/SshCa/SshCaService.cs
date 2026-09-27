namespace Mars.Core.App.SshCa;

public interface ISshCaService
{
	Task<SshCaInfo> CreateAsync(Guid environmentId, string name);
	Task<IReadOnlyList<SshCaInfo>> ListAsync(Guid environmentId);
	Task<SshCaInfo?> GetAsync(Guid environmentId, string name);
	Task DeleteAsync(Guid environmentId, string name);
	Task<SshClientIdentity> IssueAsync(Guid environmentId, string name, string identity, string principals);
}
