# Mars workflow TypeScript SDK

Define a module, register its exported shapes and async operations, then serve
the Mars JSON-line protocol over standard input and output. Protocol messages
use stdout; module diagnostics use stderr.

```ts
import { WorkflowModule } from "@mars/workflow-sdk";
import { StdioTransport } from "@mars/workflow-sdk/stdio";

const module = new WorkflowModule("company/tools");
module.registerTask(
	"greet",
	{ shape: [{ name: "name", type: "string" }] },
	"string",
	async (input, context) => {
		const name = (input as { name: string }).name;
		await context.progress({ message: "Greeting" });
		return `Hello ${name}`;
	},
);

await module.serve(new StdioTransport());
```

Register functions with `registerFunction`, shapes with `registerShape`, and
workflow source references with `registerWorkflow`. A `void` input or output
omits the corresponding field from protocol messages. Task and function
handlers receive an `AbortSignal` and can send progress or log to stderr.

Run `bun run build`, `bun run check`, and `bun run test` in this directory to
validate the SDK. The build produces Node-compatible JavaScript in `dist/`.
