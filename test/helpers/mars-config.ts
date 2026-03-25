import { toJsonText } from '#test/helpers/json';

export function toMarsConfigText(fields: Record<string, unknown> = {}): string {
	return toJsonText({
		namespace: 'gl',
		envs_path: 'infra/envs',
		work_path: '.mars',
		backend: {
			s3: {
				bucket: '{env}-infra-{aws_account_id}',
			},
		},
		secrets: {
			password: {},
		},
		...fields,
	});
}
