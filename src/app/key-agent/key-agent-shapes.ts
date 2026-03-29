import os from 'node:os';
import * as z from 'zod';
import { EncryptedSecretRecord } from '#src/app/secrets/secrets-shapes';
import { KeyAgentState } from '#src/app/state/state-shapes';
import type { RequestMessage, ResponseMessage } from '#src/lib/json-rpc';

export const KEY_AGENT_STARTUP_DELAYS = [100, 200, 400, 800, 1600];
export const KEY_AGENT_IDLE_TIMEOUT_MS = 5 * 60 * 1000;
export const KEY_AGENT_REQUEST_TIMEOUT_MS = 1000;
export const KEY_AGENT_SHUTDOWN_TIMEOUT_MS = 5 * 1000;

export class KeyAgentPingRequest {
	static schema = z.object({
		token: z.string().min(1),
		type: z.literal('ping'),
	});

	token: string;
	type: 'ping';

	constructor(fields: unknown) {
		const parsed = KeyAgentPingRequest.schema.parse(fields);

		this.token = parsed.token;
		this.type = parsed.type;
	}
}

export class KeyAgentEncryptRequest {
	static schema = z.object({
		environment: z.string().min(1),
		plaintext: z.string().min(1),
		token: z.string().min(1),
		type: z.literal('encrypt'),
	});

	environment: string;
	plaintext: string;
	token: string;
	type: 'encrypt';

	constructor(fields: unknown) {
		const parsed = KeyAgentEncryptRequest.schema.parse(fields);

		this.environment = parsed.environment;
		this.plaintext = parsed.plaintext;
		this.token = parsed.token;
		this.type = parsed.type;
	}
}

export class KeyAgentDecryptRequest {
	static schema = z.object({
		encrypted_secret: EncryptedSecretRecord.schema,
		environment: z.string().min(1),
		token: z.string().min(1),
		type: z.literal('decrypt'),
	});

	encrypted_secret: EncryptedSecretRecord;
	environment: string;
	token: string;
	type: 'decrypt';

	constructor(fields: unknown) {
		const parsed = KeyAgentDecryptRequest.schema.parse(fields);

		this.encrypted_secret = new EncryptedSecretRecord(parsed.encrypted_secret);
		this.environment = parsed.environment;
		this.token = parsed.token;
		this.type = parsed.type;
	}
}

export class KeyAgentShutdownRequest {
	static schema = z.object({
		token: z.string().min(1),
		type: z.literal('shutdown'),
	});

	token: string;
	type: 'shutdown';

	constructor(fields: unknown) {
		const parsed = KeyAgentShutdownRequest.schema.parse(fields);

		this.token = parsed.token;
		this.type = parsed.type;
	}
}

export type KeyAgentRequest =
	| KeyAgentPingRequest
	| KeyAgentEncryptRequest
	| KeyAgentDecryptRequest
	| KeyAgentShutdownRequest;

export class KeyAgentPingResponse {
	static schema = z.object({
		ok: z.literal(true),
		type: z.literal('ping'),
	});

	ok: true;
	type: 'ping';

	constructor(fields: unknown) {
		const parsed = KeyAgentPingResponse.schema.parse(fields);

		this.ok = parsed.ok;
		this.type = parsed.type;
	}
}

export class KeyAgentEncryptResponse {
	static schema = z.object({
		encrypted_secret: EncryptedSecretRecord.schema,
		ok: z.literal(true),
		type: z.literal('encrypt'),
	});

	encrypted_secret: EncryptedSecretRecord;
	ok: true;
	type: 'encrypt';

	constructor(fields: unknown) {
		const parsed = KeyAgentEncryptResponse.schema.parse(fields);

		this.encrypted_secret = new EncryptedSecretRecord(parsed.encrypted_secret);
		this.ok = parsed.ok;
		this.type = parsed.type;
	}
}

export class KeyAgentDecryptResponse {
	static schema = z.object({
		ok: z.literal(true),
		plaintext: z.string().min(1),
		type: z.literal('decrypt'),
	});

	ok: true;
	plaintext: string;
	type: 'decrypt';

