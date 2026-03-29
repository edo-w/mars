import path from 'node:path';
import type { ConfigService } from '#src/app/config/config-service';
import type { Environment } from '#src/app/environment/environment-shapes';
import {
	NodeEventAction,
	type NodeEventModel,
	type NodeModel,
	type NodePropertyValue,
	type NodeStatus,
} from '#src/app/node/node-models';
import { NodeRepo } from '#src/app/node/node-repo';
import {
	type CreateNodeInput,
	createNodeEvent,
	createNodeModel,
	createNodeStoreWorkPath,
	isMutableNodePropertyKey,
	type ListNodesResultItem,
	type NodeStoreSaveResult,
	normalizeNodeTag,
	parseNodePropertyKey,
	toListNodesResultItem,
} from '#src/app/node/node-shapes';
import type { NodeSyncService } from '#src/app/node/node-sync-service';
import { DbClient } from '#src/lib/db';
import type { Vfs } from '#src/lib/vfs';

export interface NodePropertyGetOkResult {
	kind: 'ok';
	value: NodePropertyValue;
}

export interface NodePropertyGetNodeNotFoundResult {
	kind: 'node_not_found';
}

export interface NodePropertyGetPropertyNotFoundResult {
	kind: 'property_not_found';
}

export type NodePropertyGetResult =
	| NodePropertyGetOkResult
	| NodePropertyGetNodeNotFoundResult
	| NodePropertyGetPropertyNotFoundResult;

export interface NodePropertyRemoveOkResult {
	kind: 'ok';
}

export interface NodePropertyRemoveNodeNotFoundResult {
	kind: 'node_not_found';
}

export interface NodePropertyRemovePropertyNotFoundResult {
	kind: 'property_not_found';
}

export type NodePropertyRemoveResult =
	| NodePropertyRemoveOkResult
	| NodePropertyRemoveNodeNotFoundResult
	| NodePropertyRemovePropertyNotFoundResult;

export class NodeService {
	configService: ConfigService;
	nodeSyncService: NodeSyncService;
	repos: Map<string, NodeRepo>;
	vfs: Vfs;

	constructor(vfs: Vfs, configService: ConfigService, nodeSyncService: NodeSyncService) {
		this.configService = configService;
		this.nodeSyncService = nodeSyncService;
		this.repos = new Map();
		this.vfs = vfs;
	}

	async addTag(environment: Environment, nodeId: string, tag: string): Promise<boolean> {
		await this.nodeSyncService.ensureLocalState(environment);

		const normalizedTag = normalizeNodeTag(tag);
		const repo = await this.openRepo(environment);
		const currentNode = repo.get(nodeId);

		if (currentNode === null) {
			return false;
		}

		repo.transaction(() => {
			repo.addTag(nodeId, normalizedTag);
			repo.createEvent(
				createNodeEvent(NodeEventAction.AddTag, nodeId, {
					tags: [normalizedTag],
				}),
			);
		});

		return true;
	}

	async close(): Promise<void> {
		for (const repo of this.repos.values()) {
			repo.close();
		}

		this.repos.clear();
	}

	async create(environment: Environment, input: CreateNodeInput): Promise<NodeModel> {
		await this.nodeSyncService.ensureLocalState(environment);

		const now = new Date().toISOString();
		const repo = await this.openRepo(environment);
		const node = createNodeModel(input, now);

		if (repo.get(node.id) !== null) {
			throw new Error(`node "${node.id}" already exists`);
		}

		if (repo.getByPublicIp(node.public_ip) !== null) {
			throw new Error(`node public_ip "${node.public_ip}" already exists`);
		}

		repo.transaction(() => {
			repo.create(node);
			repo.createEvent(
				createNodeEvent(NodeEventAction.Create, node.id, {
					id: node.id,
				}),
			);
		});

		return node;
	}

	async get(environment: Environment, nodeId: string): Promise<{ node: NodeModel; tags: string[] } | null> {
		await this.nodeSyncService.ensureLocalState(environment);

		const repo = await this.openRepo(environment);
		const node = repo.get(nodeId);

		if (node === null) {
			return null;
		}

		return {
			node,
			tags: repo.listTags(nodeId),
		};
	}

