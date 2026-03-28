import type { GenerateSshKeyPairOptions, SshKeygen } from '#src/lib/ssh';
import type { PublicLike } from '#src/lib/types';
import type { MockVfs } from '#test/mocks/mock-vfs';

type SshKeygenLike = PublicLike<SshKeygen>;

export class MockSshKeygen implements SshKeygenLike {
	lastPassphrase: string | null;
	privateKeyContents: string;
	publicKeyContents: string;
	vfs: MockVfs;

	constructor(vfs: MockVfs) {
		this.lastPassphrase = null;
		this.privateKeyContents = 'PRIVATE KEY';
		this.publicKeyContents = 'PUBLIC KEY';
		this.vfs = vfs;
	}

	async generateKeyPair(options: GenerateSshKeyPairOptions): Promise<void> {
		this.lastPassphrase = options.passphrase;
		const publicKeyPath = options.privateKeyPath.endsWith('.key')
			? options.privateKeyPath.replace(/\.key$/, '.pub')
			: `${options.privateKeyPath}.pub`;

		this.vfs.setTextFile(options.privateKeyPath, this.privateKeyContents);
		this.vfs.setTextFile(publicKeyPath, this.publicKeyContents);
	}
}
