import * as vscode from 'vscode';

// MemFS
import {
	CancellationToken,
	Disposable,
	Event,
	EventEmitter,
	FileChangeEvent,
	FileChangeType,
	FileSearchOptions,
	FileSearchProvider,
	FileSearchQuery,
	FileStat,
	FileSystemError,
	FileSystemProvider,
	FileType,
	Position,
	Progress,
	ProviderResult,
	Range,
	TextSearchComplete,
	TextSearchOptions,
	TextSearchQuery,
	TextSearchProvider,
	TextSearchResult,
	Uri,
	workspace,
} from 'vscode';

// End of Type Imports.

export class File implements FileStat {

	type: FileType;
	ctime: number;
	mtime: number;
	size: number;

	name: string;
	data?: Uint8Array;

	constructor(public uri: Uri, name: string) {
		this.type = FileType.File;
		this.ctime = Date.now();
		this.mtime = Date.now();
		this.size = 0;
		this.name = name;
	}
}

export class Directory implements FileStat {

	type: FileType;
	ctime: number;
	mtime: number;
	size: number;

	name: string;
	entries: Map<string, File | Directory>;

	constructor(public uri: Uri, name: string) {
		this.type = FileType.Directory;
		this.ctime = Date.now();
		this.mtime = Date.now();
		this.size = 0;
		this.name = name;
		this.entries = new Map();
	}
}

export type Entry = File | Directory;

const textEncoder = new TextEncoder();

export class MemFS implements FileSystemProvider, FileSearchProvider, TextSearchProvider, Disposable {
	static scheme = 'memfs';

	private readonly disposable: Disposable;

	constructor() {
		this.disposable = Disposable.from(
			workspace.registerFileSystemProvider(MemFS.scheme, this, { isCaseSensitive: true }),
			workspace.registerFileSearchProvider(MemFS.scheme, this),
			workspace.registerTextSearchProvider(MemFS.scheme, this)
		);
	}

	dispose() {
		this.disposable?.dispose();
	}

	root = new Directory(Uri.parse('memfs:/'), '');

	// --- manage file metadata

	stat(uri: Uri): FileStat {
		return this._lookup(uri, false);
	}

	readDirectory(uri: Uri): [string, FileType][] {
		const entry = this._lookupAsDirectory(uri, false);
		let result: [string, FileType][] = [];
		for (const [name, child] of entry.entries) {
			result.push([name, child.type]);
		}
		return result;
	}

	// --- manage file contents

	readFile(uri: Uri): Uint8Array {
		const data = this._lookupAsFile(uri, false).data;
		if (data) {
			return data;
		}
		throw FileSystemError.FileNotFound();
	}

	writeFile(uri: Uri, content: Uint8Array, options: { create: boolean, overwrite: boolean }): void {
		let basename = this._basename(uri.path);
		let parent = this._lookupParentDirectory(uri);
		let entry = parent.entries.get(basename);
		if (entry instanceof Directory) {
			throw FileSystemError.FileIsADirectory(uri);
		}
		if (!entry && !options.create) {
			throw FileSystemError.FileNotFound(uri);
		}
		if (entry && options.create && !options.overwrite) {
			throw FileSystemError.FileExists(uri);
		}
		if (!entry) {
			entry = new File(uri, basename);
			parent.entries.set(basename, entry);
			this._fireSoon({ type: FileChangeType.Created, uri });
		}
		entry.mtime = Date.now();
		entry.size = content.byteLength;
		entry.data = content;

		this._fireSoon({ type: FileChangeType.Changed, uri });
	}

	// --- manage files/folders

	rename(oldUri: Uri, newUri: Uri, options: { overwrite: boolean }): void {
		if (!options.overwrite && this._lookup(newUri, true)) {
			throw FileSystemError.FileExists(newUri);
		}

		let entry = this._lookup(oldUri, false);
		let oldParent = this._lookupParentDirectory(oldUri);

		let newParent = this._lookupParentDirectory(newUri);
		let newName = this._basename(newUri.path);

		oldParent.entries.delete(entry.name);
		entry.name = newName;
		newParent.entries.set(newName, entry);

		this._fireSoon(
			{ type: FileChangeType.Deleted, uri: oldUri },
			{ type: FileChangeType.Created, uri: newUri }
		);
	}

	delete(uri: Uri): void {
		let dirname = uri.with({ path: this._dirname(uri.path) });
		let basename = this._basename(uri.path);
		let parent = this._lookupAsDirectory(dirname, false);
		if (!parent.entries.has(basename)) {
			throw FileSystemError.FileNotFound(uri);
		}
		parent.entries.delete(basename);
		parent.mtime = Date.now();
		parent.size -= 1;
		this._fireSoon({ type: FileChangeType.Changed, uri: dirname }, { uri, type: FileChangeType.Deleted });
	}

