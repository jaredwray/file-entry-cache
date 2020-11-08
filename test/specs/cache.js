var expect = require('chai').expect;
var path = require('path');
var write = require('write').sync;
var fileEntryCache = require('../../cache');

function expand() {
  return require('glob-expand')
    .apply(null, arguments)
    .map(function (file) {
      return file.split('/').join(path.sep);
    });
}

var fixturesDir = path.resolve(__dirname, '../fixtures');
var del = require('del').sync;

var fixtureFiles = [
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

var cache;

var delCacheAndFiles = function () {
  del(fixturesDir, { force: true });
  cache && cache.deleteCacheFile();
};

var createFixtureFiles = function () {
  fixtureFiles.forEach(function (f) {
    write(path.resolve(fixturesDir, f.name), f.content);
  });
};

describe('file-entry-cache', function () {
  beforeEach(function () {
    delCacheAndFiles();
    createFixtureFiles();
  });

  afterEach(function () {
    delCacheAndFiles();
  });

  describe('hasFileChanged', function () {
    it('should determine if a file has changed since last time reconcile was called', function () {
      cache = fileEntryCache.createFromFile('../fixtures/.eslintcache', true);

      var file = path.resolve(__dirname, '../fixtures/f4.txt');

      // not called yet reconcile so all the files passed will be returned as changed
      // provided that the file actually exists
      expect(cache.hasFileChanged(file)).to.be.true;

      // since reconcile has not being called this should be true
      expect(cache.hasFileChanged(file)).to.be.true;

      cache.reconcile();

      // since reconcile was called then this should be false
      expect(cache.hasFileChanged(file)).to.be.false;

      // attempt to do a modification
      write(file, 'some other content');

      expect(cache.hasFileChanged(file)).to.be.true;

      cache.reconcile();

      expect(cache.hasFileChanged(file)).to.be.false;
    });

    it('should consider file unchanged even with different mtime', function () {
      var file = path.resolve(__dirname, '../fixtures/f4.txt');
      cache = fileEntryCache.createFromFile('../fixtures/.eslintcache', true);

      cache.hasFileChanged(file);
      cache.reconcile();
      delCacheAndFiles();
      createFixtureFiles();
      expect(cache.hasFileChanged(file)).to.be.false;
    });
  });

  it('should create a file entry cache using a file path', function () {
    cache = fileEntryCache.createFromFile('../fixtures/.eslintcache');
    var fs = require('fs');
    var files = expand(path.resolve(__dirname, '../fixtures/*.txt'));
    var oFiles = cache.getUpdatedFiles(files);

    expect(oFiles).to.deep.equal(files);

    expect(fs.existsSync('../fixtures/.eslintcache')).to.be.false;

    cache.reconcile();

    expect(fs.existsSync('../fixtures/.eslintcache')).to.be.true;

    cache.destroy();

    expect(fs.existsSync('../fixtures/.eslintcache')).to.be.false;
  });

  it('should return the array of files passed the first time since there was no cache created', function () {
    cache = fileEntryCache.create('testCache');

    var files = expand(path.resolve(__dirname, '../fixtures/*.txt'));
    var oFiles = cache.getUpdatedFiles(files);

    expect(oFiles).to.deep.equal(files);
  });

  it('should return none, if no files were modified', function () {
    cache = fileEntryCache.create('testCache');

    var files = expand(path.resolve(__dirname, '../fixtures/*.txt'));
    var oFiles = cache.getUpdatedFiles(files);

    expect(oFiles).to.deep.equal(files);

    cache.reconcile();

    oFiles = cache.getUpdatedFiles(files);
    expect(oFiles).to.deep.equal([]);

    cache.deleteCacheFile();
  });

  it('should return only modified files the second time the method is called', function () {
    cache = fileEntryCache.create('testCache');

    var files = expand(path.resolve(__dirname, '../fixtures/*.txt'));
    var oFiles = cache.getUpdatedFiles(files);

    expect(oFiles).to.deep.equal(files);

    cache.reconcile();

    // modify a file
    write(path.resolve(fixturesDir, fixtureFiles[1].name), fixtureFiles[1].content + 'modified!!!');

    cache = fileEntryCache.create('testCache');

    oFiles = cache.getUpdatedFiles(files);

    expect(oFiles).to.deep.equal([path.resolve(__dirname, '../fixtures/f2.txt')]);

    cache.deleteCacheFile();
  });

  it('should allow to delete an entry from the cache so the next time `getUpdatedFiles` is called the entry will be considered modified', function () {
    cache = fileEntryCache.create('testCache');

    var files = expand(path.resolve(__dirname, '../fixtures/*.txt'));
    var oFiles = cache.getUpdatedFiles(files);

    expect(oFiles).to.deep.equal(files);

    cache.removeEntry(path.resolve(__dirname, '../fixtures/f1.txt'));

    cache.reconcile();

    // modify a file
    write(path.resolve(fixturesDir, fixtureFiles[1].name), fixtureFiles[1].content + 'modified!!!');

    cache = fileEntryCache.create('testCache');

    oFiles = cache.getUpdatedFiles(files);

    expect(oFiles).to.deep.equal([
      path.resolve(__dirname, '../fixtures/f1.txt'),
      path.resolve(__dirname, '../fixtures/f2.txt'),
    ]);

    cache.deleteCacheFile();
  });

  it('should not fail if an array is not passed to the `getChangedFiles` method', function () {
    cache = fileEntryCache.create('testCache2');
    var files = cache.getUpdatedFiles(null);
    cache.reconcile();
    expect(files).to.deep.equal([]);
  });

  it('should not fail if calling reconcile without a prior call to `getChangedFiles` or `normalizeEntries`', function () {
    cache = fileEntryCache.create('testCache2');

    expect(function () {
      cache.reconcile();
    }).not.to.throw;
  });

  describe('normalizeEntries', function () {
    it('should return fileDescriptor for all the passed files when using normalizeEntries', function () {
      cache = fileEntryCache.create('testCache');

      var files = expand(path.resolve(__dirname, '../fixtures/*.txt'));
      var oFiles = cache.normalizeEntries(files);

      expect(oFiles.length).to.equal(4);
      oFiles.forEach(function (file) {
        expect(file.changed).to.be.true;
      });
    });

    it('should not remove non visited entries from the cache', function () {
      cache = fileEntryCache.create('testCache');

      var files = expand(path.resolve(__dirname, '../fixtures/*.txt'));
      cache.normalizeEntries(files);

      cache.reconcile();

      // the f2.txt file is in the cache
      expect(cache.cache.getKey(path.resolve(__dirname, '../fixtures/f2.txt'))).to.not.equal(undefined);

      // load the cache again
      cache = fileEntryCache.create('testCache');

      // when recently loaded all entries are in the cache
      expect(cache.cache.keys().length).to.equal(4);

      // we check only one file
      expect(cache.hasFileChanged(path.resolve(__dirname, '../fixtures/f4.txt'))).to.be.false;

      cache.reconcile();

      // after reconcile we will only have 1 key because we just visited one entry
      expect(cache.cache.getKey(path.resolve(__dirname, '../fixtures/f2.txt'))).to.not.equal(undefined);
      expect(cache.cache.keys().length).to.equal(4);
    });

    it('should not persist files that do not exist', function () {
      cache = fileEntryCache.create('testCache');

      var files = expand(path.resolve(__dirname, '../fixtures/*.txt'));
      cache.normalizeEntries(files);

      del(path.resolve(__dirname, '../fixtures/f2.txt'), {
        force: true,
      });

      cache.reconcile();

      // the f2.txt file is in the cache
      expect(cache.cache.getKey(path.resolve(__dirname, '../fixtures/f2.txt'))).to.equal(undefined);

      // now delete the entry
      del(path.resolve(__dirname, '../fixtures/f3.txt'), {
        force: true,
      });

      // load the cache again
      cache = fileEntryCache.create('testCache');

      // when recently loaded all entries that exists are in the cache, f3 should not be there
      expect(cache.cache.keys().length).to.equal(2);

      expect(cache.cache.getKey(path.resolve(__dirname, '../fixtures/f3.txt'))).to.equal(undefined);

      // we check only one file
      expect(cache.hasFileChanged(path.resolve(__dirname, '../fixtures/f4.txt'))).to.be.false;

      cache.reconcile();

      expect(cache.cache.keys().length).to.equal(2);
    });

    it('should return fileDescriptor for all the passed files', function () {
      cache = fileEntryCache.create('testCache');

      var files = expand(path.resolve(__dirname, '../fixtures/*.txt'));
      var oFiles = cache.normalizeEntries(files);

      cache.reconcile();

      // modify a file
      write(path.resolve(fixturesDir, fixtureFiles[2].name), fixtureFiles[2].content + 'modified!!!');

      oFiles = cache.normalizeEntries(files);

      expect(oFiles.length).to.equal(4);

      var changedFile = oFiles.filter(function (entry) {
        return entry.changed;
      });

      expect(changedFile[0].key).to.contains(fixtureFiles[2].name);
    });

    it('should not fail if a null array of files is passed', function () {
      cache = fileEntryCache.create('testCache');
      var oFiles = cache.normalizeEntries(null);
      expect(oFiles).to.deep.equal([]);
    });
  });

  describe('saving custom metadata', function () {
    var cache2;
    // eslint-disable-next-line mocha/no-hooks-for-single-case
    afterEach(function () {
      cache2 && cache2.deleteCacheFile();
    });

    it('should allow persist custom data in the entries', function () {
      cache = fileEntryCache.create('cache-1');

      var files = expand(path.resolve(__dirname, '../fixtures/*.txt'));
      var entries = cache.normalizeEntries(files);

      entries[1].meta.data = { foo: 'bar' };
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

  describe('getFileDescriptor', function () {
    it('should tell when file known to the cache is not found anymore ', function () {
      var file = path.resolve(__dirname, '../fixtures/', fixtureFiles[0].name);
      cache = fileEntryCache.createFromFile('../fixtures/.eslintcache');

      cache.getFileDescriptor(file);
      cache.reconcile();
      del(file);
      expect(cache.getFileDescriptor(file).notFound).to.be.true;
    });
  });

  describe('analyzeFiles', function () {
    it('should return correct information about files ', function () {
      var filenames = fixtureFiles.map(function (fixtureFile) {
        return path.resolve(__dirname, '../fixtures/', fixtureFile.name);
      });
      var expectedBeforeChanges = {
        changedFiles: filenames,
        notFoundFiles: [],
        notChangedFiles: [],
      };
      var expectedAfterChanges = {
        changedFiles: [filenames[0]],
        notFoundFiles: [filenames[1]],
        notChangedFiles: [filenames[2], filenames[3]],
      };
      cache = fileEntryCache.createFromFile('../fixtures/.eslintcache');

      expect(cache.analyzeFiles(filenames)).to.deep.equal(expectedBeforeChanges);
      cache.reconcile();

      write(filenames[0], 'everybody can change');
      del(filenames[1]);
      expect(cache.analyzeFiles(filenames)).to.deep.equal(expectedAfterChanges);
    });
  });
});
