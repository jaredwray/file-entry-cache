const fs = require('node:fs');
const path = require('node:path');
const fileEntryCache = require('./cache.js');

const TEST_FILE_SIZE = 32;
const TEST_FILE_PATH = path.resolve(__dirname, '.perf.file');
const RUNS = 10_000;
const LOOPS = 5;
const TIMER_NAME = 'cache.hasFileChanged (' + TEST_FILE_SIZE + ' KB file, ' + RUNS + ' runs)';

for (let i = 0; i < LOOPS; i++) {
	const cache = fileEntryCache.createFromFile('.perfcache');
	fs.writeFileSync(TEST_FILE_PATH, Buffer.alloc(1024 * TEST_FILE_SIZE));

	console.time(TIMER_NAME);
	for (let index = 0; index < RUNS; index++) {
		cache.hasFileChanged(TEST_FILE_PATH);
	}

	console.timeEnd(TIMER_NAME);

	cache.deleteCacheFile();
	fs.unlinkSync(TEST_FILE_PATH);
}
