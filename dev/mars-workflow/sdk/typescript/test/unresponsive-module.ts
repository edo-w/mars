import { createInterface } from "node:readline";
import { stdin, stdout } from "node:process";

const input = createInterface({ input: stdin, crlfDelay: Infinity });
for await (const line of input) {
	const request = JSON.parse(line) as { id: string; type: string };
	if (request.type !== "describe") {
		continue;
	}

	const response = {
		v: 1,
		id: request.id,
		type: "ret",
		status: "ok",
		output: { module: "fixture/unresponsive", exports: [] },
	};
	stdout.write(`${JSON.stringify(response)}\n`);
}
