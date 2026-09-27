import * as z from 'zod';
import type { Environment } from '#src/app/environment/environment-shapes';
import type { NodeModel } from '#src/app/node/node-models';

export enum PlaybookTaskStatus {
	Change = 'change',
	Fail = 'fail',
	Ok = 'ok',
	Skip = 'skip',
}

export const playbookTaskInputSchema = z.record(z.string(), z.unknown());

export class PlaybookTargetSelectorModel {
	static schema = z.object({
		tags: z.array(z.string().min(1)).min(1),
	});

	tags: string[];

	constructor(fields: unknown) {
		const parsed = PlaybookTargetSelectorModel.schema.parse(fields);

		this.tags = parsed.tags;
	}
}

export class PlaybookTaskDefinitionModel {
	static schema = z.object({
		input: playbookTaskInputSchema,
		name: z.string().min(1),
		type: z.string().min(1),
	});

	input: Record<string, unknown>;
	name: string;
	type: string;

	constructor(fields: unknown) {
		const parsed = PlaybookTaskDefinitionModel.schema.parse(fields);

		this.input = parsed.input;
		this.name = parsed.name;
		this.type = parsed.type;
	}
}

export class PlaybookTaskModel {
	static schema = z.object({
		id: z.number().int().nonnegative(),
		input: playbookTaskInputSchema,
		name: z.string().min(1),
		type: z.string().min(1),
	});

	id: number;
	input: Record<string, unknown>;
	name: string;
	type: string;

	constructor(fields: unknown) {
		const parsed = PlaybookTaskModel.schema.parse(fields);

		this.id = parsed.id;
		this.input = parsed.input;
		this.name = parsed.name;
		this.type = parsed.type;
	}
}

export class PlaybookModel {
	static schema = z.object({
		name: z.string().min(1),
		targets: PlaybookTargetSelectorModel.schema,
		tasks: z.array(PlaybookTaskModel.schema),
	});

	name: string;
	targets: PlaybookTargetSelectorModel;
	tasks: PlaybookTaskModel[];

	constructor(fields: unknown) {
		const parsed = PlaybookModel.schema.parse(fields);

		this.name = parsed.name;
		this.targets = new PlaybookTargetSelectorModel(parsed.targets);
		this.tasks = parsed.tasks.map((task) => new PlaybookTaskModel(task));
	}
}

export class PlaybookTaskNodeResultModel {
	static schema = z.object({
		duration: z.number().nonnegative(),
		message: z.string().nullable(),
		node_id: z.string().min(1),
		ok: z.boolean(),
		output: z.unknown().nullable(),
		status: z.enum(PlaybookTaskStatus),
		stderr: z.string(),
		stdout: z.string(),
		task_id: z.number().int().nonnegative(),
		task_name: z.string().min(1),
	});

	duration: number;
	message: string | null;
	node_id: string;
	ok: boolean;
	output: unknown;
	status: PlaybookTaskStatus;
	stderr: string;
	stdout: string;
	task_id: number;
	task_name: string;

	constructor(fields: unknown) {
		const parsed = PlaybookTaskNodeResultModel.schema.parse(fields);

		this.duration = parsed.duration;
		this.message = parsed.message;
		this.node_id = parsed.node_id;
		this.ok = parsed.ok;
		this.output = parsed.output;
		this.status = parsed.status;
		this.stderr = parsed.stderr;
		this.stdout = parsed.stdout;
		this.task_id = parsed.task_id;
		this.task_name = parsed.task_name;
	}
}

export class PlaybookTaskResultModel {
	static schema = z.object({
		message: z.string().nullable(),
		ok: z.boolean(),
		output: z.unknown().nullable(),
		status: z.enum(PlaybookTaskStatus),
		stderr: z.string(),
		stdout: z.string(),
	});

	message: string | null;
	ok: boolean;
	output: unknown;
	status: PlaybookTaskStatus;
	stderr: string;
	stdout: string;

