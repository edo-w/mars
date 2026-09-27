using System.Text;
using System.Text.Json;
using System.Security.Cryptography;
using Mars.Core.App.Environment;
using Mars.Core.App.Kv;
using Mars.Core.App.Lock;
using Mars.Core.App.Config;
using Mars.Core.App.Node;
using Mars.Core.App.Secrets;
using Mars.Core.Lib;
using Mars.Local.App.LocalEnvironment;
using Mars.Local.App.LocalKv;
using Mars.Local.App.LocalLock;
using Mars.Local.App.LocalNode;
using Mars.Local.App.LocalSecrets;
using Mars.Local.Lib;
using Mars.Local.Db;
using Moq;
using NUnit.Framework;
using Assert = NUnit.Framework.Legacy.ClassicAssert;
using Environment = Mars.Core.App.Environment.Environment;
using Config = Mars.Core.App.Config.Config;

namespace Mars.Local.Tests.Integration;

public class LocalIntegrationTests
{
	[Test]
	public async Task NodePropertiesTagsAndEventsKeepTheirValues()
	{
		var state = await CreateEnvironmentAsync();
		var createDate = new DateTimeOffset(2026, 1, 1, 0, 0, 0, TimeSpan.Zero);
		var now = createDate;
		var timer = new Mock<IVTimer>();
		timer.SetupGet(item => item.UtcNow).Returns(() => now);
		var nodeRepo = new LocalNodeRepo(state.Database, timer.Object);
		var nodes = new LocalNodeService(nodeRepo, timer.Object);
		var first = await nodes.CreateAsync(state.Environment.Id, "web-1", "127.0.0.1");
		var second = await nodes.CreateAsync(state.Environment.Id, "web-2", "127.0.0.2");
		now = now.AddHours(1);
		using (var connection = state.Database.Open())
		{
			using var command = connection.CreateCommand();
			command.CommandText = """
                UPDATE node
                SET hostname = $Hostname,
                    private_ip = $PrivateIp
                WHERE id = $Id;

                INSERT INTO node_property (node_id, key, value_json)
                VALUES ($Id, 'status', '"stale"');
                """;
			command.Parameters.AddWithValue("$Id", first.Id.ToString());
			command.Parameters.AddWithValue("$Hostname", "web.example");
			command.Parameters.AddWithValue("$PrivateIp", "10.0.0.1");
			command.ExecuteNonQuery();
		}

		await nodes.SetPropertyAsync(state.Environment.Id, first.Id, "ssh.port", "22");
		await nodes.SetPropertyAsync(state.Environment.Id, first.Id, "docker.installed", "true");
		await nodes.AddTagAsync(state.Environment.Id, first.Id, "DB_PRIMARY");
		await nodes.AddTagAsync(state.Environment.Id, second.Id, "staging");
		await nodes.SetStatusAsync(state.Environment.Id, first.Id, "ready");

		var filtered = await nodes.ListAsync(state.Environment.Id, ["missing", "DB_PRIMARY"]);
		var found = await nodes.GetAsync(state.Environment.Id, first.Id);
		var port = await nodes.GetPropertyAsync(state.Environment.Id, first.Id, "ssh.port");
		var idProperty = await nodes.GetPropertyAsync(state.Environment.Id, first.Id, "id");
		var nameProperty = await nodes.GetPropertyAsync(state.Environment.Id, first.Id, "name");
		var statusProperty = await nodes.GetPropertyAsync(state.Environment.Id, first.Id, "status");
		var publicIpProperty = await nodes.GetPropertyAsync(state.Environment.Id, first.Id, "public_ip");
		var hostname = await nodes.GetPropertyAsync(state.Environment.Id, first.Id, "hostname");
		var privateIp = await nodes.GetPropertyAsync(state.Environment.Id, first.Id, "private_ip");
		var unsetHostname = await nodes.GetPropertyAsync(state.Environment.Id, second.Id, "hostname");
		var events = await nodes.ListEventsAsync(state.Environment.Id, first.Id);
		var propertyEvent = events.Single(item => item.Action == "set-property" && item.Context.Contains("ssh.port", StringComparison.Ordinal));
		var statusEvent = events.Single(item => item.Action == "set-status");
		using var propertyContext = JsonDocument.Parse(propertyEvent.Context);
		using var statusContext = JsonDocument.Parse(statusEvent.Context);

		Assert.AreEqual(1, filtered.Count);
		Assert.AreEqual(first.Id, filtered[0].Id);
		Assert.AreEqual("db_primary", found!.Tags.Single());
		Assert.AreEqual("web.example", found.Hostname);
		Assert.AreEqual("10.0.0.1", found.PrivateIp);
		Assert.IsFalse(found.Properties.ContainsKey("status"));
		Assert.AreEqual(JsonValueKind.Number, found.Properties["ssh.port"].ValueKind);
		Assert.AreEqual(22, port!.Value.GetInt32());
		Assert.AreEqual(first.Id.ToString(), idProperty!.Value.GetString());
		Assert.AreEqual("web-1", nameProperty!.Value.GetString());
		Assert.AreEqual("ready", statusProperty!.Value.GetString());
		Assert.AreEqual("127.0.0.1", publicIpProperty!.Value.GetString());
		Assert.AreEqual("web.example", hostname!.Value.GetString());
		Assert.AreEqual("10.0.0.1", privateIp!.Value.GetString());
		Assert.AreEqual(JsonValueKind.Null, unsetHostname!.Value.ValueKind);
		Assert.AreEqual(JsonValueKind.True, found.Properties["docker.installed"].ValueKind);
		Assert.AreEqual(createDate, found.CreateDate);
		Assert.AreEqual(now, found.UpdateDate);
		Assert.AreEqual(22, propertyContext.RootElement.GetProperty("items").GetProperty("ssh.port").GetInt32());
		Assert.AreEqual("new", statusContext.RootElement.GetProperty("prev").GetString());
		Assert.AreEqual("ready", statusContext.RootElement.GetProperty("new").GetString());

		Assert.ThrowsAsync<BadRequestException>(async () => await nodes.SetStatusAsync(state.Environment.Id, first.Id, "unknown"));
		string[] builtInProperties = ["id", "name", "status", "hostname", "private_ip", "public_ip"];
		foreach (var key in builtInProperties)
		{
			Assert.ThrowsAsync<UnprocessableException>(async () =>
				await nodes.SetPropertyAsync(state.Environment.Id, first.Id, key, "changed"));
			Assert.ThrowsAsync<UnprocessableException>(async () =>
				await nodes.RemovePropertyAsync(state.Environment.Id, first.Id, key));
		}
		Assert.ThrowsAsync<ConflictException>(async () => await nodes.CreateAsync(state.Environment.Id, "web-3", "127.0.0.1"));

		var foundByName = await nodes.ResolveAsync(state.Environment.Id, "web-1");
		var foundById = await nodes.ResolveAsync(state.Environment.Id, first.Id.ToString());

		Assert.AreEqual(first.Id, foundByName.Id);
		Assert.AreEqual(first.Id, foundById.Id);
		Assert.ThrowsAsync<NotFoundException>(async () =>
			await nodes.ResolveAsync(state.Environment.Id, "missing"));
	}