	createDirectory(uri: Uri): void {
		let basename = this._basename(uri.path);
		let dirname = uri.with({ path: this._dirname(uri.path) });
		let parent = this._lookupAsDirectory(dirname, false);

		let entry = new Directory(uri, basename);
		parent.entries.set(entry.name, entry);
		parent.mtime = Date.now();
		parent.size += 1;
		this._fireSoon({ type: FileChangeType.Changed, uri: dirname }, { type: FileChangeType.Created, uri });
	}

	// --- lookup

	private _lookup(uri: Uri, silent: false): Entry;
	private _lookup(uri: Uri, silent: boolean): Entry | undefined;
	private _lookup(uri: Uri, silent: boolean): Entry | undefined {
		let parts = uri.path.split('/');
		let entry: Entry = this.root;
		for (const part of parts) {
			if (!part) {
				continue;
			}
			let child: Entry | undefined;
			if (entry instanceof Directory) {
				child = entry.entries.get(part);
			}
			if (!child) {
				if (!silent) {
					throw FileSystemError.FileNotFound(uri);
				} else {
					return undefined;
				}
			}
			entry = child;
		}
		return entry;
	}

	private _lookupAsDirectory(uri: Uri, silent: boolean): Directory {
		let entry = this._lookup(uri, silent);
		if (entry instanceof Directory) {
			return entry;
		}
		throw FileSystemError.FileNotADirectory(uri);
	}

	private _lookupAsFile(uri: Uri, silent: boolean): File {
		let entry = this._lookup(uri, silent);
		if (entry instanceof File) {
			return entry;
		}
		throw FileSystemError.FileIsADirectory(uri);
	}

	private _lookupParentDirectory(uri: Uri): Directory {
		const dirname = uri.with({ path: this._dirname(uri.path) });
		return this._lookupAsDirectory(dirname, false);
	}

	// --- manage file events

	private _emitter = new EventEmitter<FileChangeEvent[]>();
	private _bufferedEvents: FileChangeEvent[] = [];
	private _fireSoonHandle?: any;

	readonly onDidChangeFile: Event<FileChangeEvent[]> = this._emitter.event;

	watch(_resource: Uri): Disposable {
		// ignore, fires for all changes...
		return new Disposable(() => { });
	}

	private _fireSoon(...events: FileChangeEvent[]): void {
		this._bufferedEvents.push(...events);

		if (this._fireSoonHandle) {
			clearTimeout(this._fireSoonHandle);
		}

		this._fireSoonHandle = setTimeout(() => {
			this._emitter.fire(this._bufferedEvents);
			this._bufferedEvents.length = 0;
		}, 5);
	}

	// --- path utils

	private _basename(path: string): string {
		path = this._rtrim(path, '/');
		if (!path) {
			return '';
		}

		return path.substr(path.lastIndexOf('/') + 1);
	}

	private _dirname(path: string): string {
		path = this._rtrim(path, '/');
		if (!path) {
			return '/';
		}

		return path.substr(0, path.lastIndexOf('/'));
	}

	private _rtrim(haystack: string, needle: string): string {
		if (!haystack || !needle) {
			return haystack;
		}

		const needleLen = needle.length,
			haystackLen = haystack.length;

		if (needleLen === 0 || haystackLen === 0) {
			return haystack;
		}

		let offset = haystackLen,
			idx = -1;

		while (true) {
			idx = haystack.lastIndexOf(needle, offset - 1);
			if (idx === -1 || idx + needleLen !== offset) {
				break;
			}
			if (idx === 0) {
				return '';
			}
			offset = idx;
		}

		return haystack.substring(0, offset);
	}

	private _getFiles(): Set<File> {
		const files = new Set<File>();

		this._doGetFiles(this.root, files);

		return files;
	}

	private _doGetFiles(dir: Directory, files: Set<File>): void {
		dir.entries.forEach(entry => {
			if (entry instanceof File) {
				files.add(entry);
			} else {
				this._doGetFiles(entry, files);
			}
		});
	}

