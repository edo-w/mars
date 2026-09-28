import { WorkflowModule } from "../src/index";
import { StdioTransport } from "../src/stdio";

console.error(JSON.stringify({ level: "info", msg: "module starting" }));

const module = new WorkflowModule("fixture/math");
module.registerTask(
	"double",
	{ shape: [{ name: "value", type: "i32" }] },
	{ shape: [{ name: "result", type: "i32" }] },
	async (input, context) => {
		const value = (input as { value: number }).value;
		context.log({ level: "info", msg: "doubling", value });
		await context.progress({ message: "doubling", percent: 50 });

		return { result: value * 2 };
	},
);

module.registerShape("WireValues", [
	{ name: "text", type: "string" },
	{ name: "enabled", type: "bool" },
	{ name: "count", type: "i32" },
	{ name: "ratio", type: "f32" },
	{ name: "when", type: "datetime" },
	{ name: "delay", type: "duration" },
	{ name: "location", type: "path" },
	{ name: "website", type: "url" },
	{ name: "labels", type: { list: "string" } },
	{ name: "note", type: { optional: "string" } },
]);
module.registerTask(
	"roundtrip",
	{ ref: "fixture/math/WireValues" },
	{ ref: "fixture/math/WireValues" },
	async (input) => input,
);
module.registerTask("noop", "void", "void", async () => undefined);
module.registerFunction(
	"describeValue",
	{ shape: [{ name: "value", type: "i32" }] },
	"string",
	async (input, context) => {
		const value = (input as { value: number }).value;
		context.log({ level: "info", msg: "describing", value });
		await context.progress({ message: "describing", percent: 100 });

		return `value-${value}`;
	},
);

await module.serve(new StdioTransport());
