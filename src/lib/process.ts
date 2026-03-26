export function forceKill(pid: number): void {
	if (process.platform === 'win32') {
		process.kill(pid);
		return;
	}

	process.kill(pid, 'SIGKILL');
}

export function isProcessAlive(pid: number): boolean {
	try {
		process.kill(pid, 0);

		return true;
	} catch {
		return false;
	}
}