	private _convertSimple2RegExpPattern(pattern: string): string {
		return pattern.replace(/[\-\\\{\}\+\?\|\^\$\.\,\[\]\(\)\#\s]/g, '\\$&').replace(/[\*]/g, '.*');
	}

	// --- search provider

	provideFileSearchResults(query: FileSearchQuery, _options: FileSearchOptions, _token: CancellationToken): ProviderResult<Uri[]> {
		return this._findFiles(query.pattern);
	}

	private _findFiles(query: string | undefined): Uri[] {
		const files = this._getFiles();
		const result: Uri[] = [];

		const pattern = query ? new RegExp(this._convertSimple2RegExpPattern(query)) : null;

		for (const file of files) {
			if (!pattern || pattern.exec(file.name)) {
				result.push(file.uri);
			}
		}

		return result;
	}

	private _textDecoder = new TextDecoder();

	provideTextSearchResults(query: TextSearchQuery, options: TextSearchOptions, progress: Progress<TextSearchResult>, _token: CancellationToken) {
		const result: TextSearchComplete = { limitHit: false };

		const files = this._findFiles(options.includes[0]);
		if (files) {
			for (const file of files) {
				const content = this._textDecoder.decode(this.readFile(file));

				const lines = content.split('\n');
				for (let i = 0; i < lines.length; i++) {
					const line = lines[i];
					const index = line.indexOf(query.pattern);
					if (index !== -1) {
						progress.report({
							uri: file,
							ranges: new Range(new Position(i, index), new Position(i, index + query.pattern.length)),
							preview: {
								text: line,
								matches: new Range(new Position(0, index), new Position(0, index + query.pattern.length))
							}
						});
					}
				}
			}
		}

		return result;
	}
}

function randomData(lineCnt: number, lineLen = 155): Uint8Array {
	let lines: string[] = [];
	for (let i = 0; i < lineCnt; i++) {
		let line = '';
		while (line.length < lineLen) {
			line += Math.random().toString(2 + (i % 34)).substr(2);
		}
		lines.push(line.substr(0, lineLen));
	}
	return textEncoder.encode(lines.join('\n'));
}

// Extension

declare const navigator: unknown;

export function activate(context: vscode.ExtensionContext) {
	if (typeof navigator === 'object') {	// do not run under node.js
		const memFs = enableFs(context);
		
    const dirname = (pathname) => pathname.slice(0,pathname.lastIndexOf('/'));
    const filename = (pathname) => pathname.slice(pathname.lastIndexOf('/')+1);
    const hasExt = (filename) => filename.indexOf('.') > -1);
    const extname = (pathname) => hasExt(pathname) && pathname.slice(pathname.lastIndexOf('.'));
    const fsPath = (pathname) => Uri.parse(`memfs: ${pathname}`);

    const seedFromCache = (updatePathname="/") => caches.open(import.meta.url).then(async (cache) => {
      cache.matchAll(updatePathname, { ignoreSearch: true }).then((responses) => {
        for (const response of responses) { const { pathname } = new URL(response.url);
          hasExt(filename(pathname)) && memFs.createDirectory(fsPath(dirname(pathname))) &&
          memFs.writeFile( 
            fsPath(new URL(response.url).pathname),
            await response.body.arrayBuffer(),
            { create: true, overwrite: true }
          );
        }
      });
    });
    const cacheChannel = new BroadcastChannel(import.meta.url);
    cacheChannel.onmessage = ({ data }) => seedFromCache
		enableProblems(context);
		enableTasks();

		vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(`memfs:/sample-folder/large.ts`));
	}
}

function enableFs(context: vscode.ExtensionContext): MemFS {
	const memFs = new MemFS();
	context.subscriptions.push(memFs);

	return memFs;
}

function enableProblems(context: vscode.ExtensionContext): void {
	const collection = vscode.languages.createDiagnosticCollection('test');
	if (vscode.window.activeTextEditor) {
		updateDiagnostics(vscode.window.activeTextEditor.document, collection);
	}
	context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(editor => {
		if (editor) {
			updateDiagnostics(editor.document, collection);
		}
	}));
}

function updateDiagnostics(document: vscode.TextDocument, collection: vscode.DiagnosticCollection): void {
	if (document && document.fileName === '/sample-folder/large.ts') {
		collection.set(document.uri, [{
			code: '',
			message: 'cannot assign twice to immutable variable `storeHouses`',
			range: new vscode.Range(new vscode.Position(4, 12), new vscode.Position(4, 32)),
			severity: vscode.DiagnosticSeverity.Error,
			source: '',
			relatedInformation: [
				new vscode.DiagnosticRelatedInformation(new vscode.Location(document.uri, new vscode.Range(new vscode.Position(1, 8), new vscode.Position(1, 9))), 'first assignment to `x`')
			]
		}, {
			code: '',
			message: 'function does not follow naming conventions',
			range: new vscode.Range(new vscode.Position(7, 10), new vscode.Position(7, 23)),
			severity: vscode.DiagnosticSeverity.Warning,
			source: ''
		}]);
	} else {
		collection.clear();
	}
}

