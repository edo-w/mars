import type { Environment } from '#src/app/environment/environment-shapes';
import {
	type PlaybookModel,
	PlaybookRunResultModel,
	type PlaybookSshClient,
	type PlaybookSshIdentity,
	type PlaybookTargetNode,
	type PlaybookTaskContext,
	type PlaybookTaskNodeResultModel,
	PlaybookTaskNodeResultModel as PlaybookTaskNodeResultRecord,
	type PlaybookTaskResultModel,
	PlaybookTaskStatus,
	type PlaybookTaskWaveResultModel,
	PlaybookTaskWaveResultModel as PlaybookTaskWaveResultRecord,
} from '#src/app/playbook/playbook-models';
import {
	createPlaybookConnectionOptions,
	createPlaybookEndEvent,
	createPlaybookStartEvent,
	createTaskNodeEndEvent,
	createTaskNodeProgressEvent,
	createTaskNodeStartEvent,
	createTaskWaveEndEvent,
	createTaskWaveStartEvent,
	type PlaybookEvent,
	readPlaybookNodeIds,
} from '#src/app/playbook/playbook-shapes';
import { isPlaybookConnectionLostError, type PlaybookSshClientFactory } from '#src/app/playbook/playbook-ssh-client';
import type { PlaybookTaskHandlerFactory } from '#src/app/playbook/playbook-task-handler-factory';

interface PlaybookNodeRunnerState {
	client: PlaybookSshClient;
	failed: boolean;
	hasChange: boolean;
	node: PlaybookTargetNode;
}

export class PlaybookRun {
	environment: Environment;
	eventListeners: Array<(event: PlaybookEvent) => void>;
	playbook: PlaybookModel;
	resultPromise: Promise<PlaybookRunResultModel> | null;
	sshClientFactory: PlaybookSshClientFactory;
	sshIdentity: PlaybookSshIdentity;
	targetNodes: PlaybookTargetNode[];
	taskHandlerFactory: PlaybookTaskHandlerFactory;

	constructor(
		environment: Environment,
		playbook: PlaybookModel,
		targetNodes: PlaybookTargetNode[],
		sshIdentity: PlaybookSshIdentity,
		sshClientFactory: PlaybookSshClientFactory,
		taskHandlerFactory: PlaybookTaskHandlerFactory,
	) {
		this.environment = environment;
		this.eventListeners = [];
		this.playbook = playbook;
		this.resultPromise = null;
		this.sshClientFactory = sshClientFactory;
		this.sshIdentity = sshIdentity;
		this.targetNodes = targetNodes;
		this.taskHandlerFactory = taskHandlerFactory;
	}

	onEvent(listener: (event: PlaybookEvent) => void): () => void {
		this.eventListeners.push(listener);

		return () => {
			this.eventListeners = this.eventListeners.filter((currentListener) => currentListener !== listener);
		};
	}

	result(): Promise<PlaybookRunResultModel> {
		if (this.resultPromise === null) {
			this.resultPromise = this.run();
		}

		return this.resultPromise;
	}

	private emitEvent(event: PlaybookEvent): void {
		for (const listener of this.eventListeners) {
			listener(event);
		}
	}

	private async ensureNodeConnection(nodeState: PlaybookNodeRunnerState): Promise<void> {
		if (nodeState.client.isConnected()) {
			return;
		}

		await nodeState.client.connect(createPlaybookConnectionOptions(nodeState.node.node), this.sshIdentity);
	}

	private createFailResult(
		nodeId: string,
		taskId: number,
		taskName: string,
		message: string,
		duration: number,
	): PlaybookTaskNodeResultModel {
		return new PlaybookTaskNodeResultRecord({
			duration,
			message,
			node_id: nodeId,
			ok: false,
			output: null,
			status: PlaybookTaskStatus.Fail,
			stderr: '',
			stdout: '',
			task_id: taskId,
			task_name: taskName,
		});
	}

	private createSkipResult(nodeId: string, taskId: number, taskName: string): PlaybookTaskNodeResultModel {
		return new PlaybookTaskNodeResultRecord({
			duration: 0,
			message: 'skipped due to previous task failure',
			node_id: nodeId,
			ok: false,
			output: null,
			status: PlaybookTaskStatus.Skip,
			stderr: '',
			stdout: '',
			task_id: taskId,
			task_name: taskName,
		});
	}

	private createNodeResult(
		nodeId: string,
		taskId: number,
		taskName: string,
		duration: number,
		taskResult: PlaybookTaskResultModel,
	): PlaybookTaskNodeResultModel {
		return new PlaybookTaskNodeResultRecord({
			duration,
			message: taskResult.message,
			node_id: nodeId,
			ok: taskResult.ok,
			output: taskResult.output,
			status: taskResult.status,
			stderr: taskResult.stderr,
			stdout: taskResult.stdout,
			task_id: taskId,
			task_name: taskName,
		});
	}

	private createFinalNodeResults(nodeStates: PlaybookNodeRunnerState[]): PlaybookTaskNodeResultModel[] {
		return nodeStates.map((nodeState) => {
			const status = nodeState.failed
				? PlaybookTaskStatus.Fail
				: nodeState.hasChange
					? PlaybookTaskStatus.Change
					: PlaybookTaskStatus.Ok;

			return new PlaybookTaskNodeResultRecord({
				duration: 0,
				message: null,
				node_id: nodeState.node.node.id,
				ok: status === PlaybookTaskStatus.Ok || status === PlaybookTaskStatus.Change,
				output: null,
				status,
				stderr: '',
				stdout: '',
				task_id: 0,
				task_name: this.playbook.name,
			});
		});
	}

