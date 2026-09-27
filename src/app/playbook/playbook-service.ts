import { pathToFileURL } from 'node:url';
import type { ConfigService } from '#src/app/config/config-service';
import type { Environment } from '#src/app/environment/environment-shapes';
import type { NodeService } from '#src/app/node/node-service';
import { PlaybookModel, type PlaybookTargetNode } from '#src/app/playbook/playbook-models';
import { PlaybookRun } from '#src/app/playbook/playbook-run';
import { createPlaybookRunCertificateIdentity, readPlaybookCaName } from '#src/app/playbook/playbook-shapes';
import type { PlaybookSshClientFactory } from '#src/app/playbook/playbook-ssh-client';
import type { PlaybookTaskHandlerFactory } from '#src/app/playbook/playbook-task-handler-factory';
import type { SshCaService } from '#src/app/ssh-ca/ssh-ca-service';
import type { Vfs } from '#src/lib/vfs';

interface PlaybookModuleLike {
	default?: unknown;
}

export class PlaybookService {
	configService: ConfigService;
	nodeService: NodeService;
	sshCaService: SshCaService;
	sshClientFactory: PlaybookSshClientFactory;
	taskHandlerFactory: PlaybookTaskHandlerFactory;
	vfs: Vfs;

	constructor(
		vfs: Vfs,
		configService: ConfigService,
		nodeService: NodeService,
		sshCaService: SshCaService,
		sshClientFactory: PlaybookSshClientFactory,
		taskHandlerFactory: PlaybookTaskHandlerFactory,
	) {
		this.configService = configService;
		this.nodeService = nodeService;
		this.sshCaService = sshCaService;
		this.sshClientFactory = sshClientFactory;
		this.taskHandlerFactory = taskHandlerFactory;
		this.vfs = vfs;
	}

	async load(playbookFilePath: string): Promise<PlaybookModel> {
		const playbookModule = (await import(
			pathToFileURL(this.vfs.resolve(playbookFilePath)).href
		)) as PlaybookModuleLike;

		if (playbookModule.default === undefined) {
			throw new Error(`playbook file "${playbookFilePath}" must default export a playbook`);
		}

		return new PlaybookModel(playbookModule.default);
	}

	async run(environment: Environment, playbookFilePath: string): Promise<PlaybookRun> {
		const playbook = await this.load(playbookFilePath);
		const targetNodes = await this.resolveTargetNodes(environment, playbook.targets.tags);

		if (targetNodes.length === 0) {
			throw new Error(`playbook "${playbook.name}" matched no nodes`);
		}

		const caNames = [...new Set(targetNodes.map((targetNode) => readPlaybookCaName(targetNode.node)))];

		if (caNames.length !== 1) {
			throw new Error('playbook target nodes must share the same ssh ca');
		}

		const sshIdentity = await this.sshCaService.issueClientIdentity(
			environment,
			caNames[0] ?? 'default',
			createPlaybookRunCertificateIdentity(environment, playbook.name),
		);

		return new PlaybookRun(
			environment,
			playbook,
			targetNodes,
			sshIdentity,
			this.sshClientFactory,
			this.taskHandlerFactory,
		);
	}

	private async resolveTargetNodes(environment: Environment, tags: string[]): Promise<PlaybookTargetNode[]> {
		try {
			return await this.nodeService.listTargets(environment, tags);
		} finally {
			await this.nodeService.close();
		}
	}
}
