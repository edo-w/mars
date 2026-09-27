import assert from 'node:assert/strict';
import { test } from 'vitest';
import { PlaybookService } from '#src/app/playbook/playbook-service';
import { PlaybookSshClientFactory } from '#src/app/playbook/playbook-ssh-client';
import { PlaybookTaskHandlerFactory } from '#src/app/playbook/playbook-task-handler-factory';
import { PlaybookTaskRegistry } from '#src/app/playbook/playbook-task-registry';
import { Vfs } from '#src/lib/vfs';

test('PlaybookService loads a default-exported playbook file', async () => {
	const service = new PlaybookService(
		new Vfs(process.cwd()),
		{} as never,
		{} as never,
		{} as never,
		new PlaybookSshClientFactory(),
		new PlaybookTaskHandlerFactory(
			{ createScope: () => ({ get: () => ({}) }) } as never,
			new PlaybookTaskRegistry(),
		),
	);
	const playbook = await service.load('test/fixtures/playbooks/valid-playbook.ts');

	assert.equal(playbook.name, 'valid-playbook');
	assert.equal(playbook.tasks[0]?.type, 'echowait');
});

test('PlaybookService rejects playbook files without a default export', async () => {
	const service = new PlaybookService(
		new Vfs(process.cwd()),
		{} as never,
		{} as never,
		{} as never,
		new PlaybookSshClientFactory(),
		new PlaybookTaskHandlerFactory(
			{ createScope: () => ({ get: () => ({}) }) } as never,
			new PlaybookTaskRegistry(),
		),
	);

	await assert.rejects(async () => {
		await service.load('test/fixtures/playbooks/no-default-playbook.ts');
	});
});