	async getProperty(environment: Environment, nodeId: string, propertyKey: string): Promise<NodePropertyGetResult> {
		await this.nodeSyncService.ensureLocalState(environment);

		const normalizedPropertyKey = parseNodePropertyKey(propertyKey);
		const repo = await this.openRepo(environment);
		const node = repo.get(nodeId);

		if (node === null) {
			return {
				kind: 'node_not_found',
			};
		}

		if (normalizedPropertyKey === 'hostname') {
			if (node.hostname === null) {
				return {
					kind: 'property_not_found',
				};
			}

			return {
				kind: 'ok',
				value: node.hostname,
			};
		}

		if (normalizedPropertyKey === 'private_ip') {
			if (node.private_ip === null) {
				return {
					kind: 'property_not_found',
				};
			}

			return {
				kind: 'ok',
				value: node.private_ip,
			};
		}

		const value = node.properties[normalizedPropertyKey];

		if (value === undefined) {
			return {
				kind: 'property_not_found',
			};
		}

		return {
			kind: 'ok',
			value,
		};
	}

	async list(environment: Environment, tags: string[]): Promise<ListNodesResultItem[]> {
		await this.nodeSyncService.ensureLocalState(environment);

		const repo = await this.openRepo(environment);
		const normalizedTags = tags.map((tag) => normalizeNodeTag(tag));

		return repo.list(normalizedTags).map((item) => toListNodesResultItem(item));
	}

	async listEvents(environment: Environment, nodeId: string | null): Promise<NodeEventModel[]> {
		await this.nodeSyncService.ensureLocalState(environment);

		const repo = await this.openRepo(environment);

		return repo.listEvents(nodeId);
	}

	async remove(environment: Environment, nodeId: string): Promise<boolean> {
		await this.nodeSyncService.ensureLocalState(environment);

		const repo = await this.openRepo(environment);
		const currentNode = repo.get(nodeId);

		if (currentNode === null) {
			return false;
		}

		repo.transaction(() => {
			repo.createEvent(
				createNodeEvent(NodeEventAction.Remove, nodeId, {
					id: nodeId,
				}),
			);
			repo.remove(nodeId);
		});

		return true;
	}

	async removeProperty(
		environment: Environment,
		nodeId: string,
		propertyKey: string,
	): Promise<NodePropertyRemoveResult> {
		await this.nodeSyncService.ensureLocalState(environment);

		const normalizedPropertyKey = parseNodePropertyKey(propertyKey);

		if (!isMutableNodePropertyKey(normalizedPropertyKey)) {
			throw new Error(`node property "${normalizedPropertyKey}" is immutable`);
		}

		const repo = await this.openRepo(environment);
		const currentNode = repo.get(nodeId);

		if (currentNode === null) {
			return {
				kind: 'node_not_found',
			};
		}

		if (normalizedPropertyKey === 'hostname') {
			if (currentNode.hostname === null) {
				return {
					kind: 'property_not_found',
				};
			}

			repo.transaction(() => {
				currentNode.hostname = null;
				currentNode.update_date = new Date().toISOString();
				repo.update(currentNode);
				repo.createEvent(
					createNodeEvent(NodeEventAction.RemoveProperty, nodeId, {
						items: {
							hostname: null,
						},
					}),
				);
			});

			return {
				kind: 'ok',
			};
		}

		if (normalizedPropertyKey === 'private_ip') {
			if (currentNode.private_ip === null) {
				return {
					kind: 'property_not_found',
				};
			}

			repo.transaction(() => {
				currentNode.private_ip = null;
				currentNode.update_date = new Date().toISOString();
				repo.update(currentNode);
				repo.createEvent(
					createNodeEvent(NodeEventAction.RemoveProperty, nodeId, {
						items: {
							private_ip: null,
						},
					}),
				);
			});

			return {
				kind: 'ok',
			};
		}

		if (currentNode.properties[normalizedPropertyKey] === undefined) {
			return {
				kind: 'property_not_found',
			};
		}

		const nextProperties = { ...currentNode.properties };

		delete nextProperties[normalizedPropertyKey];

		repo.transaction(() => {
			currentNode.properties = nextProperties;
			currentNode.update_date = new Date().toISOString();
			repo.update(currentNode);
			repo.createEvent(
				createNodeEvent(NodeEventAction.RemoveProperty, nodeId, {
					items: {
						[normalizedPropertyKey]: null,
					},
				}),
			);
		});

		return {
			kind: 'ok',
		};
	}

