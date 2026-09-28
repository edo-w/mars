import { createInterface } from "node:readline";
import { stdin, stdout, stderr } from "node:process";
import type { LineTransport } from "./index";

export class StdioTransport implements LineTransport {
	async *read(): AsyncIterable<string> {
		const reader = createInterface({ input: stdin, crlfDelay: Infinity });
		for await (const line of reader) {
			yield line;
		}
	}

	async write(line: string): Promise<void> {
		await new Promise<void>((resolve, reject) => {
			stdout.write(`${line}\n`, (error) => {
				if (error) reject(error);
				else resolve();
			});
		});
	}

	log(line: string): void {
		stderr.write(`${line}\n`);
	}
}