	[Test]
	public async Task EnvironmentConfigAndSelectionPersistPerCheckout()
	{
		var directory = TestDirectory();
		var vfs = new LocalVfs();
		var configService = new ConfigService(vfs);
		var config = await configService.InitAsync(directory, "My App", "team");
		var yaml = await File.ReadAllTextAsync(Path.Combine(directory, "mars.yml"));
		var loaded = await configService.FindAsync(directory);
		var marsHome = Path.Combine(directory, ".mars");
		var database = new DbSession(config, marsHome, vfs);
		database.Initialize();
		var environments = new LocalEnvironmentService(config, new LocalEnvironmentRepo(database),
			new LocalEnvironmentSelectionStore(directory, vfs));

		var created = await environments.CreateAsync("dev");
		await environments.SetPropertyAsync(created.FullName, "aws_account_id", "123");
		await environments.SelectAsync(created.FullName);
		var reopenedSession = new DbSession(loaded.Config, marsHome, vfs);
		reopenedSession.Initialize();
		var reopened = new LocalEnvironmentService(loaded.Config, new LocalEnvironmentRepo(reopenedSession),
			new LocalEnvironmentSelectionStore(directory, vfs));
		var selected = await reopened.GetSelectedAsync();

		Assert.AreEqual(7, config.Id.Version);
		Assert.IsTrue(yaml.StartsWith($"mars_id: {config.Id}", StringComparison.Ordinal));
		Assert.IsFalse(yaml.Contains("\n...", StringComparison.Ordinal));
		Assert.IsTrue(yaml.TrimEnd().EndsWith("namespace: team", StringComparison.Ordinal));
		Assert.AreEqual(config.Id, loaded.Config.Id);
		Assert.AreEqual("team/dev", created.FullName);
		Assert.AreEqual(created.Id, selected?.Id);
		Assert.AreEqual("123", selected?.Properties["aws_account_id"]);
		Assert.IsTrue(database.DatabasePath.EndsWith(Path.Combine(".mars", "app", config.Id.ToString(), "state.db"),
			StringComparison.Ordinal));
		Assert.IsTrue(File.Exists(Path.Combine(directory, ".mars", "selected-environment")));

		var selectedByName = await reopened.SelectAsync("dev");
		Assert.AreEqual("team/dev", selectedByName.FullName);
		Assert.AreEqual("team/dev", (await reopened.GetSelectedAsync())?.FullName);

		Assert.ThrowsAsync<ConflictException>(async () =>
			await reopened.CreateAsync("dev"));

		await reopened.CreateAsync("dev", "other");
		var ambiguousName = Assert.ThrowsAsync<ConflictException>(async () =>
			await reopened.SelectAsync("dev"));
		Assert.IsTrue(ambiguousName!.Message.Contains("namespace/name", StringComparison.Ordinal));
		Assert.AreEqual("other/dev, team/dev", ambiguousName.Data["matches"]);
		Assert.AreEqual("team/dev", (await reopened.GetSelectedAsync())?.FullName);

		var selectedByFullName = await reopened.SelectAsync("other/dev");
		Assert.AreEqual("other/dev", selectedByFullName.FullName);
		Assert.AreEqual("other/dev", (await reopened.GetSelectedAsync())?.FullName);

		Assert.ThrowsAsync<NotFoundException>(async () => await reopened.SelectAsync("missing"));
	}

