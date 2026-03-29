import * as z from 'zod';
import { AES_GCM_ALGORITHM } from '#src/app/secrets/secrets-shapes';

export enum KvDataType {
	Text = 'text',
	File = 'file',
}

export enum KvPendingBlobOperation {
	Upload = 'upload',
	Delete = 'delete',
}

export class KvSecretConfigModel {
	static schema = z.object({
		algorithm: z.literal(AES_GCM_ALGORITHM),
		iv: z.string().min(1),
	});

	algorithm: 'AES-GCM';
	iv: string;

	constructor(fields: unknown) {
		const parsed = KvSecretConfigModel.schema.parse(fields);

		this.algorithm = parsed.algorithm;
		this.iv = parsed.iv;
	}
}

export class KvKeyModel {
	static schema = z.object({
		create_date: z.string().min(1),
		key_path: z.string().min(1),
		update_date: z.string().min(1),
	});

	create_date: string;
	key_path: string;
	update_date: string;

	constructor(fields: unknown) {
		const parsed = KvKeyModel.schema.parse(fields);

		this.create_date = parsed.create_date;
		this.key_path = parsed.key_path;
		this.update_date = parsed.update_date;
	}
}

export class KvKeyVersionModel {
	static schema = z.object({
		create_date: z.string().min(1),
		data_blob_id: z.string().min(1).nullable(),
		data_content: z.instanceof(Uint8Array).nullable(),
		data_size: z.number().int().nonnegative(),
		data_type: z.enum(KvDataType),
		key_path: z.string().min(1),
		secret_config: KvSecretConfigModel.schema.nullable(),
		version_id: z.number().int().nonnegative(),
	});

	create_date: string;
	data_blob_id: string | null;
	data_content: Uint8Array | null;
	data_size: number;
	data_type: KvDataType;
	key_path: string;
	secret_config: KvSecretConfigModel | null;
	version_id: number;

	constructor(fields: unknown) {
		const parsed = KvKeyVersionModel.schema.parse(fields);

		this.create_date = parsed.create_date;
		this.data_blob_id = parsed.data_blob_id;
		this.data_content = parsed.data_content;
		this.data_size = parsed.data_size;
		this.data_type = parsed.data_type;
		this.key_path = parsed.key_path;
		this.secret_config = parsed.secret_config === null ? null : new KvSecretConfigModel(parsed.secret_config);
		this.version_id = parsed.version_id;
	}
}

export class KvPendingBlobModel {
	static schema = z.object({
		key_path: z.string().min(1),
		local_path: z.string().min(1),
		operation: z.enum(KvPendingBlobOperation),
	});

	key_path: string;
	local_path: string;
	operation: KvPendingBlobOperation;

	constructor(fields: unknown) {
		const parsed = KvPendingBlobModel.schema.parse(fields);

		this.key_path = parsed.key_path;
		this.local_path = parsed.local_path;
		this.operation = parsed.operation;
	}
}

export class KvCurrentValueModel {
	static schema = z.object({
		create_date: z.string().min(1),
		data_blob_id: z.string().min(1).nullable(),
		data_content: z.instanceof(Uint8Array).nullable(),
		data_size: z.number().int().nonnegative(),
		data_type: z.enum(KvDataType),
		key_path: z.string().min(1),
		secret: z.boolean(),
		secret_config: KvSecretConfigModel.schema.nullable(),
		update_date: z.string().min(1),
		version_create_date: z.string().min(1),
		version_id: z.number().int().nonnegative(),
	});

	create_date: string;
	data_blob_id: string | null;
	data_content: Uint8Array | null;
	data_size: number;
	data_type: KvDataType;
	key_path: string;
	secret: boolean;
	secret_config: KvSecretConfigModel | null;
	update_date: string;
	version_create_date: string;
	version_id: number;

	constructor(fields: unknown) {
		const parsed = KvCurrentValueModel.schema.parse(fields);

		this.create_date = parsed.create_date;
		this.data_blob_id = parsed.data_blob_id;
		this.data_content = parsed.data_content;
		this.data_size = parsed.data_size;
		this.data_type = parsed.data_type;
		this.key_path = parsed.key_path;
		this.secret = parsed.secret;
		this.secret_config = parsed.secret_config === null ? null : new KvSecretConfigModel(parsed.secret_config);
		this.update_date = parsed.update_date;
		this.version_create_date = parsed.version_create_date;
		this.version_id = parsed.version_id;
	}
}

export class KvListEntryModel {
	static schema = z.object({
		data_size: z.number().int().nonnegative(),
		data_type: z.enum(KvDataType),
		key_path: z.string().min(1),
		secret: z.boolean(),
		update_date: z.string().min(1),
		version_id: z.number().int().nonnegative(),
	});

	data_size: number;
	data_type: KvDataType;
	key_path: string;
	secret: boolean;
	update_date: string;
	version_id: number;

	constructor(fields: unknown) {
		const parsed = KvListEntryModel.schema.parse(fields);

		this.data_size = parsed.data_size;
		this.data_type = parsed.data_type;
		this.key_path = parsed.key_path;
		this.secret = parsed.secret;
		this.update_date = parsed.update_date;
		this.version_id = parsed.version_id;
	}
}
