using System.Text.RegularExpressions;
using System.Globalization;
using Mars.Core.App.Kv;
using Mars.Core.App.Config;
using Mars.Core.App.Secrets;
using Mars.Core.Lib;
using Mars.Local.Db;

namespace Mars.Local.App.LocalKv;

public class LocalKvService : IKvService
{
	private static readonly Regex KeyPattern = new(
		"^/(?:[A-Za-z0-9_-]+)(?:/[A-Za-z0-9_-]+)*$",
		RegexOptions.Compiled | RegexOptions.CultureInvariant
	);

	private readonly LocalKvRepo repo;
	private readonly ISecretsService secrets;
	private readonly IVTimer timer;
	private readonly LocalKvObjectStore objects;

	public LocalKvService(
		LocalKvRepo repo,
		ISecretsService secrets,
		IVTimer timer,
		LocalKvObjectStore objects
	)
	{
		this.repo = repo;
		this.secrets = secrets;
		this.timer = timer;
		this.objects = objects;
	}

	public async Task<KvEntry> SetAsync(Guid environmentId, string key, byte[] value, string type, bool isSecret)
	{
		ValidateKey(key);

		if (type is not ("text" or "file"))
		{
			throw new BadRequestException("KV type must be 'text' or 'file'.");
		}

		EncryptedValue? encrypted = null;
		if (isSecret)
		{
			encrypted = await this.secrets.EncryptAsync(environmentId, value);
		}

		var storedValue = encrypted?.Ciphertext ?? value;
		var external = type == "file" || value.Length > KvLimits.MaxInlineValueBytes;

		var model = new KvModel
		{
			Id = Guid.CreateVersion7(),
			EnvironmentId = environmentId,
			KeyPath = key,
			Type = type,
			IsSecret = isSecret,
			Value = external ? null : storedValue,
			Size = value.LongLength,
			Nonce = encrypted?.Nonce,
			Tag = encrypted?.Tag,
			CreateDate = this.timer.UtcNow.ToString("O"),
		};

		Action<KvModel>? persistObject = null;
		if (external)
		{
			persistObject = item => this.objects.Write(item, storedValue);
		}

		try
		{
			this.repo.InsertVersion(model, persistObject);
		}
		catch
		{
			if (external)
			{
				this.objects.Delete(model);
			}

			throw;
		}

		var createDate = DateTimeOffset.Parse(model.CreateDate, CultureInfo.InvariantCulture);
		var entry = new KvEntry(model.Id, key, model.Version, type, isSecret, value, createDate);

		return entry;
	}

	public async Task<KvEntry?> GetAsync(Guid environmentId, string key, int? version = null)
	{
		var marker = key.LastIndexOf('#');
		if (marker >= 0)
		{
			if (version is not null)
			{
				throw new BadRequestException("Specify a KV version either in the key or with --version.");
			}

			var versionText = key[(marker + 1)..];
			var parsed = int.TryParse(
				versionText,
				NumberStyles.None,
				CultureInfo.InvariantCulture,
				out var parsedVersion
			);
			if (!parsed || parsedVersion < 1)
			{
				throw new BadRequestException($"Invalid KV version suffix in '{key}'.");
			}

			key = key[..marker];
			version = parsedVersion;
		}

		ValidateKey(key);

		var model = this.repo.Get(environmentId, key, version);

		if (model is null)
		{
			return null;
		}

		byte[] storedValue;
		if (model.Value is null)
		{
			storedValue = await this.objects.ReadAsync(model);
		}
		else
		{
			storedValue = model.Value;
		}

		byte[] value;
		if (model.IsSecret)
		{
			var encrypted = new EncryptedValue(model.Nonce!, storedValue, model.Tag!);
			value = await this.secrets.DecryptAsync(environmentId, encrypted);
		}
		else
		{
			value = storedValue;
		}

		var createDate = DateTimeOffset.Parse(model.CreateDate, CultureInfo.InvariantCulture);
		var entry = new KvEntry(model.Id, key, model.Version, model.Type, model.IsSecret, value, createDate);

		return entry;
	}

	public Task<IReadOnlyList<KvSummary>> ListAsync(Guid environmentId, string prefix = "/")
	{
		if (prefix != "/")
		{
			ValidateKey(prefix);
		}

		var models = this.repo.List(environmentId, prefix);
		var summaries = new List<KvSummary>(models.Count);

		foreach (var model in models)
		{
			var summary = ToSummary(model);
			summaries.Add(summary);
		}

		return Task.FromResult<IReadOnlyList<KvSummary>>(summaries);
	}

	public Task<KvSummary?> GetSummaryAsync(Guid environmentId, string key)
	{
		ValidateKey(key);

		var model = this.repo.GetSummary(environmentId, key);
		if (model is null)
		{
			return Task.FromResult<KvSummary?>(null);
		}

		var summary = ToSummary(model);

		return Task.FromResult<KvSummary?>(summary);
	}

	public Task<bool> DeleteAsync(Guid environmentId, string key)
	{
		ValidateKey(key);

		var versions = this.repo.Delete(environmentId, key);
		foreach (var version in versions)
		{
			if (version.Value is null)
			{
				this.objects.Delete(version);
			}
		}

		var deleted = versions.Count > 0;

		return Task.FromResult(deleted);
	}

	private static void ValidateKey(string key)
	{
		if (!KeyPattern.IsMatch(key))
		{
			throw new BadRequestException($"KV key '{key}' must be a path such as /service/name.");
		}
	}

	private static KvSummary ToSummary(KvSummaryViewModel model)
	{
		var createDate = DateTimeOffset.Parse(model.CreateDate, CultureInfo.InvariantCulture);
		var updateDate = DateTimeOffset.Parse(model.UpdateDate, CultureInfo.InvariantCulture);
		var summary = new KvSummary(
			model.Id,
			model.KeyPath,
			model.Version,
			model.Type,
			model.IsSecret,
			model.Size,
			createDate,
			updateDate
		);

		return summary;
	}
}
