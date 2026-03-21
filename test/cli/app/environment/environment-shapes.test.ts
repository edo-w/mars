import assert from 'node:assert/strict';
import { test } from 'vitest';
import { EnvironmentConfig } from '#src/cli/app/environment/environment-shapes';

test('EnvironmentConfig constructs from valid input', () => {
	const environment = new EnvironmentConfig({
		name: 'dev',
		namespace: 'gl',
		aws_account_id: '123456789012',
		aws_region: 'us-east-1',
	});

	assert.equal(environment.name, 'dev');
	assert.equal(environment.namespace, 'gl');
	assert.equal(environment.aws_account_id, '123456789012');
	assert.equal(environment.aws_region, 'us-east-1');
	assert.equal(environment.id, 'gl-dev');
});

test('EnvironmentConfig fails construction for invalid input', () => {
	assert.throws(() => {
		new EnvironmentConfig({
			name: 'dev',
			namespace: 'gl',
			aws_region: 'us-east-1',
		});
	});
});
