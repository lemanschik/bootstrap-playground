const dirname = (pathname) => pathname.slice(0,pathname.lastIndexOf('/'));
const filename = (pathname) => pathname.slice(pathname.lastIndexOf('/')+1);
const hasExt = (filename) => filename.indexOf('.') > -1);
const extname = (pathname) => hasExt(pathname) && pathname.slice(pathname.lastIndexOf('.'));
const fsPath = (pathname) => Uri.parse(`memfs: ${pathname}`);

const seedFromCache = () => caches.open(import.meta.url).then(async (cache) => {
  cache.matchAll("/", { ignoreSearch: true }).then((responses) => {
    for (const response of responses) { const { pathname } = new URL(response.url);
      hasExt(filename(pathname)) && fs.createDirectory(fsPath(dirname(pathname))) &&
      fs.writeFile( 
        fsPath(new URL(response.url).pathname),
        await response.body.arrayBuffer(),
        { create: true, overwrite: true }
      );
    }
  });
});

export { seedFromCache as seed };
