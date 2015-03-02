# file-entry-cache
> Super simple cache for file metadata, useful for process that work o a given series of files 
> and that only need to repeat the job on the changed ones since the previous run of the process — Edit

[![NPM Version](http://img.shields.io/npm/v/file-entry-cache.svg?style=flat)](https://npmjs.org/package/file-entry-cache)
[![Build Status](http://img.shields.io/travis/royriojas/file-entry-cache.svg?style=flat)](https://travis-ci.org/royriojas/file-entry-cache)

## install

```bash
npm i --save file-entry-cache
```

## Usage

```js
// loads the cache, if one does not exists for the given 
// Id a new one will be prepared to be created
var cache = require('file-entry-cache').create('cacheId');

cache.getUpdatedFiles()

var cache = require('file-entry-cache').load('cacheId', path.resolve('./path/to/folder'));
```

## Motivation for this module

I needed a super simple and dumb **in-memory cache** with optional disk persistance in order to make 
a script that will beutify files with `esformatter` only execute on the files that were changed since the last run.
To make that possible we need to store the `fileSize` and `modificationTime` of the files. So a simple `key/value` 
storage was needed and Bam! this module was born.

## Important notes
- If no directory is especified when the `load` method is called, a folder named `.cache` will be created 
  inside the module directory when `cache.save` is called. If you're committing your `node_modules` to any vcs, you
  might want to ignore the default `.cache` folder, or specify a custom directory.
- The values set on the keys of the cache should be `stringify-able` ones, meaning no circular references
- All the changes to the cache state are done to memory
- I could have used a timer or `Object.observe` to deliver the changes to disk, but I wanted to keep this module
  intentionally dumb and simple

## License 

MIT


