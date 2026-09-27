import path from 'node:path';
import type { Environment } from '#src/app/environment/environment-shapes';
import type { NodeModel } from '#src/app/node/node-models';
import {
	PlaybookModel,
	type PlaybookSshConnectionOptions,
	type PlaybookSshIdentity,
	type PlaybookTargetNode,
	PlaybookTargetSelectorModel,
	PlaybookTaskDefinitionModel,
	type PlaybookTaskNodeResultModel,
	type PlaybookTaskProgressFields,
	PlaybookTaskStatus,
} from '#src/app/playbook/playbook-models';

export interface CreatePlaybookFields {
	name: string;
	targets: PlaybookTargetSelectorModel | { tags: string[] };
	tasks: Array<PlaybookTaskDefinitionModel | { input?: Record<string, unknown>; name: string; type: string }>;
}

export interface PlaybookStartEvent {
	node_ids: string[];
	playbook_name: string;
	start_date: string;
	task_total: number;
	type: 'playbook.start';
}

export interface PlaybookEndEvent {
	change_node_ids: string[];
	duration: number;
	end_date: string;
	fail_node_ids: string[];
	ok_node_ids: string[];
	playbook_name: string;
	skip_node_ids: string[];
	start_date: string;
	type: 'playbook.end';
}

export interface PlaybookTaskWaveStartEvent {
	node_ids: string[];
	step: number;
	task_id: number;
	task_name: string;
	total: number;
	type: 'task.wave.start';
}

export interface PlaybookTaskWaveEndEvent {
	change_node_ids: string[];
	duration: number;
	fail_node_ids: string[];
	ok_node_ids: string[];
	skip_node_ids: string[];
	step: number;
	task_id: number;
	task_name: string;
	total: number;
	type: 'task.wave.end';
}

export interface PlaybookTaskNodeStartEvent {
	node_id: string;
	start_date: string;
	task_id: number;
	task_name: string;
	type: 'task.node.start';
}

export interface PlaybookTaskNodeEndEvent {
	duration: number;
	message: string | null;
	node_id: string;
	output: unknown;
	status: PlaybookTaskStatus;
	task_id: number;
	task_name: string;
	type: 'task.node.end';
}

export interface PlaybookTaskNodeProgressEvent {
	message: string | null;
	node_id: string;
	percent: number | null;
	step: number | null;
	task_id: number;
	task_name: string;
	total: number | null;
	type: 'task.node.progress';
}

export type PlaybookEvent =
	| PlaybookEndEvent
	| PlaybookStartEvent
	| PlaybookTaskNodeEndEvent
	| PlaybookTaskNodeProgressEvent
	| PlaybookTaskNodeStartEvent
	| PlaybookTaskWaveEndEvent
	| PlaybookTaskWaveStartEvent;

export function createPlaybookModel(fields: CreatePlaybookFields): PlaybookModel {
	return new PlaybookModel({
		name: fields.name,
		targets:
			fields.targets instanceof PlaybookTargetSelectorModel
				? fields.targets
				: new PlaybookTargetSelectorModel(fields.targets),
		tasks: fields.tasks.map((task, index) => {
			const taskDefinition =
				task instanceof PlaybookTaskDefinitionModel ? task : new PlaybookTaskDefinitionModel(task);

			return {
				id: index,
				input: taskDefinition.input,
				name: taskDefinition.name,
				type: taskDefinition.type,
			};
		}),
	});
}

export function createPlaybookTaskDefinition(
	type: string,
	name: string,
	input: Record<string, unknown> = {},
): PlaybookTaskDefinitionModel {
	return new PlaybookTaskDefinitionModel({
		input,
		name,
		type,
	});
}

export function createPlaybookTargetSelector(tags: string[]): PlaybookTargetSelectorModel {
	return new PlaybookTargetSelectorModel({
		tags,
	});
}

export function createPlaybookStartEvent(
	playbook: PlaybookModel,
	nodeIds: string[],
	startDate: string,
): PlaybookStartEvent {
	return {
		node_ids: nodeIds,
		playbook_name: playbook.name,
		start_date: startDate,
		task_total: playbook.tasks.length,
		type: 'playbook.start',
	};
}

