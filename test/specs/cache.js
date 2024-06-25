/* eslint-disable import/order, prefer-rest-params,no-unused-expressions, no-undef  */
const path = require('node:path');
const {expect} = require('chai');
const write = require('write').sync;
const fs = require('node:fs');
const fileEntryCache = require('../../cache.js');

function expand() {
	return Reflect.apply(require('glob-expand'), null, arguments)
		.map(file => file.split('/').join(path.sep));
}

function deleteFileSync(filePath) {
	if (fs.existsSync(filePath)) {
		const stats = fs.statSync(filePath);

		if (stats.isDirectory()) {
			// Recursively delete directory contents
			for (const file of fs.readdirSync(filePath)) {
				const currentPath = path.join(filePath, file);
				deleteFileSync(currentPath);
			}

			// Delete the directory itself
			fs.rmdirSync(filePath);
		} else {
			// Delete file
			fs.unlinkSync(filePath);
		}
	}
}

const fixturesDir = path.resolve(__dirname, '../fixtures');

const fixtureFiles = [
	{
		name: 'f1.txt',
		content: 'some content 1',
	},
	{
		name: 'f2.txt',
		content: 'some content 2',
	},
	{
		name: 'f3.txt',
		content: 'some content 3',
	},
	{
		name: 'f4.txt',
		content: 'some content 4',
	},
];

let cache;

const delCacheAndFiles = function () {
	deleteFileSync(fixturesDir);
	cache && cache.deleteCacheFile();
};

const createFixtureFiles = function () {
	for (const f of fixtureFiles) {
		write(path.resolve(fixturesDir, f.name), f.content);
	}
};

