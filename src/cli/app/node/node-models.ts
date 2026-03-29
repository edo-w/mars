import * as z from 'zod';

export enum NodeStatus {
	Bootstrap = 'bootstrap',
	Fail = 'fail',
	New = 'new',
	Ready = 'ready',
}

export enum NodeEventAction {
	AddTag = 'add-tag',
	Create = 'create',
	Remove = 'remove',
	RemoveProperty = 'remove-property',
	RemoveTag = 'remove-tag',
	SetProperty = 'set-property',
	SetStatus = 'set-status',
}

export const nodePropertyValueSchema = z.union([z.boolean(), z.number(), z.string()]);
export const nodePropertiesSchema = z.record(
	z.string().regex(/^[a-z0-9_-]+(?:\.[a-z0-9_-]+)*$/),
	nodePropertyValueSchema,
);
export const nodeEventContextSchema = z.record(z.string(), z.unknown());

export type NodePropertyValue = z.infer<typeof nodePropertyValueSchema>;

export class NodeModel {
	static schema = z.object({
		create_date: z.string().min(1),
		hostname: z.string().min(1).nullable(),
		id: z.string().min(1),
		private_ip: z.string().min(1).nullable(),
		properties: nodePropertiesSchema,
		public_ip: z.string().min(1),
		status: z.enum(NodeStatus),
		update_date: z.string().min(1),
	});

	create_date: string;
	hostname: string | null;
	id: string;
	private_ip: string | null;
	properties: Record<string, NodePropertyValue>;
	public_ip: string;
	status: NodeStatus;
	update_date: string;

	constructor(fields: unknown) {
		const parsed = NodeModel.schema.parse(fields);

		this.create_date = parsed.create_date;
		this.hostname = parsed.hostname;
		this.id = parsed.id;
		this.private_ip = parsed.private_ip;
		this.properties = parsed.properties;
		this.public_ip = parsed.public_ip;
		this.status = parsed.status;
		this.update_date = parsed.update_date;
	}
}

export class NodeTagModel {
	static schema = z.object({
		node_id: z.string().min(1),
		tag: z.string().regex(/^[a-z0-9_-]+$/),
	});

	node_id: string;
	tag: string;

	constructor(fields: unknown) {
		const parsed = NodeTagModel.schema.parse(fields);

		this.node_id = parsed.node_id;
		this.tag = parsed.tag;
	}
}

export class NodeEventModel {
	static schema = z.object({
		action: z.enum(NodeEventAction),
		context: nodeEventContextSchema,
		date: z.string().min(1),
		node_id: z.string().min(1),
	});

	action: NodeEventAction;
	context: Record<string, unknown>;
	date: string;
	node_id: string;

	constructor(fields: unknown) {
		const parsed = NodeEventModel.schema.parse(fields);

		this.action = parsed.action;
		this.context = parsed.context;
		this.date = parsed.date;
		this.node_id = parsed.node_id;
	}
}

export class NodeListEntryModel {
	static schema = z.object({
		hostname: z.string().min(1).nullable(),
		id: z.string().min(1),
		private_ip: z.string().min(1).nullable(),
		public_ip: z.string().min(1),
		status: z.enum(NodeStatus),
		tags: z.array(z.string().regex(/^[a-z0-9_-]+$/)),
	});

	hostname: string | null;
	id: string;
	private_ip: string | null;
	public_ip: string;
	status: NodeStatus;
	tags: string[];

	constructor(fields: unknown) {
		const parsed = NodeListEntryModel.schema.parse(fields);

		this.hostname = parsed.hostname;
		this.id = parsed.id;
		this.private_ip = parsed.private_ip;
		this.public_ip = parsed.public_ip;
		this.status = parsed.status;
		this.tags = parsed.tags;
	}
}
