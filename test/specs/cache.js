describe('flat-cache', function () {
  'use strict';
  var expect = require('chai').expect;
  var path = require('path');
  var write = require('write').sync;
  var read = require('read-file').readFileSync;
  var expand = require('glob-expand');
  var fileEntryCache = require('../../cache');

  var fixturesDir = path.resolve(__dirname, '../fixtures');
  var del = require('del').sync;

  var fixtureFiles = [{
    name: 'f1.txt',
    content: 'some content 1'
  }, {
    name: 'f2.txt',
    content: 'some content 2'
  }, {
    name: 'f3.txt',
    content: 'some content 3'
  }, {
    name: 'f4.txt',
    content: 'some content 4'
  }];

  var cache;

  var delCacheAndFiles = function () {
    del(fixturesDir, {
      force: true
    });
    cache && cache.deleteCacheFile();
  };

  beforeEach(function () {
    delCacheAndFiles();

    fixtureFiles.forEach(function (f) {
      write(path.resolve(fixturesDir, f.name), f.content);
    });
  });

  afterEach(function() {
    delCacheAndFiles();
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

  it('should not fail if an array is not passed to the `getChangedFiles` method', function (){
    cache = fileEntryCache.create('testCache2');
    var files = cache.getUpdatedFiles(null);
    cache.reconcile();
    expect(files).to.deep.equal([]);
  });

  it('should not fail if calling reconcile without a prior call to `getChangedFiles` or `normalizeEntries`', function (){
    cache = fileEntryCache.create('testCache2');

    expect(function () {
      cache.reconcile();
    }).not.to.throw;
  });

  describe('normalizeEntries', function () {
    it('should return fileDescriptor for all the passed files', function () {
      cache = fileEntryCache.create('testCache');

      var files = expand(path.resolve(__dirname, '../fixtures/*.txt'));
      var oFiles = cache.normalizeEntries(files);

      expect(oFiles.length).to.equal(4);
      oFiles.forEach(function (file) {
        expect(file.changed).to.be.true;
      });

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
    afterEach(function () {
      cache2 && cache2.deleteCacheFile();
    });

    it('should allow persist custom data in the entries', function () {
      cache = fileEntryCache.create('cache-1');

      var files = expand(path.resolve(__dirname, '../fixtures/*.txt'));
      var entries = cache.normalizeEntries(files);

      entries[1].meta.data = { foo: 'bar' };
      entries[2].meta.data = { baz: { some: 'foo' } };

      cache.reconcile();

      cache2 = fileEntryCache.create('cache-1');
      entries = cache2.normalizeEntries(files);

      expect(entries[1].meta.data.foo).to.equal('bar');
      expect(entries[2].meta.data.baz).to.deep.equal({ some: 'foo'});

    });
  });
});