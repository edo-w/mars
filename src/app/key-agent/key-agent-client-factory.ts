import { KeyAgentClient } from '#src/app/key-agent/key-agent-client';
import type { VTimer } from '#src/lib/vtimer';

export class KeyAgentClientFactory {
	vtimer: VTimer;

	constructor(vtimer: VTimer) {
		this.vtimer = vtimer;
	}

	create(socketPath: string): KeyAgentClient {
		return new KeyAgentClient(socketPath, this.vtimer);
	}
}