	constructor(fields: unknown) {
		const parsed = KeyAgentDecryptResponse.schema.parse(fields);

		this.ok = parsed.ok;
		this.plaintext = parsed.plaintext;
		this.type = parsed.type;
	}
}

export class KeyAgentShutdownResponse {
	static schema = z.object({
		ok: z.literal(true),
		type: z.literal('shutdown'),
	});

	ok: true;
	type: 'shutdown';

	constructor(fields: unknown) {
		const parsed = KeyAgentShutdownResponse.schema.parse(fields);

		this.ok = parsed.ok;
		this.type = parsed.type;
	}
}

export class KeyAgentErrorResponse {
	static schema = z.object({
		error: z.string().min(1),
		ok: z.literal(false),
		type: z.enum(['decrypt', 'encrypt', 'ping', 'shutdown', 'unknown']),
	});

	error: string;
	ok: false;
	type: 'decrypt' | 'encrypt' | 'ping' | 'shutdown' | 'unknown';

	constructor(fields: unknown) {
		const parsed = KeyAgentErrorResponse.schema.parse(fields);

		this.error = parsed.error;
		this.ok = parsed.ok;
		this.type = parsed.type;
	}
}

export type KeyAgentResponse =
	| KeyAgentPingResponse
	| KeyAgentEncryptResponse
	| KeyAgentDecryptResponse
	| KeyAgentShutdownResponse
	| KeyAgentErrorResponse;

export interface KeyAgentShowRunningResult {
	key_agent: KeyAgentState;
	kind: 'running';
}

export interface KeyAgentShowStoppedResult {
	kind: 'stopped';
}

export type KeyAgentShowResult = KeyAgentShowRunningResult | KeyAgentShowStoppedResult;

export interface KeyAgentPingOkResult {
	kind: 'ok';
}

export interface KeyAgentPingFailedResult {
	error: string;
	kind: 'failed';
}

export interface KeyAgentPingNotRunningResult {
	kind: 'not_running';
}

export type KeyAgentPingResult = KeyAgentPingOkResult | KeyAgentPingFailedResult | KeyAgentPingNotRunningResult;

export interface KeyAgentStartRunningResult {
	key_agent: KeyAgentState;
	kind: 'running';
}

export interface KeyAgentStartStartedResult {
	key_agent: KeyAgentState;
	kind: 'started';
}

export interface KeyAgentStartTimeoutResult {
	kind: 'timeout';
}

export type KeyAgentStartResult = KeyAgentStartRunningResult | KeyAgentStartStartedResult | KeyAgentStartTimeoutResult;

export interface KeyAgentStopStoppedResult {
	key_agent: KeyAgentState;
	kind: 'stopped';
}

export interface KeyAgentStopNotRunningResult {
	kind: 'not_running';
}

export type KeyAgentStopResult = KeyAgentStopStoppedResult | KeyAgentStopNotRunningResult;

export function createKeyAgentState(pid: number): KeyAgentState {
	const token = crypto.randomUUID();
	const randomId = crypto.randomUUID();
	const socket = createSocketPath(randomId);

	return new KeyAgentState({
		pid,
		socket,
		token,
	});
}

export function createSocketPath(randomId: string): string {
	if (process.platform === 'win32') {
		return `\\\\.\\pipe\\mars-key-agent-${randomId}`;
	}

	return `${os.tmpdir()}/mars-key-agent-${randomId}.sock`;
}

export function isRequestMessage(fields: unknown): fields is RequestMessage {
	const isObject = typeof fields === 'object' && fields !== null;

	if (!isObject) {
		return false;
	}

	const hasToken = 'token' in fields && typeof fields.token === 'string';
	const hasType = 'type' in fields && typeof fields.type === 'string';

	return hasToken && hasType;
}

export function isResponseMessage(fields: unknown): fields is ResponseMessage {
	const isObject = typeof fields === 'object' && fields !== null;

	if (!isObject) {
		return false;
	}

	const hasOk = 'ok' in fields && typeof fields.ok === 'boolean';
	const hasType = 'type' in fields && typeof fields.type === 'string';

	if (!hasOk || !hasType) {
		return false;
	}

	if (fields.ok) {
		return true;
	}

	return 'error' in fields && typeof fields.error === 'string';
}
