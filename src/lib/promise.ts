export async function sleep(delayMs: number): Promise<void> {
	await new Promise<void>((resolve) => {
		setTimeout(resolve, delayMs);
	});
}