	[Test]
	public async Task SelectionsAreIsolatedBetweenCheckoutsOfTheSameApp()
	{
		var root = TestDirectory();
		var firstCheckout = Path.Combine(root, "first");
		var secondCheckout = Path.Combine(root, "second");
		Directory.CreateDirectory(firstCheckout);
		Directory.CreateDirectory(secondCheckout);
		var vfs = new LocalVfs();
		var configService = new ConfigService(vfs);
		var config = await configService.InitAsync(firstCheckout, "My App", "team");
		File.Copy(Path.Combine(firstCheckout, "mars.yml"), Path.Combine(secondCheckout, "mars.yml"));
		var marsHome = Path.Combine(root, ".mars");
		var database = new DbSession(config, marsHome, vfs);
		database.Initialize();
		var repo = new LocalEnvironmentRepo(database);
		var firstSelection = new LocalEnvironmentSelectionStore(firstCheckout, vfs);
		var secondSelection = new LocalEnvironmentSelectionStore(secondCheckout, vfs);
		var first = new LocalEnvironmentService(config, repo, firstSelection);
		var second = new LocalEnvironmentService(config, repo, secondSelection);
		await first.CreateAsync("dev");
		await first.CreateAsync("prod");

		await first.SelectAsync("team/dev");
		await second.SelectAsync("team/prod");

		Assert.AreEqual("team/dev", (await first.GetSelectedAsync())?.FullName);
		Assert.AreEqual("team/prod", (await second.GetSelectedAsync())?.FullName);
		Assert.AreEqual("team/prod", (await first.ResolveAsync("team/prod")).FullName);
		Assert.AreEqual("team/dev", (await first.GetSelectedAsync())?.FullName);
		using var connection = database.Open();
		using var command = connection.CreateCommand();
		command.CommandText = "SELECT count(*) FROM sqlite_master WHERE name='app_state'";
		Assert.AreEqual(0L, command.ExecuteScalar());
	}

