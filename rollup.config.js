/** Encapsulates the old Build Process with Webpack **/

const {getManifest} = require('workbox-build');

// These are some common options, and not all are required.
// Consult the docs for more info.
getManifest({
  dontCacheBustURLsMatching: [new RegExp('...')],
  globDirectory: '...', globPatterns: ['...', '...'],
  maximumFileSizeToCacheInBytes: ...,
}).then(({manifestEntries, count, size, warnings}) => {
  if (warnings.length > 0) {
    console.warn(
      `Warnings encountered while getting the manifest:${warnings.join('\n')}` 
    );
  }
  
  fs.promises.writeFile('dependencies.json',new ReadableStream({ start(c) { 
    c.enqueue(`{ "entries": [ \n`)
    for (const manifestEntrie of manifestEntries){
      const { integrity, revision, url } = manifestEntrie;
      c.enqueue(`"${url}"`);
    }
    c.enqueue(`\n ]\n}`);
  }}));
  
});
