import assert from 'node:assert/strict';
import { Tiny } from '@edo-w/tiny';
import { test } from 'vitest';
import { createProgram } from '#src/cli/boot/cli';

interface CommandLike {
	commands: readonly CommandLike[];
	name(): string;
}

interface CommandTree {
	children: CommandTree[];
	name: string;
}

test('createProgram builds the Mars CLI command tree', () => {
	const program = createProgram(new Tiny());
	const commandTree = readCommandTree(program);

	assert.deepEqual(commandTree, {
		children: [
			{
				children: [],
				name: 'init',
			},
			{
				children: [
					{ children: [], name: 'list' },
					{ children: [], name: 'show' },
					{ children: [], name: 'create' },
					{ children: [], name: 'select' },
					{ children: [], name: 'bootstrap' },
					{ children: [], name: 'destroy' },
				],
				name: 'env',
			},
			{
				children: [
					{ children: [], name: 'ping' },
					{ children: [], name: 'show' },
					{ children: [], name: 'start' },
					{ children: [], name: 'stop' },
					{ children: [], name: 'serve' },
				],
				name: 'key-agent',
			},
			{
				children: [
					{ children: [], name: 'set' },
					{ children: [], name: 'get' },
					{ children: [], name: 'show' },
					{ children: [], name: 'list' },
					{ children: [], name: 'remove' },
					{
						children: [
							{ children: [], name: 'pull' },
							{ children: [], name: 'save' },
							{ children: [], name: 'clear' },
						],
						name: 'state',
					},
				],
				name: 'kv',
			},
			{
				children: [
					{
						children: [
							{ children: [], name: 'list' },
							{ children: [], name: 'show' },
							{ children: [], name: 'create' },
							{ children: [], name: 'destroy' },
							{ children: [], name: 'pull' },
							{ children: [], name: 'clear' },
						],
						name: 'ca',
					},
				],
				name: 'ssh',
			},
		],
		name: 'mars',
	});
});

function readCommandTree(command: CommandLike): CommandTree {
	const children = command.commands.map((childCommand) => {
		return readCommandTree(childCommand);
	});

	return {
		children,
		name: command.name(),
	};
}
