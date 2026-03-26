import Enquirer from 'enquirer';

export class Tui {
	async autocomplete(message: string, choices: string[]): Promise<string | null> {
		try {
			const result = await Enquirer.prompt<{ value: string }>({
				choices,
				message,
				name: 'value',
				type: 'autocomplete',
			});

			return result.value;
		} catch {
			return null;
		}
	}

	async input(message: string): Promise<string | null> {
		try {
			const result = await Enquirer.prompt<{ value: string }>({
				message,
				name: 'value',
				type: 'input',
			});

			return result.value;
		} catch {
			return null;
		}
	}

	async password(message: string): Promise<string | null> {
		try {
			const result = await Enquirer.prompt<{ value: string }>({
				message,
				name: 'value',
				type: 'password',
			});

			return result.value;
		} catch {
			return null;
		}
	}
}
