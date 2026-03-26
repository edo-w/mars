import util, { type InspectColor } from 'node:util';
import { getRotatingFileSink } from '@logtape/file';
import { configure, getConsoleSink, type LogLevel, type TextFormatter } from '@logtape/logtape';

interface LogParts {
	levelAbbr: string;
	levelColor: InspectColor;
	timeText: string;
	categoryText: string;
}

export const verboseFormatter: TextFormatter = (record) => {
	const logParts = createLogParts(record.level, record.timestamp, record.category);
	const timeText = util.styleText('gray', logParts.timeText);
	const levelText = util.styleText(logParts.levelColor, logParts.levelAbbr);
	const categoryText = util.styleText('gray', logParts.categoryText);

	return `${timeText} ${levelText} ${categoryText} ${record.message}`;
};

export const verboseFileFormatter: TextFormatter = (record) => {
	const logParts = createLogParts(record.level, record.timestamp, record.category);

	return `${logParts.timeText} ${logParts.levelAbbr} ${logParts.categoryText} ${record.message}\n`;
};

export const minimalFormatter: TextFormatter = (record) => {
	// const time = new Date(record.timestamp);
	// const hour = time.getHours().toString().padStart(2, '0');
	// const minute = time.getMinutes().toString().padStart(2, '0');
	// const second = time.getSeconds().toString().padStart(2, '0');
	// const millisecond = time.getMilliseconds().toString().padStart(3, '0');

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

	// const timeText = util.styleText('gray', `${hour}:${minute}:${second}.${millisecond}`);
	const separatorText = util.styleText(levelColor, '│');

	return `${separatorText} ${record.message}`;
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

export async function configureKeyAgentLogging(logFilePath: string): Promise<void> {
	await configure({
		reset: true,
		sinks: {
			console: getConsoleSink({
				formatter: verboseFormatter,
			}),
			file: getRotatingFileSink(logFilePath, {
				bufferSize: 0,
				formatter: verboseFileFormatter,
				flushInterval: 0,
				maxFiles: 3,
				maxSize: 1024 * 1024,
			}),
		},
		loggers: [
			{
				category: 'mars',
				sinks: ['console', 'file'],
				lowestLevel: 'info',
			},
			{
				category: ['logtape', 'meta'],
				sinks: ['console', 'file'],
				lowestLevel: 'error',
			},
		],
	});
}

function createLogParts(level: LogLevel, timestamp: number, category: readonly string[]): LogParts {
	const time = new Date(timestamp);
	const hour = time.getHours().toString().padStart(2, '0');
	const minute = time.getMinutes().toString().padStart(2, '0');
	const second = time.getSeconds().toString().padStart(2, '0');
	const millisecond = time.getMilliseconds().toString().padStart(3, '0');
	const timeText = `${hour}:${minute}:${second}.${millisecond}`;
	const categoryText = category.length > 0 ? category.join(':') : '';
	let levelColor: InspectColor = 'gray';
	let levelAbbr = 'NUL';

	switch (level) {
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

	return {
		levelAbbr,
		levelColor,
		timeText,
		categoryText,
	};
}
