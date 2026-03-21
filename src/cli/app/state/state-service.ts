import path from 'node:path';
import { createDefaultMarsState, MarsState } from '#src/cli/app/state/state-shapes';
import { readMarsConfig } from '#src/cli/boot/config';
import { normalizePath } from '#src/lib/fs';
import type { Vfs } from '#src/lib/vfs';

export class StateService {
	vfs: Vfs;

	constructor(vfs: Vfs) {
		this.vfs = vfs;
	}

	async getSelectedEnvironmentPath(): Promise<string | null> {
		const state = await this.readState();

		return state.selected_environment;
	}

	async setSelectedEnvironmentPath(selectedEnvironmentPath: string): Promise<void> {
		const stateFilePath = await this.getStateFilePath();
		const state = new MarsState({
			selected_environment: normalizePath(selectedEnvironmentPath),
		});
		const stateContents = `${JSON.stringify(state, null, 2)}\n`;

		await this.vfs.writeTextFile(stateFilePath, stateContents);
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

	async getStateFilePath(): Promise<string> {
		const config = await readMarsConfig(this.vfs);

		return path.posix.join(normalizePath(config.work_path), 'state.json');
	}
}
