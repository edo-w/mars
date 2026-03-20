import util, { type InspectColor } from 'node:util';
import { configure, getConsoleSink, type TextFormatter } from '@logtape/logtape';

export const verboseFormatter: TextFormatter = (record) => {
	const time = new Date(record.timestamp);
	const hour = time.getHours().toString().padStart(2, '0');
	const minute = time.getMinutes().toString().padStart(2, '0');
	const second = time.getSeconds().toString().padStart(2, '0');
	const millisecond = time.getMilliseconds().toString().padStart(3, '0');

	let levelColor: InspectColor = 'gray';
	let levelAbbr = 'NUL';

	switch (record.level) {
		case 'debug': {
			levelColor = 'blue';
			levelAbbr = 'DBG';
			break;
		}
		case 'trace': {
			levelColor = 'cyan';
			levelAbbr = 'TRX';
			break;
		}
		case 'info': {
			levelColor = 'green';
			levelAbbr = 'INF';
			break;
		}
		case 'warning': {
			levelColor = 'yellow';
			levelAbbr = 'WRN';
			break;
		}
		case 'error': {
			levelColor = 'red';
			levelAbbr = 'ERR';
			break;
		}
		case 'fatal': {
			levelColor = 'magenta';
			levelAbbr = 'FTL';
			break;
		}
	}

	const timeText = util.styleText('gray', `${hour}:${minute}:${second}.${millisecond}`);
	const levelText = util.styleText(levelColor, levelAbbr);
	let categoryText = record.category.length > 0 ? record.category.join(':') : '';

	categoryText = util.styleText('gray', categoryText);

	return `${timeText} ${levelText} ${categoryText} ${record.message}`;
};

export const minimalFormatter: TextFormatter = (record) => {
	const time = new Date(record.timestamp);
	const hour = time.getHours().toString().padStart(2, '0');
	const minute = time.getMinutes().toString().padStart(2, '0');
	const second = time.getSeconds().toString().padStart(2, '0');
	const millisecond = time.getMilliseconds().toString().padStart(3, '0');

	let levelColor: InspectColor = 'gray';

	switch (record.level) {
		case 'debug': {
			levelColor = 'blue';
			break;
		}
		case 'trace': {
			levelColor = 'cyan';
			break;
		}
		case 'info': {
			levelColor = 'green';
			break;
		}
		case 'warning': {
			levelColor = 'yellow';
			break;
		}
		case 'error': {
			levelColor = 'red';
			break;
		}
		case 'fatal': {
			levelColor = 'magenta';
			break;
		}
	}

	const timeText = util.styleText('gray', `${hour}:${minute}:${second}.${millisecond}`);
	const separatorText = util.styleText(levelColor, '|');

	return `${timeText} ${separatorText} ${record.message}`;
};

export async function configureLogging(): Promise<void> {
	await configure({
		reset: true,
		sinks: {
			console: getConsoleSink({
				formatter: minimalFormatter,
			}),
		},
		loggers: [
			{
				category: 'mars',
				sinks: ['console'],
				lowestLevel: 'info',
			},
			{
				category: ['logtape', 'meta'],
				sinks: ['console'],
				lowestLevel: 'error',
			},
		],
	});
}