function enableTasks(): void {

	interface CustomBuildTaskDefinition extends vscode.TaskDefinition {
		/**
		 * The build flavor. Should be either '32' or '64'.
		 */
		flavor: string;

		/**
		 * Additional build flags
		 */
		flags?: string[];
	}

	class CustomBuildTaskProvider implements vscode.TaskProvider {
		static CustomBuildScriptType: string = 'custombuildscript';
		private tasks: vscode.Task[] | undefined;

		// We use a CustomExecution task when state needs to be shared accross runs of the task or when
		// the task requires use of some VS Code API to run.
		// If you don't need to share state between runs and if you don't need to execute VS Code API in your task,
		// then a simple ShellExecution or ProcessExecution should be enough.
		// Since our build has this shared state, the CustomExecution is used below.
		private sharedState: string | undefined;

		constructor(private workspaceRoot: string) { }

		async provideTasks(): Promise<vscode.Task[]> {
			return this.getTasks();
		}

		resolveTask(_task: vscode.Task): vscode.Task | undefined {
			const flavor: string = _task.definition.flavor;
			if (flavor) {
				const definition: CustomBuildTaskDefinition = <any>_task.definition;
				return this.getTask(definition.flavor, definition.flags ? definition.flags : [], definition);
			}
			return undefined;
		}

		private getTasks(): vscode.Task[] {
			if (this.tasks !== undefined) {
				return this.tasks;
			}
			// In our fictional build, we have two build flavors
			const flavors: string[] = ['32', '64'];
			// Each flavor can have some options.
			const flags: string[][] = [['watch', 'incremental'], ['incremental'], []];

			this.tasks = [];
			flavors.forEach(flavor => {
				flags.forEach(flagGroup => {
					this.tasks!.push(this.getTask(flavor, flagGroup));
				});
			});
			return this.tasks;
		}

		private getTask(flavor: string, flags: string[], definition?: CustomBuildTaskDefinition): vscode.Task {
			if (definition === undefined) {
				definition = {
					type: CustomBuildTaskProvider.CustomBuildScriptType,
					flavor,
					flags
				};
			}
			return new vscode.Task(definition, vscode.TaskScope.Workspace, `${flavor} ${flags.join(' ')}`,
				CustomBuildTaskProvider.CustomBuildScriptType, new vscode.CustomExecution(async (): Promise<vscode.Pseudoterminal> => {
					// When the task is executed, this callback will run. Here, we setup for running the task.
					return new CustomBuildTaskTerminal(this.workspaceRoot, flavor, flags, () => this.sharedState, (state: string) => this.sharedState = state);
				}));
		}
	}

	class CustomBuildTaskTerminal implements vscode.Pseudoterminal {
		private writeEmitter = new vscode.EventEmitter<string>();
		onDidWrite: vscode.Event<string> = this.writeEmitter.event;
		private closeEmitter = new vscode.EventEmitter<void>();
		onDidClose?: vscode.Event<void> = this.closeEmitter.event;

		private fileWatcher: vscode.FileSystemWatcher | undefined;

		constructor(private workspaceRoot: string, _flavor: string, private flags: string[], private getSharedState: () => string | undefined, private setSharedState: (state: string) => void) {
		}

		open(_initialDimensions: vscode.TerminalDimensions | undefined): void {
			// At this point we can start using the terminal.
			if (this.flags.indexOf('watch') > -1) {
				let pattern = this.workspaceRoot + '/customBuildFile';
				this.fileWatcher = vscode.workspace.createFileSystemWatcher(pattern);
				this.fileWatcher.onDidChange(() => this.doBuild());
				this.fileWatcher.onDidCreate(() => this.doBuild());
				this.fileWatcher.onDidDelete(() => this.doBuild());
			}
			this.doBuild();
		}

		close(): void {
			// The terminal has been closed. Shutdown the build.
			if (this.fileWatcher) {
				this.fileWatcher.dispose();
			}
		}

		private async doBuild(): Promise<void> {
			return new Promise<void>((resolve) => {
				this.writeEmitter.fire('Starting build...\r\n');
				let isIncremental = this.flags.indexOf('incremental') > -1;
				if (isIncremental) {
					if (this.getSharedState()) {
						this.writeEmitter.fire('Using last build results: ' + this.getSharedState() + '\r\n');
					} else {
						isIncremental = false;
						this.writeEmitter.fire('No result from last build. Doing full build.\r\n');
					}
				}

				// Since we don't actually build anything in this example set a timeout instead.
				setTimeout(() => {
					const date = new Date();
					this.setSharedState(date.toTimeString() + ' ' + date.toDateString());
					this.writeEmitter.fire('Build complete.\r\n\r\n');
					if (this.flags.indexOf('watch') === -1) {
						this.closeEmitter.fire();
						resolve();
					}
				}, isIncremental ? 1000 : 4000);
			});
		}
	}

	vscode.tasks.registerTaskProvider(CustomBuildTaskProvider.CustomBuildScriptType, new CustomBuildTaskProvider(vscode.workspace.rootPath!));
}
