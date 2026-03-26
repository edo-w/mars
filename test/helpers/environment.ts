import { EnvironmentConfig } from '#src/cli/app/environment/environment-shapes';

export function createEnvironment() {
	const config = new EnvironmentConfig({
		aws_account_id: '123',
		aws_region: 'us-east-1',
		name: 'dev',
		namespace: 'gl',
	});

	return {
		config,
		configPath: 'infra/envs/dev/environment.yml',
		directoryPath: 'infra/envs/dev',
		id: config.id,
		selected: false,
	};
}
