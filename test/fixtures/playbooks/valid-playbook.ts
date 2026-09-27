import { definePlaybook, echowait, selectNodes } from '#src/app/playbook/playbook-api';

export default definePlaybook({
	name: 'valid-playbook',
	targets: selectNodes({
		tags: ['web'],
	}),
	tasks: [echowait('prepare', [['step 1', 1]])],
});
