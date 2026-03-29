import path from 'node:path';
import * as z from 'zod';
import {
	type NodeEventAction,
	NodeEventModel,
	type NodeListEntryModel,
	NodeModel,
	type NodePropertyValue,
	NodeStatus,
	nodePropertyValueSchema,
} from '#src/cli/app/node/node-models';

export const NODE_DIRECTORY = 'node';
export const NODE_STORE_FILE = 'store.db';

const nodeTagSchema = z.string().regex(/^[a-z0-9_-]+$/);
const nodePropertyKeySchema = z.string().regex(/^[a-z0-9_-]+(?:\.[a-z0-9_-]+)*$/);
const nodeIdSchema = z.string().regex(/^ip-\d{1,3}-\d{1,3}-\d{1,3}-\d{1,3}$/);
const ipv4Schema = z.string().refine(isIpv4Address, {
	message: 'invalid ipv4 address',
});

export class CreateNodeInput {
	static schema = z.object({
		id: nodeIdSchema,
		public_ip: ipv4Schema,
	});

	id: string;
	public_ip: string;

	constructor(fields: unknown) {
		const parsed = CreateNodeInput.schema.parse(fields);

		this.id = parsed.id;
		this.public_ip = parsed.public_ip;
	}
}

export class NodePropertyGetResult {
	static schema = z.object({
		kind: z.literal('ok'),
		value: nodePropertyValueSchema,
	});

	kind: 'ok';
	value: NodePropertyValue;

	constructor(fields: unknown) {
		const parsed = NodePropertyGetResult.schema.parse(fields);

		this.kind = parsed.kind;
		this.value = parsed.value;
	}
}

export interface ListNodesResultItem {
	hostname: string | null;
	id: string;
	private_ip: string | null;
	public_ip: string;
	status: NodeStatus;
	tags: string[];
}

export interface NodeStoreSaveResult {
	node_count: number;
}

export function createNodeDirectoryWorkPath(workPath: string, environmentId: string): string {
	return path.posix.join(workPath, 'env', environmentId, NODE_DIRECTORY);
}

export function createNodeEvent(
	action: NodeEventAction,
	nodeId: string,
	context: Record<string, unknown>,
): NodeEventModel {
	return new NodeEventModel({
		action,
		context,
		date: new Date().toISOString(),
		node_id: nodeId,
	});
}

export function createNodeStoreBackendPath(environmentId: string): string {
	return path.posix.join('env', environmentId, NODE_DIRECTORY, NODE_STORE_FILE);
}

export function createNodeStoreWorkPath(workPath: string, environmentId: string): string {
	return path.posix.join(createNodeDirectoryWorkPath(workPath, environmentId), NODE_STORE_FILE);
}

export function createNodeStoreWalWorkPath(workPath: string, environmentId: string): string {
	return `${createNodeStoreWorkPath(workPath, environmentId)}-wal`;
}

export function createNodeStoreShmWorkPath(workPath: string, environmentId: string): string {
	return `${createNodeStoreWorkPath(workPath, environmentId)}-shm`;
}

export function createNodeModel(input: CreateNodeInput, now: string): NodeModel {
	return new NodeModel({
		create_date: now,
		hostname: null,
		id: input.id,
		private_ip: null,
		properties: {},
		public_ip: input.public_ip,
		status: NodeStatus.New,
		update_date: now,
	});
}

export function createNodeId(publicIp: string): string {
	return `ip-${publicIp.replaceAll('.', '-')}`;
}

export function formatNodePropertyValue(value: NodePropertyValue): string {
	return String(value);
}

export function normalizeNodeTag(tag: string): string {
	return nodeTagSchema.parse(tag.toLowerCase());
}

export function parseNodeCreateValue(value: string): CreateNodeInput {
	const trimmedValue = value.trim();

	if (isIpv4Address(trimmedValue)) {
		return new CreateNodeInput({
			id: createNodeId(trimmedValue),
			public_ip: trimmedValue,
		});
	}

	const nodeId = parseNodeReference(trimmedValue);
	const publicIp = nodeId.slice(3).replaceAll('-', '.');

	return new CreateNodeInput({
		id: nodeId,
		public_ip: publicIp,
	});
}

export function parseNodePropertyKey(value: string): string {
	return nodePropertyKeySchema.parse(value);
}

export function parseNodePropertyValue(value: string): NodePropertyValue {
	const trimmedValue = value.trim();

	if (trimmedValue === 'true') {
		return true;
	}

	if (trimmedValue === 'false') {
		return false;
	}

	if (trimmedValue.length > 0 && /^-?\d+(?:\.\d+)?$/.test(trimmedValue)) {
		return Number(trimmedValue);
	}

	return value;
}

export function parseNodeReference(value: string): string {
	const trimmedValue = value.trim();

	if (isIpv4Address(trimmedValue)) {
		return createNodeId(trimmedValue);
	}

	const nodeId = nodeIdSchema.parse(trimmedValue);
	const publicIp = nodeId.slice(3).replaceAll('-', '.');

	if (!isIpv4Address(publicIp)) {
		throw new Error('invalid node id');
	}

	return nodeId;
}

export function readNodeListTags(tagValue: string | null): string[] {
	if (tagValue === null) {
		return [];
	}

	return tagValue
		.split(',')
		.map((tag) => tag.trim())
		.filter((tag) => tag.length > 0)
		.map((tag) => normalizeNodeTag(tag));
}

function isIpv4Address(value: string): boolean {
	const segments = value.split('.');

	if (segments.length !== 4) {
		return false;
	}

	for (const segment of segments) {
		if (!/^\d{1,3}$/.test(segment)) {
			return false;
		}

		const numberValue = Number(segment);

		if (numberValue < 0 || numberValue > 255) {
			return false;
		}
	}

	return true;
}

export function isMutableNodePropertyKey(propertyKey: string): boolean {
	return propertyKey !== 'public_ip';
}

export function isTopLevelNodePropertyKey(propertyKey: string): boolean {
	return propertyKey === 'hostname' || propertyKey === 'private_ip';
}

export function toListNodesResultItem(node: NodeListEntryModel): ListNodesResultItem {
	return {
		hostname: node.hostname,
		id: node.id,
		private_ip: node.private_ip,
		public_ip: node.public_ip,
		status: node.status,
		tags: node.tags,
	};
}
