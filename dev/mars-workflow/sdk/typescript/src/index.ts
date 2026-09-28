export type ValueType =
	| "string"
	| "bool"
	| "i32"
	| "f32"
	| "datetime"
	| "duration"
	| "path"
	| "url"
	| { list: ValueType }
	| { optional: ValueType }
	| { shape: Field[] }
	| { ref: string };

export type CallableType = ValueType | "void";

export interface Field {
	name: string;
	type: ValueType;
	default?: unknown;
}

export type Export =
	| { kind: "shape"; name: string; fields: Field[] }
	| { kind: "fn" | "task"; name: string; input: CallableType; output: CallableType }
	| { kind: "workflow"; name: string; source: string }
	| { kind: "const" | "value"; name: string; type: ValueType; value: unknown };

export interface ModuleDescription {
	module: string;
	exports: Export[];
}

export interface Progress {
	message: string;
	percent?: number;
}

export interface InvocationContext {
	signal: AbortSignal;
	progress(value: Progress): Promise<void>;
	log(message: string | Record<string, unknown>): void;
}

export type Handler = (input: unknown, context: InvocationContext) => Promise<unknown>;

export interface LineTransport {
	read(): AsyncIterable<string>;
	write(line: string): Promise<void>;
	log(line: string): void;
}

interface ActiveCall {
	controller: AbortController;
	terminal: boolean;
}

interface WireMessage {
	v: number;
	id: string;
	type: string;
	name?: string;
	input?: unknown;
}

export class WorkflowModule {
	private readonly description: ModuleDescription;
	private readonly handlers = new Map<string, Handler>();
	private readonly active = new Map<string, ActiveCall>();
	private readonly pending = new Set<Promise<void>>();
	private writeGate = Promise.resolve();

	constructor(module: string) {
		this.description = { module, exports: [] };
	}

	registerShape(name: string, fields: Field[]): void {
		this.addExport({ kind: "shape", name, fields });
	}

	registerFunction(name: string, input: CallableType, output: CallableType, handler: Handler): void {
		this.addCallable("fn", name, input, output, handler);
	}

	registerTask(name: string, input: CallableType, output: CallableType, handler: Handler): void {
		this.addCallable("task", name, input, output, handler);
	}

	registerWorkflow(name: string, source: string): void {
		this.addExport({ kind: "workflow", name, source });
	}

	registerConstant(name: string, type: ValueType, value: unknown): void {
		validate(type, value, `${name} value`, this.description);
		this.addExport({ kind: "const", name, type, value });
	}

	registerValue(name: string, type: ValueType, value: unknown): void {
		validate(type, value, `${name} value`, this.description);
		this.addExport({ kind: "value", name, type, value });
	}

	describe(): ModuleDescription {
		return structuredClone(this.description);
	}

	async serve(transport: LineTransport): Promise<void> {
		for await (const line of transport.read()) {
			let message: WireMessage;
			try {
				message = JSON.parse(line) as WireMessage;
				this.checkMessage(message);
			} catch (error) {
				transport.log(`Invalid protocol message: ${errorText(error)}`);
				continue;
			}

			if (message.type === "cancel") {
				this.active.get(message.id)?.controller.abort();
				continue;
			}

			const invocation = this.invoke(message, transport);
			this.pending.add(invocation);
			void invocation.then(
				() => this.pending.delete(invocation),
				() => this.pending.delete(invocation),
			);
		}

		await Promise.all(this.pending);
	}

	private addCallable(
		kind: "fn" | "task",
		name: string,
		input: CallableType,
		output: CallableType,
		handler: Handler,
	): void {
		this.addExport({ kind, name, input, output });
		this.handlers.set(`${kind}:${name}`, handler);
	}

	private addExport(item: Export): void {
		if (this.description.exports.some((current) => current.name === item.name)) {
			throw new Error(`Duplicate export '${item.name}'.`);
		}

		this.description.exports.push(item);
	}

	private checkMessage(message: WireMessage): void {
		const validVersion = message.v === 1;
		const validId = typeof message.id === "string" && message.id.length > 0;
		const validType = ["describe", "fn", "task", "cancel"].includes(message.type);
		if (!validVersion || !validId || !validType) {
			throw new Error("Invalid v, id, or type.");
		}
	}

