const seed = (fs) => {

this.createDirectory(Uri.parse(`memfs:/sample-folder/`));

		// most common files types
		fs.writeFile(Uri.parse(`memfs:/sample-folder/large.ts`), textEncoder.encode(largeTSFile), { create: true, overwrite: true });
		fs.writeFile(Uri.parse(`memfs:/sample-folder/file.txt`), textEncoder.encode('foo'), { create: true, overwrite: true });
		fs.writeFile(Uri.parse(`memfs:/sample-folder/file.html`), textEncoder.encode('<html><body><h1 class="hd">Hello</h1></body></html>'), { create: true, overwrite: true });
		fs.writeFile(Uri.parse(`memfs:/sample-folder/file.js`), textEncoder.encode('console.log("JavaScript")'), { create: true, overwrite: true });
		fs.writeFile(Uri.parse(`memfs:/sample-folder/file.json`), textEncoder.encode('{ "json": true }'), { create: true, overwrite: true });
		fs.writeFile(Uri.parse(`memfs:/sample-folder/file.ts`), textEncoder.encode('console.log("TypeScript")'), { create: true, overwrite: true });
		fs.writeFile(Uri.parse(`memfs:/sample-folder/file.css`), textEncoder.encode('* { color: green; }'), { create: true, overwrite: true });
		fs.writeFile(Uri.parse(`memfs:/sample-folder/file.md`), textEncoder.encode(debuggableFile), { create: true, overwrite: true });
		fs.writeFile(Uri.parse(`memfs:/sample-folder/file.xml`), textEncoder.encode('<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>'), { create: true, overwrite: true });
		fs.writeFile(Uri.parse(`memfs:/sample-folder/file.py`), textEncoder.encode('import base64, sys; base64.decode(open(sys.argv[1], "rb"), open(sys.argv[2], "wb"))'), { create: true, overwrite: true });
		fs.writeFile(Uri.parse(`memfs:/sample-folder/file.yaml`), textEncoder.encode('- just: write something'), { create: true, overwrite: true });
		fs.writeFile(Uri.parse(`memfs:/sample-folder/file.jpg`), getImageFile(), { create: true, overwrite: true });
		fs.writeFile(Uri.parse(`memfs:/sample-folder/file.php`), textEncoder.encode('<?php echo "Hello World!"; ?>'), { create: true, overwrite: true });

		// some more files & folders
		fs.createDirectory(Uri.parse(`memfs:/sample-folder/folder/`));
		fs.createDirectory(Uri.parse(`memfs:/sample-folder/workspaces/`));
		fs.createDirectory(Uri.parse(`memfs:/sample-folder/large/`));
		fs.createDirectory(Uri.parse(`memfs:/sample-folder/xyz/`));
		fs.createDirectory(Uri.parse(`memfs:/sample-folder/xyz/abc`));
		fs.createDirectory(Uri.parse(`memfs:/sample-folder/xyz/def`));

		fs.writeFile(Uri.parse(`memfs:/sample-folder/folder/empty.txt`), new Uint8Array(0), { create: true, overwrite: true });
		fs.writeFile(Uri.parse(`memfs:/sample-folder/folder/empty.foo`), new Uint8Array(0), { create: true, overwrite: true });
		fs.writeFile(Uri.parse(`memfs:/sample-folder/folder/file.ts`), textEncoder.encode('let a:number = true; console.log(a);'), { create: true, overwrite: true });
		fs.writeFile(Uri.parse(`memfs:/sample-folder/large/rnd.foo`), randomData(50000), { create: true, overwrite: true });
		fs.writeFile(Uri.parse(`memfs:/sample-folder/xyz/UPPER.txt`), textEncoder.encode('UPPER'), { create: true, overwrite: true });
		fs.writeFile(Uri.parse(`memfs:/sample-folder/xyz/upper.txt`), textEncoder.encode('upper'), { create: true, overwrite: true });
		fs.writeFile(Uri.parse(`memfs:/sample-folder/xyz/def/foo.md`), textEncoder.encode('*MemFS*'), { create: true, overwrite: true });
		fs.writeFile(Uri.parse(`memfs:/sample-folder/workspaces/mem.code-workspace`), textEncoder.encode(JSON.stringify({
			"folders": [
				{
					"name": "sample-folder-large",
					"uri": "memfs:/sample-folder/large"
				},
				{
					"name": "sample-folder-xyz",
					"uri": "memfs:/sample-folder/xyz"
				},
				{
					"name": "sample-folder-folder",
					"uri": "memfs:/sample-folder/folder"
				}
			]
		}, undefined, '\t')), { create: true, overwrite: true });

		// some files in different encodings
		fs.createDirectory(Uri.parse(`memfs:/sample-folder/encodings/`));
		fs.writeFile(
			Uri.parse(`memfs:/sample-folder/encodings/windows1251.txt`),
			windows1251File,
			{ create: true, overwrite: true }
		);
		fs.writeFile(
			Uri.parse(`memfs:/sample-folder/encodings/gbk.txt`),
			gbkFile,
			{ create: true, overwrite: true }
		);
}
