import { describe, expect, test } from "bun:test";
import { WorkflowModule, validate, type LineTransport } from "../src/index";
import { protocolErrorCodes } from "../src/protocol-errors";

class MemoryTransport implements LineTransport {
	readonly input: string[] = [];
	readonly output: Record<string, unknown>[] = [];
	readonly errors: string[] = [];

	async *read(): AsyncIterable<string> {
		for (const line of this.input) {
			yield line;
		}
	}

	async write(line: string): Promise<void> {
		this.output.push(JSON.parse(line) as Record<string, unknown>);
	}

	log(line: string): void {
		this.errors.push(line);
	}
}

describe("WorkflowModule", () => {
	test("shares protocol error codes with the host fixture", () => {
		expect(protocolErrorCodes.message_after_return).toBe("WFPROTO003");
	});
	test("describes a module through the shared return envelope", async () => {
		const module = new WorkflowModule("example/tools");
		module.registerShape("Input", [{ name: "value", type: "string" }]);
		module.registerTask("echo", { ref: "example/tools/Input" }, "string", async (input) => {
			return (input as { value: string }).value;
		});
		const transport = new MemoryTransport();
		transport.input.push(JSON.stringify({ v: 1, id: "d1", type: "describe" }));

		await module.serve(transport);

		expect(transport.output[0]).toEqual({
			v: 1,
			id: "d1",
			type: "ret",
			status: "ok",
			output: module.describe(),
		});
	});

	test("omits void input and output and reports progress", async () => {
		const module = new WorkflowModule("example/tools");
		module.registerTask("tick", "void", "void", async (_input, context) => {
			await context.progress({ message: "started", percent: 50 });
		});
		const transport = new MemoryTransport();
		transport.input.push(JSON.stringify({ v: 1, id: "t1", type: "task", name: "tick" }));

		await module.serve(transport);

		expect(transport.output).toEqual([
			{ v: 1, id: "t1", type: "progress", message: "started", percent: 50 },
			{ v: 1, id: "t1", type: "ret", status: "ok" },
		]);
	});

	test("validates shape defaults and rejects malformed values", () => {
		const module = new WorkflowModule("example/tools");
		const shape = { shape: [
			{ name: "count", type: "i32" as const, default: 1 },
			{ name: "labels", type: { list: "string" as const } },
		] };

		const value = validate(shape, { labels: ["one"], extra: true }, "input", module.describe());

		expect(value).toEqual({ count: 1, labels: ["one"] });
		expect(() => validate(shape, { labels: [3] }, "input", module.describe())).toThrow();
	});

	test("rejects a malformed input before calling its handler", async () => {
		const module = new WorkflowModule("example/tools");
		let called = false;
		module.registerTask("echo", { shape: [{ name: "value", type: "i32" }] },
			"void", async () => {
				called = true;
			});
		const transport = new MemoryTransport();
		transport.input.push(JSON.stringify({
			v: 1,
			id: "t2",
			type: "task",
			name: "echo",
			input: { value: "wrong" },
		}));

		await module.serve(transport);

		expect(called).toBe(false);
		expect(transport.output[0]?.status).toBe("error");
	});

	test("acknowledges cancellation on the original request ID", async () => {
		const module = new WorkflowModule("example/tools");
		module.registerTask("wait", "void", "void", async (_input, context) => {
			await new Promise<void>((resolve) => {
				context.signal.addEventListener("abort", () => resolve(), { once: true });
			});
		});
		const transport = new MemoryTransport();
		transport.input.push(JSON.stringify({ v: 1, id: "t3", type: "task", name: "wait" }));
		transport.input.push(JSON.stringify({ v: 1, id: "t3", type: "cancel" }));

		await module.serve(transport);

		expect(transport.output).toEqual([
			{ v: 1, id: "t3", type: "ret", status: "cancel" },
		]);
	});

	test("rejects a value returned by a void handler", async () => {
		const module = new WorkflowModule("example/tools");
		module.registerTask("wrong", "void", "void", async () => "unexpected");
		const transport = new MemoryTransport();
		transport.input.push(JSON.stringify({ v: 1, id: "t4", type: "task", name: "wrong" }));

		await module.serve(transport);

		expect(transport.output[0]?.status).toBe("error");
	});
});
