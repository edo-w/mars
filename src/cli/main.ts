import { createProgram } from '#src/cli/boot/cli';
import { createContainer } from '#src/cli/boot/container';
import { configureLogging } from '#src/cli/boot/logging';

async function main(): Promise<void> {
	try {
		await configureLogging();
		const container = createContainer({
			cwd: process.cwd(),
		});

		const program = createProgram(container);

		await program.parseAsync(process.argv);
	} catch (error) {
		console.error(error);
		process.exit(1);
	}
}

await main();