	private async invoke(message: WireMessage, transport: LineTransport): Promise<void> {
		if (this.active.has(message.id)) {
			transport.log(`Duplicate active request ID '${message.id}'.`);
			return;
		}

		const state: ActiveCall = { controller: new AbortController(), terminal: false };
		this.active.set(message.id, state);

		try {
			if (message.type === "describe") {
				await this.send(transport, { v: 1, id: message.id, type: "ret", status: "ok", output: this.describe() });
				return;
			}

			const definition = this.description.exports.find(
				(item) => item.kind === message.type && item.name === message.name,
			);
			if (!definition || (definition.kind !== "fn" && definition.kind !== "task")) {
				throw new Error(`Unknown ${message.type} '${message.name}'.`);
			}

			const handler = this.handlers.get(`${message.type}:${message.name}`);
			if (!handler) {
				throw new Error(`Missing handler for '${message.name}'.`);
			}

			const input = this.readInput(message, definition);
			const context: InvocationContext = {
				signal: state.controller.signal,
				progress: async (value) => {
					if (state.terminal) {
						throw new Error("Progress was sent after return.");
					}

					const progress = { v: 1, id: message.id, type: "progress", ...value };
					await this.send(transport, progress);
				},
				log: (value) => {
					const line = typeof value === "string" ? value : JSON.stringify(value);
					transport.log(line);
				},
			};
			const output = await handler(input, context);
			if (state.controller.signal.aborted) {
				await this.send(transport, { v: 1, id: message.id, type: "ret", status: "cancel" });
				return;
			}

			const result: Record<string, unknown> = {
				v: 1,
				id: message.id,
				type: "ret",
				status: "ok",
			};
			if (definition.output === "void") {
				if (output !== undefined) {
					throw new Error("Void handler must not return a value.");
				}
			} else {
				result.output = validate(definition.output, output, "output", this.description);
			}

			await this.send(transport, result);
		} catch (error) {
			const status = state.controller.signal.aborted ? "cancel" : "error";
			const result: Record<string, unknown> = { v: 1, id: message.id, type: "ret", status };
			if (status === "error") {
				result.error = { name: "ModuleError", message: errorText(error) };
			}

			await this.send(transport, result);
		} finally {
			state.terminal = true;
			this.active.delete(message.id);
		}
	}

	private readInput(message: WireMessage, definition: Extract<Export, { kind: "fn" | "task" }>): unknown {
		if (definition.input === "void") {
			if ("input" in message) {
				throw new Error("Void input must omit the input field.");
			}

			return undefined;
		}

		if (!("input" in message)) {
			throw new Error("Missing input field.");
		}

		return validate(definition.input, message.input, "input", this.description);
	}

	private async send(transport: LineTransport, value: Record<string, unknown>): Promise<void> {
		const line = JSON.stringify(value);
		const next = this.writeGate.then(() => transport.write(line));
		this.writeGate = next.catch(() => undefined);

		await next;
	}
}

export function validate(
	type: ValueType,
	value: unknown,
	name: string,
	description: ModuleDescription,
): unknown {
	if (typeof type === "string") {
		if (["string", "path", "url", "datetime"].includes(type)) {
			if (typeof value !== "string") throw new Error(`${name} must be text.`);
			if (type === "url" && !URL.canParse(value)) throw new Error(`${name} must be an absolute URL.`);
			if (type === "datetime") {
				const isUtc = value.endsWith("Z") && value.includes("T");
				const parses = !Number.isNaN(Date.parse(value));
				if (!isUtc || !parses) throw new Error(`${name} must be an RFC 3339 UTC datetime.`);
			}
			return value;
		}

		if (type === "bool") {
			if (typeof value !== "boolean") throw new Error(`${name} must be bool.`);
			return value;
		}

		if (type === "i32" || type === "duration") {
			const isInteger = typeof value === "number" && Number.isSafeInteger(value);
			const inRange = type === "duration" || (typeof value === "number" && value >= -2147483648 && value <= 2147483647);
			if (!isInteger || !inRange) throw new Error(`${name} must be an integer in range.`);
			return value;
		}

		if (type === "f32") {
			const isFinite = typeof value === "number" && Number.isFinite(value);
			if (!isFinite || !Number.isFinite(Math.fround(value))) throw new Error(`${name} must be finite f32.`);
			return Math.fround(value);
		}

		throw new Error(`Unknown type '${type}'.`);
	}

	if ("optional" in type) {
		if (value === null || value === undefined) return null;
		return validate(type.optional, value, name, description);
	}

	if ("list" in type) {
		if (!Array.isArray(value)) throw new Error(`${name} must be a list.`);
		return value.map((item, index) => validate(type.list, item, `${name}[${index}]`, description));
	}

	if ("ref" in type) {
		const shape = description.exports.find((item) => item.kind === "shape" && `${description.module}/${item.name}` === type.ref);
		if (!shape || shape.kind !== "shape") throw new Error(`Unknown shape '${type.ref}'.`);
		return validate({ shape: shape.fields }, value, name, description);
	}

	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		throw new Error(`${name} must be an object.`);
	}

	const input = value as Record<string, unknown>;
	const result: Record<string, unknown> = {};
	for (const field of type.shape) {
		const hasValue = Object.hasOwn(input, field.name);
		const hasDefault = Object.hasOwn(field, "default");
		if (!hasValue && !hasDefault && !(typeof field.type === "object" && "optional" in field.type)) {
			throw new Error(`${name}.${field.name} is required.`);
		}

		if (hasValue || hasDefault) {
			const fieldValue = hasValue ? input[field.name] : field.default;
			result[field.name] = validate(field.type, fieldValue, `${name}.${field.name}`, description);
		}
	}

	return result;
}

function errorText(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
