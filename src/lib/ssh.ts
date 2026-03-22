import cp from 'node:child_process';

export interface GenerateSshKeyPairOptions {
	comment: string;
	passphrase: string;
	privateKeyPath: string;
}

export class SshKeygen {
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
}
