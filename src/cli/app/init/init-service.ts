import { getLogger } from '@logtape/logtape';
import { CONFIG_FILE, createDefaultMarsConfig, MarsConfig } from '#src/cli/boot/config';
import type { Vfs } from '#src/lib/vfs';

export class InitService {
	vfs: Vfs;

	constructor(vfs: Vfs) {
		this.vfs = vfs;
	}

	async init(): Promise<void> {
		const logger = getLogger(['mars', 'init']);
		let config = createDefaultMarsConfig();

		if (await this.vfs.fileExists(CONFIG_FILE)) {
			const configContents = await this.vfs.readTextFile(CONFIG_FILE);
			const configFields = JSON.parse(configContents) as unknown;

			config = new MarsConfig(configFields);
			logger.info(`skipped ${CONFIG_FILE} (already exists)`);
		} else {
			const configContents = `${JSON.stringify(config, null, 2)}\n`;

			await this.vfs.writeTextFile(CONFIG_FILE, configContents);
			logger.info(`created ${CONFIG_FILE}`);
		}

		if (await this.vfs.directoryExists(config.work_path)) {
			logger.info(`skipped ${config.work_path} (already exists)`);
			return;
		}

		await this.vfs.ensureDirectory(config.work_path);
		logger.info(`created ${config.work_path}`);
	}
}
