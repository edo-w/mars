using System.Text.Json.Nodes;
using Mars.Workflow.App.Modules;
using Mars.Workflow.App.Types;
using NUnit.Framework;
using Assert = NUnit.Framework.Legacy.ClassicAssert;

namespace Mars.Workflow.Tests.App.Modules;

public class ModuleMetadataReaderTests
{
	[Test]
	public void ResolvesForwardShapeReference()
	{
		var json = """
			{
			  "module": "example/tools",
			  "exports": [
			    {"kind":"shape","name":"Outer","fields":[
			      {"name":"inner","type":{"ref":"example/tools/Inner"}}
			    ]},
			    {"kind":"shape","name":"Inner","fields":[
			      {"name":"value","type":"string"}
			    ]}
			  ]
			}
			""";
		var metadata = JsonNode.Parse(json);
		var reader = new ModuleMetadataReader();

		var module = reader.Read(metadata);
		var outer = module.Exports[0].Output!;
		var inner = outer.Fields[0].Type;

		Assert.AreEqual(WorkflowTypeKind.Shape, inner.Kind);
		Assert.AreEqual(WorkflowTypeKind.Text, inner.Fields[0].Type.Kind);
	}

	[Test]
	public void RejectsRecursiveShape()
	{
		var json = """
			{
			  "module": "example/tools",
			  "exports": [
			    {"kind":"shape","name":"Loop","fields":[
			      {"name":"next","type":{"ref":"example/tools/Loop"}}
			    ]}
			  ]
			}
			""";
		var metadata = JsonNode.Parse(json);
		var reader = new ModuleMetadataReader();

		Assert.Throws<FormatException>(() => reader.Read(metadata));
	}

	[Test]
	public void ResolvesShapeReferenceAcrossModules()
	{
		var firstSource = """
			{
			  "module":"example/first",
			  "exports":[{"kind":"shape","name":"Outer","fields":[
			    {"name":"inner","type":{"ref":"example/second/Inner"}}
			  ]}]
			}
			""";
		var secondSource = """
			{
			  "module":"example/second",
			  "exports":[{"kind":"shape","name":"Inner","fields":[
			    {"name":"value","type":"string"}
			  ]}]
			}
			""";

		var first = JsonNode.Parse(firstSource);
		var second = JsonNode.Parse(secondSource);
		var outputs = new Dictionary<string, JsonNode?>
		{
			["example/first"] = first,
			["example/second"] = second,
		};
		var reader = new ModuleMetadataReader();

		var modules = reader.ReadAll(outputs);
		var outer = modules["example/first"].Exports[0].Output!;
		var inner = outer.Fields[0].Type;

		Assert.AreEqual("example/second/Inner", inner.Name);
		Assert.AreEqual(WorkflowTypeKind.Text, inner.Fields[0].Type.Kind);
	}
}
