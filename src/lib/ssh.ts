import cp from 'node:child_process';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { VProcess } from '#src/lib/vprocess';

export interface GenerateSshKeyPairOptions {
	comment: string;
	passphrase: string;
	privateKeyPath: string;
}

export interface IssueSshCertificateOptions {
	caPrivateKeyPath: string;
	certificateIdentity: string;
	askpass_token: string;
	principals: string[];
	publicKeyPath: string;
	validity: string;
}

export class SshKeygen {
	private readonly vprocess: VProcess;

	constructor(vprocess: VProcess) {
		this.vprocess = vprocess;
	}

	async generateKeyPair(options: GenerateSshKeyPairOptions): Promise<void> {
		const args = [
			'-q',
			'-t',
			'ed25519',
			'-f',
			options.privateKeyPath,
			'-N',
			options.passphrase,
			'-C',
			options.comment,
		];

		await new Promise<void>((resolve, reject) => {
			const child = cp.spawn('ssh-keygen', args, {
				stdio: 'ignore',
			});

			child.once('error', (error) => {
				reject(error);
			});
			child.once('exit', (code) => {
				if (code === 0) {
					resolve();
					return;
				}

				reject(new Error(`ssh-keygen exited with code ${code}`));
			});
		});
	}

	async issueCertificate(options: IssueSshCertificateOptions): Promise<void> {
		const askPassPath = await this.createAskPassLauncher();
		const args = [
			'-I',
			options.certificateIdentity,
			'-n',
			options.principals.join(','),
			'-s',
			options.caPrivateKeyPath,
			'-V',
			options.validity,
			options.publicKeyPath,
		];

		try {
			await new Promise<void>((resolve, reject) => {
				const child = cp.spawn('ssh-keygen', args, {
					env: {
						...this.vprocess.env(),
						DISPLAY: '1',
						SSH_ASKPASS: askPassPath,
						SSH_ASKPASS_REQUIRE: 'force',
						MARS_SSH_ASKPASS_TOKEN: options.askpass_token,
					},
					stdio: 'ignore',
					windowsHide: true,
				});

				child.once('error', (error) => {
					reject(error);
				});
				child.once('exit', (code) => {
					if (code === 0) {
						resolve();
						return;
					}

					reject(new Error(`ssh-keygen exited with code ${code}`));
				});
			});
		} finally {
			await fsp.rm(askPassPath, {
				force: true,
			});
		}
	}

	private async createAskPassLauncher(): Promise<string> {
		const invocation = this.vprocess.getProcessInvocation(['ssh', 'askpass', 'get']);

		if (this.vprocess.platform() === 'win32') {
			const filePath = path.join(os.tmpdir(), `mars-ssh-askpass-${crypto.randomUUID()}.cmd`);
			const command = [invocation.command, ...invocation.args, '%MARS_SSH_ASKPASS_TOKEN%']
				.map((part) => `"${part.replaceAll('"', '""')}"`)
				.join(' ');

			await fsp.writeFile(filePath, `@echo off\r\n${command}\r\n`, 'utf8');

			return filePath;
		}

		const filePath = path.join(os.tmpdir(), `mars-ssh-askpass-${crypto.randomUUID()}.sh`);
		const command = [invocation.command, ...invocation.args]
			.map((part) => `'${part.replaceAll("'", "'\"'\"'")}'`)
			.join(' ');
		const contents = `#!/bin/sh\nexec ${command} "$MARS_SSH_ASKPASS_TOKEN"\n`;

		await fsp.writeFile(filePath, contents, {
			encoding: 'utf8',
			mode: 0o700,
		});

		return filePath;
	}
}
