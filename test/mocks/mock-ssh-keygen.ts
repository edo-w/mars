import type { GenerateSshKeyPairOptions, IssueSshCertificateOptions, SshKeygen } from '#src/lib/ssh';
import type { PublicLike } from '#src/lib/types';
import type { MockVfs } from '#test/mocks/mock-vfs';

type SshKeygenLike = PublicLike<SshKeygen>;

export class MockSshKeygen implements SshKeygenLike {
	lastAskpassToken: string | null;
	lastPassphrase: string | null;
	privateKeyContents: string;
	publicKeyContents: string;
	vfs: MockVfs;

	constructor(vfs: MockVfs) {
		this.lastAskpassToken = null;
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

	async issueCertificate(options: IssueSshCertificateOptions): Promise<void> {
		this.lastAskpassToken = options.askpass_token;
		const certificatePath = options.publicKeyPath.replace(/\.pub$/, '-cert.pub');

		this.vfs.setTextFile(certificatePath, 'CERTIFICATE');
	}
}
