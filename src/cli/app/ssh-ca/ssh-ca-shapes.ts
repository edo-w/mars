import path from 'node:path';

export const DEFAULT_SSH_CA_NAME = 'default';
export const SSH_CA_DIRECTORY = 'ssh/ca';
export const SSH_CA_S3_DIRECTORY = 'mars/ssh/ca';
export const SSH_CA_PRIVATE_KEY_SUFFIX = '_ca_ed25519.key';
export const SSH_CA_PUBLIC_KEY_SUFFIX = '_ca_ed25519.pub';

export interface SshCa {
	create_date: Date;
	name: string;
	private_key: string;
	public_key: string;
}

export interface SshCaResource {
	label: string;
}

export interface CreateSshCaAlreadyExistsResult {
	kind: 'already_exists';
	name: string;
}

export interface CreateSshCaCreatedResult {
	kind: 'created';
	ssh_ca: SshCa;
}

export type CreateSshCaResult = CreateSshCaAlreadyExistsResult | CreateSshCaCreatedResult;

export interface PullSshCaCorruptedResult {
	kind: 'corrupted';
	missing_files: string[];
	name: string;
}

export interface PullSshCaNotFoundResult {
	kind: 'not_found';
	name: string;
}

export interface PullSshCaPulledResult {
	kind: 'pulled';
	ssh_ca: SshCa;
}

export type PullSshCaResult = PullSshCaCorruptedResult | PullSshCaNotFoundResult | PullSshCaPulledResult;

export interface DestroySshCaDestroyedResult {
	kind: 'destroyed';
	resources: SshCaResource[];
}

export interface DestroySshCaNotFoundResult {
	kind: 'not_found';
	name: string;
}

export type DestroySshCaResult = DestroySshCaDestroyedResult | DestroySshCaNotFoundResult;

export function createSshCaPrivateKeyFileName(name: string): string {
	return `${name}${SSH_CA_PRIVATE_KEY_SUFFIX}`;
}

export function createSshCaPublicKeyFileName(name: string): string {
	return `${name}${SSH_CA_PUBLIC_KEY_SUFFIX}`;
}

export function createSshCaPrivateKeyLocalPath(workPath: string, name: string): string {
	return path.posix.join(workPath, SSH_CA_DIRECTORY, createSshCaPrivateKeyFileName(name));
}

export function createSshCaPublicKeyLocalPath(workPath: string, name: string): string {
	return path.posix.join(workPath, SSH_CA_DIRECTORY, createSshCaPublicKeyFileName(name));
}

export function createSshCaPrivateKeyS3Path(name: string): string {
	return path.posix.join(SSH_CA_S3_DIRECTORY, createSshCaPrivateKeyFileName(name));
}

export function createSshCaPublicKeyS3Path(name: string): string {
	return path.posix.join(SSH_CA_S3_DIRECTORY, createSshCaPublicKeyFileName(name));
}
