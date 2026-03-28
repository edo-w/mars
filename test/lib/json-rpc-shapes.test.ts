import assert from 'node:assert/strict';
import { test } from 'vitest';
import { isRequestMessage, isResponseMessage, MessageEnvelope } from '#src/lib/json-rpc';

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

test('isRequestMessage returns true for a valid request message', () => {
	const requestMessage = {
		token: 'token',
		type: 'ping',
	};
	const result = isRequestMessage(requestMessage);

	assert.equal(result, true);
});

test('isRequestMessage returns false for an invalid request message', () => {
	const requestMessage = {
		type: 'ping',
	};
	const result = isRequestMessage(requestMessage);

	assert.equal(result, false);
});

test('isResponseMessage returns true for an ok response message', () => {
	const responseMessage = {
		ok: true,
		type: 'ping',
	};
	const result = isResponseMessage(responseMessage);

	assert.equal(result, true);
});

test('isResponseMessage returns true for an error response message', () => {
	const responseMessage = {
		error: 'boom',
		ok: false,
		type: 'ping',
	};
	const result = isResponseMessage(responseMessage);

	assert.equal(result, true);
});

test('isResponseMessage returns false when an error response is missing the error text', () => {
	const responseMessage = {
		ok: false,
		type: 'ping',
	};
	const result = isResponseMessage(responseMessage);

	assert.equal(result, false);
});
