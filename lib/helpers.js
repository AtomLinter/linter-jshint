'use babel';

import path from 'path';
import { homedir } from 'os';
import * as atomlinter from 'atom-linter';
import { readFile as fsReadFile, access } from 'fs';
// eslint-disable-next-line import/extensions, import/no-extraneous-dependencies
import type { TextEditor } from 'atom';

let homeConfigPath;
const debugCache = new Map();

async function readFile(filePath) {
  return new Promise((resolve, reject) => {
    fsReadFile(filePath, 'utf8', (err, data) => {
      if (err) {
        reject(err);
      }
      resolve(data);
    });
  });
}

async function fileExists(checkPath) {
  return new Promise((resolve) => {
    access(checkPath, (err) => {
      if (err) {
        resolve(false);
      }
      resolve(true);
    });
  });
}

export async function hasHomeConfig() {
  if (!homeConfigPath) {
    homeConfigPath = path.join(homedir(), '.jshintrc');
  }
  return fileExists(homeConfigPath);
}

export async function readIgnoreList(ignorePath) {
  return (await readFile(ignorePath)).split(/[\r\n]/);
}

async function getPackageVersion() {
  if (debugCache.has('packageVersion')) {
    return debugCache.get('packageVersion');
  }

  const packagePath = atom.packages.resolvePackagePath('linter-jshint');
  let linterJSHintMeta;
  if (packagePath === undefined) {
    // Apparently for some users the package path fails to resolve
    linterJSHintMeta = { version: 'unknown!' };
  } else {
    // eslint-disable-next-line import/no-dynamic-require
    const metaPath = path.join(packagePath, 'package.json');
    linterJSHintMeta = JSON.parse(await readFile(metaPath));
  }

  debugCache.set('packageVersion', linterJSHintMeta.version);
  return linterJSHintMeta.version;
}

async function getJSHintVersion(config) {
  const execPath = config.executablePath !== '' ? config.executablePath :
    path.join(__dirname, '..', 'node_modules', 'jshint', 'bin', 'jshint');

  if (debugCache.has(execPath)) {
    return debugCache.get(execPath);
  }

  // NOTE: Yes, `jshint --version` gets output on STDERR...
  const jshintVersion = await atomlinter.execNode(
    execPath, ['--version'], { stream: 'stderr' });
  debugCache.set(execPath, jshintVersion);
  return jshintVersion;
}

function getEditorScopes() {
  const textEditor = atom.workspace.getActiveTextEditor();
  let editorScopes: Array<string>;
  if (atom.workspace.isTextEditor(textEditor)) {
    editorScopes = textEditor.getLastCursor().getScopeDescriptor().getScopesArray();
  } else {
    // Somehow this can be called with no active TextEditor, impossible I know...
    editorScopes = ['unknown'];
  }
  return editorScopes;
}

export async function getDebugInfo() {
  const linterJSHintVersion = await getPackageVersion();
  const config = atom.config.get('linter-jshint');
  const jshintVersion = await getJSHintVersion(config);
  const hoursSinceRestart = Math.round((process.uptime() / 3600) * 10) / 10;
  const editorScopes = getEditorScopes();

  return {
    atomVersion: atom.getVersion(),
    linterJSHintVersion,
    linterJSHintConfig: config,
    jshintVersion,
    hoursSinceRestart,
    platform: process.platform,
    editorScopes,
  };
}

export async function generateDebugString() {
  const debug = await getDebugInfo();
  const details = [
    `Atom version: ${debug.atomVersion}`,
    `linter-jshint version: v${debug.linterJSHintVersion}`,
    `JSHint version: ${debug.jshintVersion}`,
    `Hours since last Atom restart: ${debug.hoursSinceRestart}`,
    `Platform: ${debug.platform}`,
    `Current file's scopes: ${JSON.stringify(debug.editorScopes, null, 2)}`,
    `linter-jshint configuration: ${JSON.stringify(debug.linterJSHintConfig, null, 2)}`,
  ];
  return details.join('\n');
}

export async function generateInvalidTrace(
  msgLine: number, msgCol: number, file: string, textEditor: TextEditor,
  error: Object,
) {
  const errMsgRange = `${msgLine + 1}:${msgCol}`;
  const rangeText = `Requested start point: ${errMsgRange}`;
  const issueURL = 'https://github.com/AtomLinter/linter-jshint/issues/new';
  const titleText = `Invalid position given by '${error.code}'`;
  const title = encodeURIComponent(titleText);
  const body = encodeURIComponent([
    'JSHint returned a point that did not exist in the document being edited.',
    `Rule: \`${error.code}\``,
    rangeText,
    '', '',
    '<!-- If at all possible, please include code to reproduce this issue! -->',
    '', '',
    'Debug information:',
    '```',
    await generateDebugString(),
    '```',
  ].join('\n'));
  const newIssueURL = `${issueURL}?title=${title}&body=${body}`;
  return {
    severity: 'error',
    excerpt: `${titleText}. ${rangeText}. Please report this using the message link!`,
    detils: `Original message: ${error.code} - ${error.reason}`,
    url: newIssueURL,
    location: {
      file,
      position: atomlinter.generateRange(textEditor),
    },
  };
}