	constructor(fields: unknown) {
		const parsed = PlaybookTaskResultModel.schema.parse(fields);

		this.message = parsed.message;
		this.ok = parsed.ok;
		this.output = parsed.output;
		this.status = parsed.status;
		this.stderr = parsed.stderr;
		this.stdout = parsed.stdout;
	}
}

export class PlaybookTaskWaveResultModel {
	static schema = z.object({
		duration: z.number().nonnegative(),
		node_results: z.array(PlaybookTaskNodeResultModel.schema),
		step: z.number().int().positive(),
		task_id: z.number().int().nonnegative(),
		task_name: z.string().min(1),
		total: z.number().int().positive(),
	});

	duration: number;
	node_results: PlaybookTaskNodeResultModel[];
	step: number;
	task_id: number;
	task_name: string;
	total: number;

	constructor(fields: unknown) {
		const parsed = PlaybookTaskWaveResultModel.schema.parse(fields);

		this.duration = parsed.duration;
		this.node_results = parsed.node_results.map((result) => new PlaybookTaskNodeResultModel(result));
		this.step = parsed.step;
		this.task_id = parsed.task_id;
		this.task_name = parsed.task_name;
		this.total = parsed.total;
	}
}

export class PlaybookRunResultModel {
	static schema = z.object({
		change_node_ids: z.array(z.string().min(1)),
		duration: z.number().nonnegative(),
		end_date: z.string().min(1),
		fail_node_ids: z.array(z.string().min(1)),
		node_ids: z.array(z.string().min(1)),
		ok_node_ids: z.array(z.string().min(1)),
		playbook_name: z.string().min(1),
		skip_node_ids: z.array(z.string().min(1)),
		start_date: z.string().min(1),
		task_results: z.array(PlaybookTaskWaveResultModel.schema),
	});

	change_node_ids: string[];
	duration: number;
	end_date: string;
	fail_node_ids: string[];
	node_ids: string[];
	ok_node_ids: string[];
	playbook_name: string;
	skip_node_ids: string[];
	start_date: string;
	task_results: PlaybookTaskWaveResultModel[];

	constructor(fields: unknown) {
		const parsed = PlaybookRunResultModel.schema.parse(fields);

		this.change_node_ids = parsed.change_node_ids;
		this.duration = parsed.duration;
		this.end_date = parsed.end_date;
		this.fail_node_ids = parsed.fail_node_ids;
		this.node_ids = parsed.node_ids;
		this.ok_node_ids = parsed.ok_node_ids;
		this.playbook_name = parsed.playbook_name;
		this.skip_node_ids = parsed.skip_node_ids;
		this.start_date = parsed.start_date;
		this.task_results = parsed.task_results.map((result) => new PlaybookTaskWaveResultModel(result));
	}
}

export interface PlaybookTargetNode {
	node: NodeModel;
	tags: string[];
}

export interface PlaybookTaskProgressFields {
	message: string | null;
	percent: number | null;
	step: number | null;
	total: number | null;
}

export interface PlaybookTaskContext {
	emitProgress(fields: PlaybookTaskProgressFields): void;
	environment: Environment;
	node: NodeModel;
	ssh: PlaybookSshClient;
	task: PlaybookTaskModel;
}

export interface PlaybookTaskResultFields {
	message?: string | null;
	output?: unknown;
	status: PlaybookTaskStatus;
	stderr?: string;
	stdout?: string;
}

export interface PlaybookSshClient {
	close(): Promise<void>;
	connect(options: PlaybookSshConnectionOptions, identity: PlaybookSshIdentity): Promise<void>;
	exec(command: string, options?: PlaybookSshExecOptions): Promise<PlaybookSshExecResult>;
	isConnected(): boolean;
}

export interface PlaybookSshConnectionOptions {
	connection_timeout_ms?: number;
	host: string;
	port: number;
	user: string;
}

export interface PlaybookSshExecOptions {
	timeout_ms?: number;
}

export interface PlaybookSshExecResult {
	code: number | null;
	signal: string | null;
	stderr: string;
	stdout: string;
}

export interface PlaybookSshIdentity {
	certificate: string;
	private_key: string;
}
