import { createInterface } from "node:readline";
import { stdin, stdout } from "node:process";

const input = createInterface({ input: stdin, crlfDelay: Infinity });
for await (const line of input) {
	const request = JSON.parse(line) as { id: string };
	const response = {
		v: 1,
		id: request.id,
		type: "ret",
		status: "ok",
		output: { module: "fixture/duplicate", exports: [] },
	};
	stdout.write(`${JSON.stringify(response)}\n`);
	stdout.write(`${JSON.stringify(response)}\n`);
}