	private async run(): Promise<PlaybookRunResultModel> {
		const startDate = new Date().toISOString();
		const nodeStates = this.targetNodes.map((targetNode) => {
			return {
				client: this.sshClientFactory.create(),
				failed: false,
				hasChange: false,
				node: targetNode,
			};
		});
		const waveResults: PlaybookTaskWaveResultModel[] = [];

		this.emitEvent(createPlaybookStartEvent(this.playbook, readPlaybookNodeIds(this.targetNodes), startDate));

		try {
			for (const [index, task] of this.playbook.tasks.entries()) {
				const step = index + 1;
				const total = this.playbook.tasks.length;
				const eligibleNodeStates = nodeStates.filter((nodeState) => !nodeState.failed);
				const skippedNodeStates = nodeStates.filter((nodeState) => nodeState.failed);
				const waveStartedAt = Date.now();

				this.emitEvent(
					createTaskWaveStartEvent(
						task.id,
						task.name,
						step,
						total,
						eligibleNodeStates.map((nodeState) => nodeState.node.node.id),
					),
				);

				const settledResults = await Promise.allSettled(
					eligibleNodeStates.map(async (nodeState) => {
						return this.runTaskOnNode(nodeState, task.id, task.type, task.name, task.input);
					}),
				);
				const nodeResults: PlaybookTaskNodeResultModel[] = settledResults.map((settledResult, resultIndex) => {
					const nodeState = eligibleNodeStates[resultIndex];

					if (nodeState === undefined) {
						throw new Error('missing node state');
					}

					if (settledResult.status === 'fulfilled') {
						return settledResult.value;
					}

					nodeState.failed = true;

					return this.createFailResult(
						nodeState.node.node.id,
						task.id,
						task.name,
						String(settledResult.reason),
						0,
					);
				});

				for (const skippedNodeState of skippedNodeStates) {
					const skipResult = this.createSkipResult(skippedNodeState.node.node.id, task.id, task.name);

					nodeResults.push(skipResult);
					this.emitEvent(createTaskNodeEndEvent(skipResult));
				}

				const waveResult = new PlaybookTaskWaveResultRecord({
					duration: Date.now() - waveStartedAt,
					node_results: nodeResults,
					step,
					task_id: task.id,
					task_name: task.name,
					total,
				});

				waveResults.push(waveResult);
				this.emitEvent(
					createTaskWaveEndEvent(task.id, task.name, step, total, waveResult.duration, nodeResults),
				);
			}
		} finally {
			await Promise.all(nodeStates.map(async (nodeState) => nodeState.client.close()));
		}

		const endDate = new Date().toISOString();
		const finalNodeResults = this.createFinalNodeResults(nodeStates);
		const playbookEndEvent = createPlaybookEndEvent(this.playbook, startDate, endDate, finalNodeResults);
		const runResult = new PlaybookRunResultModel({
			change_node_ids: playbookEndEvent.change_node_ids,
			duration: Date.parse(endDate) - Date.parse(startDate),
			end_date: endDate,
			fail_node_ids: playbookEndEvent.fail_node_ids,
			node_ids: readPlaybookNodeIds(this.targetNodes),
			ok_node_ids: playbookEndEvent.ok_node_ids,
			playbook_name: this.playbook.name,
			skip_node_ids: playbookEndEvent.skip_node_ids,
			start_date: startDate,
			task_results: waveResults,
		});

		this.emitEvent(playbookEndEvent);

		return runResult;
	}

	private async runTaskOnNode(
		nodeState: PlaybookNodeRunnerState,
		taskId: number,
		taskType: string,
		taskName: string,
		taskInput: Record<string, unknown>,
	): Promise<PlaybookTaskNodeResultModel> {
		const startDate = new Date().toISOString();

		this.emitEvent(createTaskNodeStartEvent(nodeState.node.node.id, taskId, taskName, startDate));

		for (let attempt = 0; attempt < 4; attempt += 1) {
			try {
				await this.ensureNodeConnection(nodeState);

				const taskHandler = this.taskHandlerFactory.create(taskType);
				const taskStartedAt = Date.now();
				const task = this.playbook.tasks[taskId];

				if (task === undefined) {
					throw new Error(`playbook task "${taskId}" not found`);
				}

				const taskContext: PlaybookTaskContext = {
					emitProgress: (fields) => {
						this.emitEvent(createTaskNodeProgressEvent(nodeState.node.node.id, taskId, taskName, fields));
					},
					environment: this.environment,
					node: nodeState.node.node,
					ssh: nodeState.client,
					task,
				};
				const taskResult = await taskHandler.run(taskContext, taskInput);
				const result = this.createNodeResult(
					nodeState.node.node.id,
					taskId,
					taskName,
					Date.now() - taskStartedAt,
					taskResult,
				);

				if (result.status === PlaybookTaskStatus.Fail) {
					nodeState.failed = true;
				}

				if (result.status === PlaybookTaskStatus.Change) {
					nodeState.hasChange = true;
				}

				this.emitEvent(createTaskNodeEndEvent(result));

				return result;
			} catch (error) {
				if (isPlaybookConnectionLostError(error) && attempt < 3) {
					await nodeState.client.close();
					nodeState.client = this.sshClientFactory.create();
					continue;
				}

				nodeState.failed = true;

				const result = this.createFailResult(
					nodeState.node.node.id,
					taskId,
					taskName,
					String(error),
					Date.now() - Date.parse(startDate),
				);

				this.emitEvent(createTaskNodeEndEvent(result));

				return result;
			}
		}

		throw new Error('unreachable');
	}
}
