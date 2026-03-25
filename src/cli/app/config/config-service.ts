import { CONFIG_FILE, MarsConfig } from '#src/cli/app/config/config-shapes';
import type { Vfs } from '#src/lib/vfs';

export class ConfigService {
	config: MarsConfig | null;
	vfs: Vfs;

	constructor(vfs: Vfs) {
		this.config = null;
		this.vfs = vfs;
	}

	async get(): Promise<MarsConfig> {
		if (this.config !== null) {
			return this.config;
		}

		const configContents = await this.vfs.readTextFile(CONFIG_FILE);
		const configFields = JSON.parse(configContents) as unknown;
		const config = new MarsConfig(configFields);

		this.config = config;

		return config;
	}
}