	async removeTag(environment: Environment, nodeId: string, tag: string): Promise<boolean> {
		await this.nodeSyncService.ensureLocalState(environment);

		const normalizedTag = normalizeNodeTag(tag);
		const repo = await this.openRepo(environment);
		const currentNode = repo.get(nodeId);

		if (currentNode === null) {
			return false;
		}

		repo.transaction(() => {
			repo.removeTag(nodeId, normalizedTag);
			repo.createEvent(
				createNodeEvent(NodeEventAction.RemoveTag, nodeId, {
					tags: [normalizedTag],
				}),
			);
		});

		return true;
	}

	async setProperty(
		environment: Environment,
		nodeId: string,
		propertyKey: string,
		value: NodePropertyValue,
	): Promise<NodePropertyValue | null> {
		await this.nodeSyncService.ensureLocalState(environment);

		const normalizedPropertyKey = parseNodePropertyKey(propertyKey);

		if (!isMutableNodePropertyKey(normalizedPropertyKey)) {
			throw new Error(`node property "${normalizedPropertyKey}" is immutable`);
		}

		const repo = await this.openRepo(environment);
		const currentNode = repo.get(nodeId);

		if (currentNode === null) {
			return null;
		}

		if (normalizedPropertyKey === 'hostname' || normalizedPropertyKey === 'private_ip') {
			if (typeof value !== 'string') {
				throw new Error(`node property "${normalizedPropertyKey}" requires a string value`);
			}

			repo.transaction(() => {
				if (normalizedPropertyKey === 'hostname') {
					currentNode.hostname = value;
				} else {
					currentNode.private_ip = value;
				}

				currentNode.update_date = new Date().toISOString();
				repo.update(currentNode);
				repo.createEvent(
					createNodeEvent(NodeEventAction.SetProperty, nodeId, {
						items: {
							[normalizedPropertyKey]: value,
						},
					}),
				);
			});

			return value;
		}

		repo.transaction(() => {
			currentNode.properties = {
				...currentNode.properties,
				[normalizedPropertyKey]: value,
			};
			currentNode.update_date = new Date().toISOString();
			repo.update(currentNode);
			repo.createEvent(
				createNodeEvent(NodeEventAction.SetProperty, nodeId, {
					items: {
						[normalizedPropertyKey]: value,
					},
				}),
			);
		});

		return value;
	}

	async setStatus(environment: Environment, nodeId: string, status: NodeStatus): Promise<NodeModel | null> {
		await this.nodeSyncService.ensureLocalState(environment);

		const repo = await this.openRepo(environment);
		const currentNode = repo.get(nodeId);

		if (currentNode === null) {
			return null;
		}

		repo.transaction(() => {
			currentNode.status = status;
			currentNode.update_date = new Date().toISOString();
			repo.update(currentNode);
			repo.createEvent(
				createNodeEvent(NodeEventAction.SetStatus, nodeId, {
					new: status,
					prev: currentNode.status,
				}),
			);
		});

		return currentNode;
	}

	async stateClear(environment: Environment): Promise<void> {
		this.closeRepo(environment.id);
		await this.nodeSyncService.clear(environment);
	}

	async statePull(environment: Environment): Promise<void> {
		await this.nodeSyncService.pull(environment);
	}

	async stateSave(environment: Environment): Promise<NodeStoreSaveResult> {
		return this.nodeSyncService.save(environment);
	}

	private closeRepo(environmentId: string): void {
		const repo = this.repos.get(environmentId);

		if (repo === undefined) {
			return;
		}

		repo.close();
		this.repos.delete(environmentId);
	}

	private async openRepo(environment: Environment): Promise<NodeRepo> {
		const currentRepo = this.repos.get(environment.id);

		if (currentRepo !== undefined) {
			return currentRepo;
		}

		const config = await this.configService.get();
		const localStorePath = createNodeStoreWorkPath(config.work_path, environment.id);
		const localDirectoryPath = path.dirname(localStorePath);

		await this.vfs.ensureDirectory(localDirectoryPath);

		const db = new DbClient(this.vfs.resolve(localStorePath));
		const repo = NodeRepo.open(db);

		this.repos.set(environment.id, repo);

		return repo;
	}
}
