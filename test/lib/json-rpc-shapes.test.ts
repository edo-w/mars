import assert from 'node:assert/strict';
import { test } from 'vitest';
import { MessageEnvelope } from '#src/lib/json-rpc-shapes';

test('MessageEnvelope constructs from valid input', () => {
	const envelope = new MessageEnvelope({
		id: 1,
		message: {
			type: 'ping',
		},
	});

	assert.equal(envelope.id, 1);
});

test('MessageEnvelope rejects invalid input', () => {
	assert.throws(() => {
		return new MessageEnvelope({
			id: 0,
			message: {
				type: 'ping',
			},
		});
	});
});