export function createPlaybookEndEvent(
	playbook: PlaybookModel,
	startDate: string,
	endDate: string,
	nodeResults: PlaybookTaskNodeResultModel[],
): PlaybookEndEvent {
	return {
		change_node_ids: readNodeIdsByStatus(nodeResults, PlaybookTaskStatus.Change),
		duration: Date.parse(endDate) - Date.parse(startDate),
		end_date: endDate,
		fail_node_ids: readNodeIdsByStatus(nodeResults, PlaybookTaskStatus.Fail),
		ok_node_ids: readNodeIdsByStatus(nodeResults, PlaybookTaskStatus.Ok),
		playbook_name: playbook.name,
		skip_node_ids: readNodeIdsByStatus(nodeResults, PlaybookTaskStatus.Skip),
		start_date: startDate,
		type: 'playbook.end',
	};
}

export function createTaskWaveStartEvent(
	taskId: number,
	taskName: string,
	step: number,
	total: number,
	nodeIds: string[],
): PlaybookTaskWaveStartEvent {
	return {
		node_ids: nodeIds,
		step,
		task_id: taskId,
		task_name: taskName,
		total,
		type: 'task.wave.start',
	};
}

export function createTaskWaveEndEvent(
	taskId: number,
	taskName: string,
	step: number,
	total: number,
	duration: number,
	nodeResults: PlaybookTaskNodeResultModel[],
): PlaybookTaskWaveEndEvent {
	return {
		change_node_ids: readNodeIdsByStatus(nodeResults, PlaybookTaskStatus.Change),
		duration,
		fail_node_ids: readNodeIdsByStatus(nodeResults, PlaybookTaskStatus.Fail),
		ok_node_ids: readNodeIdsByStatus(nodeResults, PlaybookTaskStatus.Ok),
		skip_node_ids: readNodeIdsByStatus(nodeResults, PlaybookTaskStatus.Skip),
		step,
		task_id: taskId,
		task_name: taskName,
		total,
		type: 'task.wave.end',
	};
}

export function createTaskNodeStartEvent(
	nodeId: string,
	taskId: number,
	taskName: string,
	startDate: string,
): PlaybookTaskNodeStartEvent {
	return {
		node_id: nodeId,
		start_date: startDate,
		task_id: taskId,
		task_name: taskName,
		type: 'task.node.start',
	};
}

export function createTaskNodeEndEvent(result: PlaybookTaskNodeResultModel): PlaybookTaskNodeEndEvent {
	return {
		duration: result.duration,
		message: result.message,
		node_id: result.node_id,
		output: result.output,
		status: result.status,
		task_id: result.task_id,
		task_name: result.task_name,
		type: 'task.node.end',
	};
}

export function createTaskNodeProgressEvent(
	nodeId: string,
	taskId: number,
	taskName: string,
	fields: PlaybookTaskProgressFields,
): PlaybookTaskNodeProgressEvent {
	return {
		message: fields.message,
		node_id: nodeId,
		percent: fields.percent,
		step: fields.step,
		task_id: taskId,
		task_name: taskName,
		total: fields.total,
		type: 'task.node.progress',
	};
}

export function createPlaybookConnectionOptions(node: NodeModel): PlaybookSshConnectionOptions {
	return {
		host: node.public_ip,
		port: readNodePort(node),
		user: readNodeUser(node),
	};
}

export function createPlaybookRunCertificateIdentity(environment: Environment, playbookName: string): string {
	return `mars-${environment.id}-${sanitizePlaybookName(playbookName)}`;
}

export function readPlaybookCaName(node: NodeModel): string {
	const value = node.properties['ssh.ca'];

	return typeof value === 'string' && value.length > 0 ? value : 'default';
}

export function readPlaybookNodeIds(nodes: PlaybookTargetNode[]): string[] {
	return nodes.map((targetNode) => targetNode.node.id);
}

export function readPlaybookRunAuthKey(identity: PlaybookSshIdentity): string {
	return `${identity.private_key.trim()}\n${identity.certificate.trim()}\n`;
}

export function createPlaybookRunIdentityFilePath(workPath: string, environmentId: string, runId: string): string {
	return path.posix.join(workPath, 'env', environmentId, 'playbook', `${runId}.key`);
}

function readNodeIdsByStatus(nodeResults: PlaybookTaskNodeResultModel[], status: PlaybookTaskStatus): string[] {
	return [...new Set(nodeResults.filter((result) => result.status === status).map((result) => result.node_id))];
}

function readNodePort(node: NodeModel): number {
	const value = node.properties['ssh.port'];

	return typeof value === 'number' && Number.isFinite(value) ? value : 22;
}

function readNodeUser(node: NodeModel): string {
	const value = node.properties['ssh.user'];

	return typeof value === 'string' && value.length > 0 ? value : 'mars';
}

function sanitizePlaybookName(value: string): string {
	return value.replaceAll(/[^a-zA-Z0-9_-]+/g, '-');
}
