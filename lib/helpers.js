'use babel';

import path from 'path';
import { homedir } from 'os';
import { test as shjsTest } from 'shelljs';
import minimatch from 'minimatch';
import * as atomlinter from 'atom-linter';
import { readFile as fsReadFile, access } from 'fs';
// eslint-disable-next-line import/extensions, import/no-extraneous-dependencies
import type { TextEditor } from 'atom';

let homeConfigPath;
const debugCache = new Map();

const readFile = async (filePath) => new Promise((resolve, reject) => {
  fsReadFile(filePath, 'utf8', (err, data) => {
    if (err) {
      reject(err);
    }
    resolve(data);
  });
});

export const isIgnored = async (filePath, ignorePath) => {
  const fileDir = path.dirname(filePath);
  const rawIgnoreList = (await readFile(ignorePath)).split(/[\r\n]/);

  // "Fix" the patterns in the same way JSHint does
  const ignoreList = rawIgnoreList.filter((line) => !!line.trim()).map((pattern) => {
    if (pattern.startsWith('!')) {
      return `!${path.resolve(fileDir, pattern.substr(1).trim())}`;
    }
    return path.join(fileDir, pattern.trim());
  });

  // Check the modified patterns
  // NOTE: This is what JSHint actually does, not what the documentation says
  return ignoreList.some((pattern) => {
    // Check the modified pattern against the path using minimatch
    if (minimatch(filePath, pattern, { nocase: true })) {
      return true;
    }

    // Check if a pattern matches filePath exactly
    if (path.resolve(filePath) === pattern) {
      return true;
    }

    // Check using `test -d` for directory exclusions
    if (
      shjsTest('-d', filePath)
      && pattern.match(/^[^/\\]*[/\\]?$/)
      && filePath.match(new RegExp(`^${pattern}.*`))
    ) {
      return true;
    }

    return false;
  });
};

const fileExists = async (checkPath) => new Promise((resolve) => {
  access(checkPath, (err) => {
    if (err) {
      resolve(false);
    }
    resolve(true);
  });
});

export const hasHomeConfig = async () => {
  if (!homeConfigPath) {
    homeConfigPath = path.join(homedir(), '.jshintrc');
  }
  return fileExists(homeConfigPath);
};

function getPackageMeta() {
  // NOTE: This is using a non-public property of the Package object
  // The alternative to this would basically mean re-implementing the parsing
  // that Atom is already doing anyway, and as this is unlikely to change this
  // is likely safe to use.
  return atom.packages.getLoadedPackage('linter-jshint').metadata;
}

async function getJSHintVersion(config) {
  const execPath = config.executablePath !== '' ? config.executablePath
    : path.join(__dirname, '..', 'node_modules', 'jshint', 'bin', 'jshint');

  if (debugCache.has(execPath)) {
    return debugCache.get(execPath);
  }

  // NOTE: Yes, `jshint --version` gets output on STDERR...
  const jshintVersion = await atomlinter.execNode(
    execPath,
    ['--version'],
    { stream: 'stderr' },
  );
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
  const linterJSHintVersion = getPackageMeta().version;
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

/**
 * Finds the oldest open issue of the same title in this project's repository.
 * Results are cached for 1 hour.
 * @param  {string} issueTitle The issue title to search for
 * @return {string|null}       The URL of the found issue or null if none is found.
 */
async function findSimilarIssue(issueTitle) {
  if (debugCache.has(issueTitle)) {
    const oldResult = debugCache.get(issueTitle);
    if ((new Date().valueOf()) < oldResult.expires) {
      return oldResult.url;
    }
    debugCache.delete(issueTitle);
  }

  const oneHour = 1000 * 60 * 60; // ms * s * m
  const tenMinutes = 1000 * 60 * 10; // ms * s * m
  const repoUrl = getPackageMeta().repository.url;
  const repo = repoUrl.replace(/https?:\/\/(\d+\.)?github\.com\//gi, '');
  const query = encodeURIComponent(`repo:${repo} is:open in:title ${issueTitle}`);
  const githubHeaders = new Headers({
    accept: 'application/vnd.github.v3+json',
    contentType: 'application/json',
  });
  const queryUrl = `https://api.github.com/search/issues?q=${query}&sort=created&order=asc`;

  let url = null;
  try {
    const rawResponse = await fetch(queryUrl, { headers: githubHeaders });
    if (!rawResponse.ok) {
      // Querying GitHub API failed, don't try again for 10 minutes.
      debugCache.set(issueTitle, {
        expires: (new Date().valueOf()) + tenMinutes,
        url,
      });
      return null;
    }
    const data = await rawResponse.json();
    if ((data !== null ? data.items : null) !== null) {
      if (Array.isArray(data.items) && data.items.length > 0) {
        const issue = data.items[0];
        if (issue.title.includes(issueTitle)) {
          url = `${repoUrl}/issues/${issue.number}`;
        }
      }
    }
  } catch (e) {
    // Do nothing
  }
  debugCache.set(issueTitle, {
    expires: (new Date().valueOf()) + oneHour,
    url,
  });
  return url;
}

export async function generateInvalidTrace(
  msgLine: number, msgCol: number, file: string, textEditor: TextEditor,
  error: Object,
) {
  const errMsgRange = `${msgLine + 1}:${msgCol}`;
  const rangeText = `Requested point: ${errMsgRange}`;
  const packageRepoUrl = getPackageMeta().repository.url;
  const issueURL = `${packageRepoUrl}/issues/new`;
  const titleText = `Invalid position given by '${error.code}'`;
  const invalidMessage = {
    severity: 'error',
    description: `Original message: ${error.code} - ${error.reason}  \n${rangeText}.`,
    location: {
      file,
      position: atomlinter.generateRange(textEditor),
    },
  };
  const similarIssueUrl = await findSimilarIssue(titleText);
  if (similarIssueUrl !== null) {
    invalidMessage.excerpt = `${titleText}. This has already been reported, see message link!`;
    invalidMessage.url = similarIssueUrl;
    return invalidMessage;
  }

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
  invalidMessage.excerpt = `${titleText}. Please report this using the message link!`;
  invalidMessage.url = newIssueURL;
  return invalidMessage;
}
