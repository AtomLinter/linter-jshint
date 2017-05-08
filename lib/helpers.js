'use babel';

import path from 'path';
import { homedir } from 'os';
import * as atomlinter from 'atom-linter';
import { readFile as fsReadFile, access } from 'fs';
// eslint-disable-next-line import/extensions, import/no-extraneous-dependencies
import type { TextEditor } from 'atom';

let homeConfigPath;

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

export async function getDebugInfo() {
  const textEditor = atom.workspace.getActiveTextEditor();
  let editorScopes;
  if (atom.workspace.isTextEditor(textEditor)) {
    editorScopes = textEditor.getLastCursor().getScopeDescriptor().getScopesArray();
  } else {
    // Somehow this can be called with no active TextEditor, impossible I know...
    editorScopes = ['unknown'];
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

  const config = atom.config.get('linter-jshint');
  const hoursSinceRestart = Math.round((process.uptime() / 3600) * 10) / 10;
  const execPath = config.executablePath !== '' ? config.executablePath :
    path.join(__dirname, '..', 'node_modules', 'jshint', 'bin', 'jshint');
  // NOTE: Yes, `jshint --version` gets output on STDERR...
  const jshintVersion = await atomlinter.execNode(
      execPath, ['--version'], { stream: 'stderr' });

  const returnVal = {
    atomVersion: atom.getVersion(),
    linterJSHintVersion: linterJSHintMeta.version,
    linterJSHintConfig: config,
    // eslint-disable-next-line import/no-dynamic-require
    jshintVersion,
    hoursSinceRestart,
    platform: process.platform,
    editorScopes,
  };
  return returnVal;
}

export async function generateDebugString() {
  const debug = await getDebugInfo();
  const details = [
    `Atom version: ${debug.atomVersion}`,
    `linter-jshint version: ${debug.linterJSHintVersion}`,
    `JSHint version: ${debug.jshintVersion}`,
    `Hours since last Atom restart: ${debug.hoursSinceRestart}`,
    `Platform: ${debug.platform}`,
    `Current file's scopes: ${JSON.stringify(debug.editorScopes, null, 2)}`,
    `linter-jshint configuration: ${JSON.stringify(debug.linterJSHintConfig, null, 2)}`,
  ];
  return details.join('\n');
}

export async function generateInvalidTrace(
  msgLine: number, msgCol: number, filePath: string, textEditor: TextEditor,
  error: Object,
) {
  const errMsgRange = `${msgLine + 1}:${msgCol}`;
  const rangeText = `Requested start point: ${errMsgRange}`;
  const issueURL = 'https://github.com/AtomLinter/linter-eslint/issues/new';
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
    '```json',
    JSON.stringify(await getDebugInfo(), null, 2),
    '```',
  ].join('\n'));
  const newIssueURL = `${issueURL}?title=${title}&body=${body}`;
  return {
    severity: 'error',
    excerpt: `${titleText}. ${rangeText}. Please report this using the message link!`,
    detils: `Original message: ${error.code} - ${error.reason}`,
    url: newIssueURL,
    location: {
      filePath,
      position: atomlinter.generateRange(textEditor),
    },
  };
}