	[Test]
	public async Task KvStoresFileVersionsOutsideSqliteAndRemovesTheirObjects()
	{
		var state = await CreateEnvironmentAsync();
		var vfs = new LocalVfs();
		var timer = new LocalVTimer();
		var environmentRepo = new LocalEnvironmentRepo(state.Database);
		var secretsRepo = new LocalSecretsRepo(state.Database);
		var passwordSource = new FixedPassword("test");
		using var secrets = new LocalSecretsService(secretsRepo, environmentRepo, passwordSource);
		var objects = new LocalKvObjectStore(state.Database, vfs);
		var kvRepo = new LocalKvRepo(state.Database);
		var kv = new LocalKvService(kvRepo, secrets, timer, objects);
		var firstBytes = Encoding.UTF8.GetBytes("first file");
		var secondBytes = Encoding.UTF8.GetBytes("second file");
		var largeBytes = new byte[KvLimits.MaxInlineValueBytes + 1];
		RandomNumberGenerator.Fill(largeBytes);

		var first = await kv.SetAsync(state.Environment.Id, "/file", firstBytes, "file", true);
		var second = await kv.SetAsync(state.Environment.Id, "/file", secondBytes, "file", true);
		var large = await kv.SetAsync(state.Environment.Id, "/large", largeBytes, "text", false);
		var small = await kv.SetAsync(state.Environment.Id, "/small", firstBytes, "text", false);

		var firstPath = Path.Combine(state.Database.AppDirectory, "env", state.Environment.Id.ToString(),
			"kv", $"{first.Id}_1");
		var secondPath = Path.Combine(state.Database.AppDirectory, "env", state.Environment.Id.ToString(),
			"kv", $"{second.Id}_2");
		var largePath = Path.Combine(state.Database.AppDirectory, "env", state.Environment.Id.ToString(),
			"kv", $"{large.Id}_1");
		var smallPath = Path.Combine(state.Database.AppDirectory, "env", state.Environment.Id.ToString(),
			"kv", $"{small.Id}_1");
		using var connection = state.Database.Open();
		using var command = connection.CreateCommand();
		command.CommandText = "SELECT count(*) FROM kv WHERE value IS NULL";
		var externalCount = (long)command.ExecuteScalar()!;
		var storedFirstBytes = await File.ReadAllBytesAsync(firstPath);
		var storedLargeBytes = await File.ReadAllBytesAsync(largePath);
		var retrievedFirst = await kv.GetAsync(state.Environment.Id, "/file", 1);
		var retrievedLarge = await kv.GetAsync(state.Environment.Id, "/large");
		var fileSummary = await kv.GetSummaryAsync(state.Environment.Id, "/file");
		var retrievedSmall = await kv.GetAsync(state.Environment.Id, "/small");

		Assert.AreEqual(7, first.Id.Version);
		Assert.AreEqual(7, second.Id.Version);
		Assert.AreNotEqual(first.Id, second.Id);
		Assert.AreEqual(1, first.Version);
		Assert.AreEqual(2, second.Version);
		Assert.AreEqual(3L, externalCount);
		Assert.IsTrue(File.Exists(firstPath));
		Assert.IsTrue(File.Exists(secondPath));
		Assert.IsTrue(File.Exists(largePath));
		Assert.IsFalse(File.Exists(smallPath));
		Assert.IsFalse(storedFirstBytes.AsSpan().SequenceEqual(firstBytes));
		Assert.IsTrue(storedLargeBytes.AsSpan().SequenceEqual(largeBytes));
		Assert.IsTrue(retrievedFirst!.Value.AsSpan().SequenceEqual(firstBytes));
		Assert.IsTrue(retrievedLarge!.Value.AsSpan().SequenceEqual(largeBytes));
		Assert.AreEqual(second.Id, fileSummary!.Id);
		Assert.AreEqual(small.Id, retrievedSmall!.Id);

		var deleted = await kv.DeleteAsync(state.Environment.Id, "/file");
		var removed = await kv.GetAsync(state.Environment.Id, "/file");

		Assert.IsTrue(deleted);
		Assert.IsFalse(File.Exists(firstPath));
		Assert.IsFalse(File.Exists(secondPath));
		Assert.IsTrue(File.Exists(largePath));
		Assert.IsNull(removed);
	}

