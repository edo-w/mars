import path from 'node:path';
import type { ConfigService } from '#src/cli/app/config/config-service';
import { createDefaultMarsState, type KeyAgentState, MarsState } from '#src/cli/app/state/state-shapes';
import { normalizePath } from '#src/lib/fs';
import type { Vfs } from '#src/lib/vfs';

export class StateService {
	configService: ConfigService;
	vfs: Vfs;

	constructor(vfs: Vfs, configService: ConfigService) {
		this.configService = configService;
		this.vfs = vfs;
	}

	async clearKeyAgentIfMatches(pid: number, token: string): Promise<void> {
		const state = await this.readState();
		const keyAgent = state.key_agent;

		if (keyAgent === null) {
			return;
		}

		const pidMatches = keyAgent.pid === pid;
		const tokenMatches = keyAgent.token === token;

		if (!pidMatches || !tokenMatches) {
			return;
		}

		await this.setKeyAgent(null);
	}

	async getKeyAgent(): Promise<KeyAgentState | null> {
		const state = await this.readState();

		return state.key_agent;
	}

	async getSelectedEnvironmentPath(): Promise<string | null> {
		const state = await this.readState();

		return state.selected_environment;
	}

	async readState(): Promise<MarsState> {
		const stateFilePath = await this.getStateFilePath();

		if (!(await this.vfs.fileExists(stateFilePath))) {
			return createDefaultMarsState();
		}

		const stateContents = await this.vfs.readTextFile(stateFilePath);
		const stateFields = JSON.parse(stateContents) as unknown;

		return new MarsState(stateFields);
	}

	async setKeyAgent(keyAgent: KeyAgentState | null): Promise<void> {
		const state = await this.readState();

		await this.writeState(
			new MarsState({
				key_agent: keyAgent,
				selected_environment: state.selected_environment,
			}),
		);
	}

	async setSelectedEnvironmentPath(selectedEnvironmentPath: string): Promise<void> {
		const state = await this.readState();

		await this.writeState(
			new MarsState({
				key_agent: state.key_agent,
				selected_environment: normalizePath(selectedEnvironmentPath),
			}),
		);
	}

	private async getStateFilePath(): Promise<string> {
		const config = await this.configService.get();

		return path.posix.join(normalizePath(config.work_path), 'state.json');
	}

	private async writeState(state: MarsState): Promise<void> {
		const stateFilePath = await this.getStateFilePath();
		const stateContents = `${JSON.stringify(state, null, 2)}\n`;

		await this.vfs.writeTextFile(stateFilePath, stateContents);
	}
}
