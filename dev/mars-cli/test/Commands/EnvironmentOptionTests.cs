using System.CommandLine;
using Mars.Cli.Boot;
using Microsoft.Extensions.DependencyInjection;
using NUnit.Framework;
using Assert = NUnit.Framework.Legacy.ClassicAssert;

namespace Mars.Cli.Tests.Commands;

public class EnvironmentOptionTests
{
	[Test]
	public void GlobalEnvOptionWorksBeforeAndAfterSubcommands()
	{
		using var container = new ServiceCollection().BuildServiceProvider();
		var root = CliCommands.Create(container);
		var environment = root.Options.OfType<Option<string>>().Single();

		var before = root.Parse(["--env", "team/prod", "kv", "list"]);
		var after = root.Parse(["kv", "list", "--env", "team/dev"]);
		var debug = root.Parse(["env", "ls", "--debug"]);

		Assert.IsEmpty(before.Errors);
		Assert.IsEmpty(after.Errors);
		Assert.IsEmpty(debug.Errors);
		Assert.AreEqual("team/prod", before.GetValue(environment));
		Assert.AreEqual("team/dev", after.GetValue(environment));
	}

	[Test]
	public void ExistingCommandNamesAndOptionalArgumentsStillParse()
	{
		using var container = new ServiceCollection().BuildServiceProvider();
		var root = CliCommands.Create(container);
		var nodeId = Guid.CreateVersion7().ToString();

		var kvList = root.Parse(["kv", "list", "/service"]);
		var kvRemove = root.Parse(["kv", "remove", "/service/name"]);
		var kvRm = root.Parse(["kv", "rm", "/service/name"]);
		var oldKvDelete = root.Parse(["kv", "delete", "/service/name"]);
		var nodeRemove = root.Parse(["node", "remove", nodeId]);
		var nodeStatus = root.Parse(["node", "set-status", nodeId, "ready"]);
		var propertyRemove = root.Parse(["node", "property", "rm", nodeId, "role"]);
		var propertyGet = root.Parse(["node", "property", "get", nodeId, "ssh.port"]);
		var taggedList = root.Parse(["node", "list", "--tag", "web,DB_PRIMARY"]);
		var defaultCaCreate = root.Parse(["sshca", "create"]);
		var defaultCaShow = root.Parse(["sshca", "show"]);
		var caRemove = root.Parse(["sshca", "remove", "main"]);
		var caRm = root.Parse(["sshca", "rm", "main"]);
		var oldCaDelete = root.Parse(["sshca", "delete", "main"]);

		Assert.IsEmpty(kvList.Errors);
		Assert.IsEmpty(kvRemove.Errors);
		Assert.IsEmpty(kvRm.Errors);
		Assert.IsNotEmpty(oldKvDelete.Errors);
		Assert.IsEmpty(nodeRemove.Errors);
		Assert.IsEmpty(nodeStatus.Errors);
		Assert.IsEmpty(propertyRemove.Errors);
		Assert.IsEmpty(propertyGet.Errors);
		Assert.IsEmpty(taggedList.Errors);
		Assert.IsEmpty(defaultCaCreate.Errors);
		Assert.IsEmpty(defaultCaShow.Errors);
		Assert.IsEmpty(caRemove.Errors);
		Assert.IsEmpty(caRm.Errors);
		Assert.IsNotEmpty(oldCaDelete.Errors);
	}

	[Test]
	public void ListCommandsAcceptLsAlias()
	{
		using var container = new ServiceCollection().BuildServiceProvider();
		var root = CliCommands.Create(container);

		var environmentList = root.Parse(["env", "ls"]);
		var kvList = root.Parse(["kv", "ls", "/service"]);
		var nodeList = root.Parse(["node", "ls", "--tag", "web,db_primary"]);
		var sshCaList = root.Parse(["sshca", "ls"]);

		Assert.IsEmpty(environmentList.Errors);
		Assert.IsEmpty(kvList.Errors);
		Assert.IsEmpty(nodeList.Errors);
		Assert.IsEmpty(sshCaList.Errors);
		Assert.AreEqual("list", environmentList.CommandResult.Command.Name);
		Assert.AreEqual("list", kvList.CommandResult.Command.Name);
		Assert.AreEqual("list", nodeList.CommandResult.Command.Name);
		Assert.AreEqual("list", sshCaList.CommandResult.Command.Name);
	}

	[Test]
	public void NodeCommandsAcceptNameOrIdAndEventIsSingular()
	{
		using var container = new ServiceCollection().BuildServiceProvider();
		var root = CliCommands.Create(container);
		var nodeId = Guid.CreateVersion7().ToString();

		var removeByName = root.Parse(["node", "remove", "web-1"]);
		var removeById = root.Parse(["node", "rm", nodeId]);
		var oldDelete = root.Parse(["node", "delete", nodeId]);
		var showByName = root.Parse(["node", "show", "web-1"]);
		var showById = root.Parse(["node", "show", nodeId]);
		var statusByName = root.Parse(["node", "status", "web-1", "ready"]);
		var statusById = root.Parse(["node", "set-status", nodeId, "ready"]);
		var eventCommand = root.Parse(["node", "event"]);

		Assert.IsEmpty(removeByName.Errors);
		Assert.IsEmpty(removeById.Errors);
		Assert.IsNotEmpty(oldDelete.Errors);
		Assert.IsEmpty(showByName.Errors);
		Assert.IsEmpty(showById.Errors);
		Assert.IsEmpty(statusByName.Errors);
		Assert.IsEmpty(statusById.Errors);
		Assert.IsEmpty(eventCommand.Errors);
		Assert.AreEqual("event", eventCommand.CommandResult.Command.Name);
	}

	[Test]
	public void NodePropertyAndTagCommandsAcceptNameOrId()
	{
		using var container = new ServiceCollection().BuildServiceProvider();
		var root = CliCommands.Create(container);
		var nodeId = Guid.CreateVersion7().ToString();
		var commands = new[]
		{
			new[] { "node", "property", "get", "web-1", "role" },
			new[] { "node", "property", "set", "web-1", "role", "api" },
			new[] { "node", "property", "remove", "web-1", "role" },
			new[] { "node", "tag", "add", "web-1", "web" },
			new[] { "node", "tag", "remove", "web-1", "web" },
			new[] { "node", "property", "get", nodeId, "role" },
			new[] { "node", "property", "set", nodeId, "role", "api" },
			new[] { "node", "property", "remove", nodeId, "role" },
			new[] { "node", "tag", "add", nodeId, "web" },
			new[] { "node", "tag", "remove", nodeId, "web" },
		};

		foreach (var arguments in commands)
		{
			var result = root.Parse(arguments);

			Assert.IsEmpty(result.Errors);
		}
	}

	[Test]
	public void InitAllowsDefaultNameAndNodeCreateAllowsOptionalIp()
	{
		using var container = new ServiceCollection().BuildServiceProvider();
		var root = CliCommands.Create(container);

		var defaultInit = root.Parse(["init"]);
		var namedInit = root.Parse(["init", "My App"]);
		var nodeCreate = root.Parse(["node", "create", "web-1", "--public-ip", "127.0.0.1"]);
		var kvShow = root.Parse(["kv", "show", "/token"]);
		var kvGetRaw = root.Parse(["kv", "get", "/token", "--raw"]);

		Assert.IsEmpty(defaultInit.Errors);
		Assert.IsEmpty(namedInit.Errors);
		Assert.IsEmpty(nodeCreate.Errors);
		Assert.IsEmpty(kvShow.Errors);
		Assert.IsEmpty(kvGetRaw.Errors);
	}
}
