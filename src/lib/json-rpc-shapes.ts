import * as z from 'zod';

const jsonMessageSchema = z.object({}).catchall(z.unknown());

export class MessageEnvelope {
	static schema = z.object({
		id: z.number().int().positive(),
		message: jsonMessageSchema,
	});

	id: number;
	message: Record<string, unknown>;

	constructor(fields: unknown) {
		const parsed = MessageEnvelope.schema.parse(fields);

		this.id = parsed.id;
		this.message = parsed.message;
	}
}

export interface RequestMessage {
	token: string;
	type: string;
}

export interface ResponseOkMessage {
	ok: true;
	type: string;
}

export interface ResponseErrorMessage {
	error: string;
	ok: false;
	type: string;
}

export type ResponseMessage = ResponseErrorMessage | ResponseOkMessage;

export interface JsonRpcServerErrorEvent {
	error: unknown;
	socket_id: number | null;
}

export interface JsonRpcServerMessageEvent {
	envelope_id: number;
	message: Record<string, unknown>;
	socket_id: number;
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
