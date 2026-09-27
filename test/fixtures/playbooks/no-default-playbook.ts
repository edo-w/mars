import { definePlaybook, echowait, selectNodes } from '#src/app/playbook/playbook-api';

export const playbook = definePlaybook({
	name: 'no-default-playbook',
	targets: selectNodes({
		tags: ['web'],
	}),
	tasks: [echowait('prepare', [['step 1', 1]])],
});