describe('file-entry-cache', () => {
	beforeEach(() => {
		delCacheAndFiles();
		createFixtureFiles();
	});

	afterEach(() => {
		delCacheAndFiles();
	});

	describe('hasFileChanged', () => {
		it('should determine if a file has changed since last time reconcile was called', () => {
			cache = fileEntryCache.createFromFile('../fixtures/.eslintcache', true);

			const file = path.resolve(__dirname, '../fixtures/f4.txt');

			// Not called yet reconcile so all the files passed will be returned as changed
			// provided that the file actually exists
			expect(cache.hasFileChanged(file)).to.be.true;

			// Since reconcile has not being called this should be true
			expect(cache.hasFileChanged(file)).to.be.true;

			cache.reconcile();

			// Since reconcile was called then this should be false
			expect(cache.hasFileChanged(file)).to.be.false;

			// Attempt to do a modification
			write(file, 'some other content');

			expect(cache.hasFileChanged(file)).to.be.true;

			cache.reconcile();

			expect(cache.hasFileChanged(file)).to.be.false;
		});

		it('should consider file unchanged even with different mtime', () => {
			const file = path.resolve(__dirname, '../fixtures/f4.txt');
			cache = fileEntryCache.createFromFile('../fixtures/.eslintcache', true);

			cache.hasFileChanged(file);
			cache.reconcile();
			delCacheAndFiles();
			createFixtureFiles();
			expect(cache.hasFileChanged(file)).to.be.false;
		});
	});

	it('should create a file entry cache using a file path', () => {
		cache = fileEntryCache.createFromFile('../fixtures/.eslintcache');
		const fs = require('node:fs');
		const files = expand(path.resolve(__dirname, '../fixtures/*.txt'));
		const oFiles = cache.getUpdatedFiles(files);

		expect(oFiles).to.deep.equal(files);

		expect(fs.existsSync('../fixtures/.eslintcache')).to.be.false;

		cache.reconcile();

		expect(fs.existsSync('../fixtures/.eslintcache')).to.be.true;

		cache.destroy();

		expect(fs.existsSync('../fixtures/.eslintcache')).to.be.false;
	});

	it('should return the array of files passed the first time since there was no cache created', () => {
		cache = fileEntryCache.create('testCache');

		const files = expand(path.resolve(__dirname, '../fixtures/*.txt'));
		let oFiles = cache.getUpdatedFiles(files);

		expect(oFiles).to.deep.equal(files);

		cache.reconcile();

		oFiles = cache.getUpdatedFiles(files);

		expect(oFiles).to.deep.equal([]);
	});

	it('should return none, if no files were modified', () => {
		cache = fileEntryCache.create('testCache');

		const files = expand(path.resolve(__dirname, '../fixtures/*.txt'));
		let oFiles = cache.getUpdatedFiles(files);

		expect(oFiles).to.deep.equal(files);

		cache.reconcile();

		oFiles = cache.getUpdatedFiles(files);
		expect(oFiles).to.deep.equal([]);

		cache.deleteCacheFile();
	});

	it('should return only modified files the second time the method is called', () => {
		cache = fileEntryCache.create('testCache');

		const files = expand(path.resolve(__dirname, '../fixtures/*.txt'));
		let oFiles = cache.getUpdatedFiles(files);

		expect(oFiles).to.deep.equal(files);

		cache.reconcile();

		// Modify a file
		write(path.resolve(fixturesDir, fixtureFiles[1].name), fixtureFiles[1].content + 'modified!!!');

		cache = fileEntryCache.create('testCache');

		oFiles = cache.getUpdatedFiles(files);

		expect(oFiles).to.deep.equal([path.resolve(__dirname, '../fixtures/f2.txt')]);

		cache.deleteCacheFile();
	});

	it('should allow to delete an entry from the cache so the next time `getUpdatedFiles` is called the entry will be considered modified', () => {
		cache = fileEntryCache.create('testCache');

		const files = expand(path.resolve(__dirname, '../fixtures/*.txt'));
		let oFiles = cache.getUpdatedFiles(files);

		expect(oFiles).to.deep.equal(files);

		cache.removeEntry(path.resolve(__dirname, '../fixtures/f1.txt'));

		cache.reconcile();

		// Modify a file
		write(path.resolve(fixturesDir, fixtureFiles[1].name), fixtureFiles[1].content + 'modified!!!');

		cache = fileEntryCache.create('testCache');

		oFiles = cache.getUpdatedFiles(files);

		expect(oFiles).to.deep.equal([
			path.resolve(__dirname, '../fixtures/f1.txt'),
			path.resolve(__dirname, '../fixtures/f2.txt'),
		]);

		cache.deleteCacheFile();
	});

	it('should not fail if an array is not passed to the `getChangedFiles` method', () => {
		cache = fileEntryCache.create('testCache2');
		const files = cache.getUpdatedFiles(null);
		cache.reconcile();
		expect(files).to.deep.equal([]);
	});

	it('should not fail if calling reconcile without a prior call to `getChangedFiles` or `normalizeEntries`', () => {
		cache = fileEntryCache.create('testCache2');

		expect(() => {
			cache.reconcile();
		}).not.to.throw;
	});

	describe('normalizeEntries', () => {
		it('should return fileDescriptor for all the passed files when using normalizeEntries', () => {
			cache = fileEntryCache.create('testCache');

			const files = expand(path.resolve(__dirname, '../fixtures/*.txt'));
			const oFiles = cache.normalizeEntries(files);

			expect(oFiles.length).to.equal(4);
			for (const file of oFiles) {
				expect(file.changed).to.be.true;
			}
		});

		it('should not remove non visited entries from the cache', () => {
			cache = fileEntryCache.create('testCache');

			const files = expand(path.resolve(__dirname, '../fixtures/*.txt'));
			cache.normalizeEntries(files);

			cache.reconcile();

			// The f2.txt file is in the cache
			expect(cache.cache.getKey(path.resolve(__dirname, '../fixtures/f2.txt'))).to.not.equal(undefined);

			// Load the cache again
			cache = fileEntryCache.create('testCache');

			// When recently loaded all entries are in the cache
			expect(cache.cache.keys().length).to.equal(4);

			// We check only one file
			expect(cache.hasFileChanged(path.resolve(__dirname, '../fixtures/f4.txt'))).to.be.false;

			cache.reconcile();

			// After reconcile we will only have 1 key because we just visited one entry
			expect(cache.cache.getKey(path.resolve(__dirname, '../fixtures/f2.txt'))).to.not.equal(undefined);
			expect(cache.cache.keys().length).to.equal(4);
		});

		it('should not persist files that do not exist', () => {
			cache = fileEntryCache.create('testCache');

			const files = expand(path.resolve(__dirname, '../fixtures/*.txt'));
			cache.normalizeEntries(files);

			deleteFileSync(path.resolve(__dirname, '../fixtures/f2.txt'));

			cache.reconcile();

			// The f2.txt file is in the cache
			expect(cache.cache.getKey(path.resolve(__dirname, '../fixtures/f2.txt'))).to.equal(undefined);

			// Now delete the entry
			deleteFileSync(path.resolve(__dirname, '../fixtures/f3.txt'));

			// Load the cache again
			cache = fileEntryCache.create('testCache');

			// When recently loaded all entries that exists are in the cache, f3 should not be there
			expect(cache.cache.keys().length).to.equal(2);

			expect(cache.cache.getKey(path.resolve(__dirname, '../fixtures/f3.txt'))).to.equal(undefined);

			// We check only one file
			expect(cache.hasFileChanged(path.resolve(__dirname, '../fixtures/f4.txt'))).to.be.false;

			cache.reconcile();

			expect(cache.cache.keys().length).to.equal(2);
		});

		it('should return fileDescriptor for all the passed files', () => {
			cache = fileEntryCache.create('testCache');

			const files = expand(path.resolve(__dirname, '../fixtures/*.txt'));
			let oFiles = cache.normalizeEntries(files);

			cache.reconcile();

			// Modify a file
			write(path.resolve(fixturesDir, fixtureFiles[2].name), fixtureFiles[2].content + 'modified!!!');

			oFiles = cache.normalizeEntries(files);

			expect(oFiles.length).to.equal(4);

			const changedFile = oFiles.find(entry => entry.changed);

			expect(changedFile.key).to.contains(fixtureFiles[2].name);
		});

		it('should not fail if a null array of files is passed', () => {
			cache = fileEntryCache.create('testCache');
			const oFiles = cache.normalizeEntries(null);
			expect(oFiles).to.deep.equal([]);
		});
	});

	describe('saving custom metadata', () => {
		let cache2;
		afterEach(() => {
			cache2 && cache2.deleteCacheFile();
		});

		it('should allow persist custom data in the entries', () => {
			cache = fileEntryCache.create('cache-1');

			const files = expand(path.resolve(__dirname, '../fixtures/*.txt'));
			let entries = cache.normalizeEntries(files);

			entries[1].meta.data = {foo: 'bar'};
			entries[2].meta.data = {
				baz: {
					some: 'foo',
				},
			};

			cache.reconcile();

			cache2 = fileEntryCache.create('cache-1');
			entries = cache2.normalizeEntries(files);

			expect(entries[1].meta.data.foo).to.equal('bar');
			expect(entries[2].meta.data.baz).to.deep.equal({
				some: 'foo',
			});
		});
	});

	describe('getFileDescriptor', () => {
		it('should tell when file known to the cache is not found anymore ', () => {
			const file = path.resolve(__dirname, '../fixtures/', fixtureFiles[0].name);
			cache = fileEntryCache.createFromFile('../fixtures/.eslintcache');

			cache.getFileDescriptor(file);
			cache.reconcile();
			deleteFileSync(file);
			expect(cache.getFileDescriptor(file).notFound).to.be.true;
		});
	});

	describe('analyzeFiles', () => {
		it('should return correct information about files ', () => {
			const filenames = fixtureFiles.map(fixtureFile => path.resolve(__dirname, '../fixtures/', fixtureFile.name));
			const expectedBeforeChanges = {
				changedFiles: filenames,
				notFoundFiles: [],
				notChangedFiles: [],
			};
			const expectedAfterChanges = {
				changedFiles: [filenames[0]],
				notFoundFiles: [filenames[1]],
				notChangedFiles: [filenames[2], filenames[3]],
			};
			cache = fileEntryCache.createFromFile('../fixtures/.eslintcache');

			expect(cache.analyzeFiles(filenames)).to.deep.equal(expectedBeforeChanges);
			cache.reconcile();

			write(filenames[0], 'everybody can change');
			deleteFileSync(filenames[1]);

			expect(cache.analyzeFiles(filenames)).to.deep.equal(expectedAfterChanges);
		});
	});

	describe('handling no valid buffer on cache', () => {
		it('should error when not valid and set buffer to nothing', () => {
			const newCache = require('../../cache.js').create('testCache1');
			const result = newCache._getFileDescriptorUsingChecksum('foo');
			expect(result.key).to.equal('foo');
		});
	});

	describe('throwing on reconcile', () => {
		it('should throw on reconcile when not ENOENT', () => {
			const newCache = fileEntryCache.create('cache-1');

			const files = expand(path.resolve(__dirname, '../fixtures/*.txt'));
			newCache.normalizeEntries(files);

			newCache._getMetaForFileUsingMtimeAndSize = function () {
				const error = new Error('BAM');
				error.code = 'BAM';
				throw error;
			};

			let error;

			try {
				newCache.reconcile();
			} catch (error_) {
				error = error_;
			}

			expect(error).to.not.equal(undefined);
		});
	});

	describe('handling relative paths', () => {
		it('getFileDescriptor with relative paths', () => {
			const absoluteFile = path.resolve(__dirname, '../fixtures/', fixtureFiles[0].name);
			const relativeFile = path.relative(process.cwd(), absoluteFile); // Test/fixtures/f1.txt
			cache = fileEntryCache.createFromFile('../fixtures/.eslintcache');
			expect(cache.getFileDescriptor(absoluteFile).changed).to.be.true;
			expect(cache.getFileDescriptor(relativeFile).changed).to.be.true;
		});

		it('removeEntry with relative paths', () => {
			const absoluteFile = path.resolve(__dirname, '../fixtures/', fixtureFiles[0].name);
			const relativeFile = path.relative(process.cwd(), absoluteFile); // Test/fixtures/f1.txt
			cache = fileEntryCache.createFromFile('../fixtures/.eslintcache');
			cache.removeEntry(relativeFile);
			cache.reconcile();
			expect(cache.hasFileChanged(relativeFile)).to.be.true;
		});

		it('should set the cwd to the cache', () => {
			cache = fileEntryCache.createFromFile('../fixtures/.eslintcache', true);
			expect(cache.relativePath).to.equal(process.cwd());
		});

		it('should set the cwd to the cache to any file path', () => {
			cache = fileEntryCache.createFromFile('../fixtures/.eslintcache', true, 'foo/path/bar');
			expect(cache.relativePath).to.equal('foo/path/bar');
		});

		it('getFileDescriptor with set relative path', () => {
			const absoluteFile = path.resolve(__dirname, '../fixtures/', fixtureFiles[0].name);
			const relativeFile = path.relative(process.cwd(), absoluteFile); // Test/fixtures/f1.txt
			cache = fileEntryCache.createFromFile('../fixtures/.eslintcache', true, 'foo/path/bar');
			const result = cache.getFileDescriptor(relativeFile);
			expect(result.notFound).to.be.true;
		});
	});
});