	[Test]
	public async Task SecretKvIsEncryptedAndWrongPasswordFails()
	{
		var state = await CreateEnvironmentAsync();
		var vfs = new LocalVfs();
		var timer = new LocalVTimer();
		var database = state.Database;
		var environment = state.Environment;
		var environmentRepo = new LocalEnvironmentRepo(database);
		var secretsRepo = new LocalSecretsRepo(database);
		var passwordSource = new FixedPassword("correct");
		using var secrets = new LocalSecretsService(secretsRepo, environmentRepo, passwordSource);
		var kvRepo = new LocalKvRepo(database);
		var objects = new LocalKvObjectStore(database, vfs);
		var kv = new LocalKvService(kvRepo, secrets, timer, objects);

		await kv.SetAsync(environment.Id, "/api/token", Encoding.UTF8.GetBytes("hidden-value"), "text", true);
		Assert.AreEqual("dev", passwordSource.LastEnvironmentName);

		var latest = await kv.GetAsync(environment.Id, "/api/token");
		var wrongPasswordSource = new FixedPassword("incorrect");
		using var wrongSecrets = new LocalSecretsService(secretsRepo, environmentRepo, wrongPasswordSource);
		var wrongKv = new LocalKvService(kvRepo, wrongSecrets, timer, objects);
		var summary = await wrongKv.GetSummaryAsync(environment.Id, "/api/token");

		Assert.AreEqual("hidden-value", Encoding.UTF8.GetString(latest!.Value));
		Assert.IsNotNull(summary);
		Assert.IsTrue(summary!.IsSecret);
		Assert.AreEqual(12, summary.Size);
		using var connection = database.Open();
		using var command = connection.CreateCommand();
		command.CommandText = "SELECT value FROM kv";
		var stored = (byte[])command.ExecuteScalar()!;
		Assert.IsFalse(stored.AsSpan().SequenceEqual(Encoding.UTF8.GetBytes("hidden-value")));
		Assert.ThrowsAsync<UnprocessableException>(async () => await wrongKv.GetAsync(environment.Id, "/api/token"));
	}

	[Test]
	public async Task KvVersionsNodesAndLeasesSurviveReopening()
	{
		var state = await CreateEnvironmentAsync();
		var vfs = new LocalVfs();
		var timer = new LocalVTimer();
		var database = state.Database;
		var environment = state.Environment;
		var environmentRepo = new LocalEnvironmentRepo(database);
		var secretsRepo = new LocalSecretsRepo(database);
		var passwordSource = new FixedPassword("test");
		using var secrets = new LocalSecretsService(secretsRepo, environmentRepo, passwordSource);
		var kvRepo = new LocalKvRepo(database);
		var objects = new LocalKvObjectStore(database, vfs);
		var kv = new LocalKvService(kvRepo, secrets, timer, objects);
		var nodeRepo = new LocalNodeRepo(database, timer);
		var nodes = new LocalNodeService(nodeRepo, timer);
		var locks = new LocalLockService(new LocalLockRepo(database), timer);

		var firstValue = await kv.SetAsync(environment.Id, "/service/name", Encoding.UTF8.GetBytes("first"), "text", false);
		var secondValue = await kv.SetAsync(environment.Id, "/service/name", Encoding.UTF8.GetBytes("second"), "text", false);
		var node = await nodes.CreateAsync(environment.Id, "web-1", "127.0.0.1");
		await nodes.SetPropertyAsync(environment.Id, node.Id, "role", "web");
		await nodes.AddTagAsync(environment.Id, node.Id, "production");
		var lease = await locks.AcquireAsync(environment.Id, "deploy", "one", TimeSpan.FromMinutes(1));

		Assert.AreEqual("first", Encoding.UTF8.GetString((await kv.GetAsync(environment.Id, "/service/name", 1))!.Value));
		var versionReference = await kv.GetAsync(environment.Id, "/service/name#1");
		var summary = await kv.GetSummaryAsync(environment.Id, "/service/name");
		Assert.AreEqual("first", Encoding.UTF8.GetString(versionReference!.Value));
		Assert.AreEqual(firstValue.CreateDate, summary!.CreateDate);
		Assert.AreEqual(secondValue.CreateDate, summary.UpdateDate);
		Assert.AreEqual(2, (await kv.GetAsync(environment.Id, "/service/name"))!.Version);
		Assert.AreEqual("web", (await nodes.GetAsync(environment.Id, node.Id))!.Properties["role"].GetString());
		var events = await nodes.ListEventsAsync(environment.Id, node.Id);
		Assert.AreEqual(3, events.Count);
		Assert.IsTrue(events.All(item => item.Id.Version == 7));
		Assert.AreEqual(events.Count, events.Select(item => item.Id).Distinct().Count());

		using (var connection = database.Open())
		using (var command = connection.CreateCommand())
		{
			command.CommandText = "SELECT id FROM lease WHERE environment_id=$environment AND name=$name";
			command.Parameters.AddWithValue("$environment", environment.Id.ToString());
			command.Parameters.AddWithValue("$name", "deploy");

			var leaseIdText = (string)command.ExecuteScalar()!;
			var leaseId = Guid.Parse(leaseIdText);
			Assert.AreEqual(7, leaseId.Version);
		}

		Assert.IsNull(await locks.AcquireAsync(environment.Id, "deploy", "two", TimeSpan.FromMinutes(1)));
		Assert.IsTrue(await locks.ReleaseAsync(lease!));
		Assert.IsNotNull(await locks.AcquireAsync(environment.Id, "deploy", "two", TimeSpan.FromMinutes(1)));
	}

	[Test]
	public async Task SecretCiphertextTamperingIsRejectedAndEnvironmentsAreIsolated()
	{
		var state = await CreateEnvironmentAsync();
		var vfs = new LocalVfs();
		var timer = new LocalVTimer();
		var database = state.Database;
		var environment = state.Environment;
		var config = state.Config;
		var environmentRepo = new LocalEnvironmentRepo(database);
		var secretsRepo = new LocalSecretsRepo(database);
		var passwordSource = new FixedPassword("test");
		using var secrets = new LocalSecretsService(secretsRepo, environmentRepo, passwordSource);
		var kvRepo = new LocalKvRepo(database);
		var objects = new LocalKvObjectStore(database, vfs);
		var kv = new LocalKvService(kvRepo, secrets, timer, objects);
		var selectionRoot = Path.GetDirectoryName(database.AppDirectory)!;
		var selection = new LocalEnvironmentSelectionStore(selectionRoot, vfs);
		var otherRepo = new LocalEnvironmentRepo(database);
		var otherService = new LocalEnvironmentService(config, otherRepo, selection);
		var other = await otherService.CreateAsync("other");

		await kv.SetAsync(environment.Id, "/api/token", Encoding.UTF8.GetBytes("secret"), "text", true);
		Assert.IsNull(await kv.GetAsync(other.Id, "/api/token"));
		using (var connection = database.Open())
		using (var command = connection.CreateCommand())
		{
			command.CommandText = "UPDATE kv SET value=X'00' WHERE environment_id=$environment";
			command.Parameters.AddWithValue("$environment", environment.Id.ToString());
			command.ExecuteNonQuery();
		}

		Assert.ThrowsAsync<AuthenticationTagMismatchException>(async () =>
			await kv.GetAsync(environment.Id, "/api/token"));
	}

	private static async Task<TestEnvironmentContext> CreateEnvironmentAsync()
	{
		var directory = TestDirectory();
		var vfs = new LocalVfs();
		var configService = new ConfigService(vfs);
		var config = await configService.InitAsync(directory, "Tests", "app");
		var marsHome = Path.Combine(directory, ".mars");
		var database = new DbSession(config, marsHome, vfs);
		database.Initialize();
		var environmentRepo = new LocalEnvironmentRepo(database);
		var selection = new LocalEnvironmentSelectionStore(directory, vfs);
		var environments = new LocalEnvironmentService(config, environmentRepo, selection);
		var environment = await environments.CreateAsync("dev");
		var context = new TestEnvironmentContext(database, environment, config);

		return context;
	}

	private static string TestDirectory()
	{
		var directory = Path.Combine(
			TestContext.CurrentContext.WorkDirectory,
			"test-state",
			Guid.NewGuid().ToString("N")
		);
		Directory.CreateDirectory(directory);
		return directory;
	}

	private class FixedPassword : IPasswordSource
	{
		private readonly string value;
		public string? LastEnvironmentName { get; private set; }

		public FixedPassword(string value) => this.value = value;
		public string GetPassword(string environmentName)
		{
			this.LastEnvironmentName = environmentName;

			return this.value;
		}
	}

	public class TestEnvironmentContext
	{
		public TestEnvironmentContext(DbSession database, Environment environment, Config config)
		{
			this.Database = database;
			this.Environment = environment;
			this.Config = config;
		}

		public DbSession Database { get; }
		public Environment Environment { get; }
		public Config Config { get; }
	}
}
