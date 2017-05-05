'use babel';

/* @flow */

import Path from 'path';
import { readFile } from 'fs';
import minimatch from 'minimatch';
/* eslint-disable import/extensions, import/no-extraneous-dependencies */
import { CompositeDisposable } from 'atom';
import type { TextEditor } from 'atom';
/* eslint-enable import/extensions, import/no-extraneous-dependencies */

async function readIgnoreList(ignorePath) {
  return new Promise((resolve, reject) => {
    readFile(ignorePath, 'utf8', (err, data) => {
      if (err) {
        reject(err);
      }
      resolve(data.split(/[\r\n]/));
    });
  });
}

module.exports = {
  config: {
    executablePath: {
      type: 'string',
      default: Path.join(__dirname, '..', 'node_modules', 'jshint', 'bin', 'jshint'),
      description: 'Path of the `jshint` node script',
    },
    lintInlineJavaScript: {
      type: 'boolean',
      default: false,
      description: 'Attempts to lint JavaScript inside `<script>` blocks in HTML or PHP files.',
    },
    disableWhenNoJshintrcFileInPath: {
      type: 'boolean',
      default: false,
      description: 'Disable the provider when no configuration file is found.',
    },
    scopes: {
      description: 'List of scopes to run JSHint on, run `Editor: Log Cursor Scope` to determine the scopes for a file.',
      type: 'array',
      default: [
        'source.js',
        'source.js-semantic',
      ],
    },
    jshintFileName: {
      type: 'string',
      default: '.jshintrc',
      description: 'Custom name for the .jshintrc file',
    },
    jshintignoreFilename: {
      type: 'string',
      default: '.jshintignore',
      description: 'Custom name for the .jshintignore file',
    },
  },

  activate() {
    require('atom-package-deps').install('linter-jshint');

    this.scopes = [];


    this.subscriptions = new CompositeDisposable();

    this.subscriptions.add(
      atom.config.observe('linter-jshint.executablePath', (value) => {
        this.executablePath = value;
      }),
      atom.config.observe('linter-jshint.scopes', (value) => {
        this.scopes = value;
      }),
      atom.config.observe('linter-jshint.disableWhenNoJshintrcFileInPath', (value) => {
        this.disableWhenNoJshintrcFileInPath = value;
      }),
      atom.config.observe('linter-jshint.jshintFileName', (value) => {
        this.jshintFileName = value;
      }),
      atom.config.observe('linter-jshint.jshintignoreFilename', (value) => {
        this.jshintignoreFilename = value;
      }),
      atom.config.observe('linter-jshint.lintInlineJavaScript', (value) => {
        const scopeEmbedded = 'source.js.embedded.html';
        this.lintInlineJavaScript = value;
        if (value) {
          this.scopes.push(scopeEmbedded);
        } else if (this.scopes.indexOf(scopeEmbedded) !== -1) {
          this.scopes.splice(this.scopes.indexOf(scopeEmbedded), 1);
        }
      }),
    );
  },

  deactivate() {
    this.subscriptions.dispose();
  },

  provideLinter() {
    const Helpers = require('atom-linter');
    const Reporter = require('jshint-json');

    return {
      name: 'JSHint',
      grammarScopes: this.scopes,
      scope: 'file',
      lintOnFly: true,
      lint: async (textEditor: TextEditor) => {
        const results = [];
        const filePath = textEditor.getPath();
        const fileDir = Path.dirname(filePath);
        const fileContents = textEditor.getText();
        const parameters = ['--reporter', Reporter, '--filename', filePath];

        const configFile = await Helpers.findCachedAsync(fileDir, this.jshintFileName);

        if (configFile) {
          parameters.push('--config', configFile);
        } else if (this.disableWhenNoJshintrcFileInPath) {
          return results;
        }

        const ignoreFile = await Helpers.findCachedAsync(fileDir, this.jshintignoreFilename);

        if (ignoreFile) {
          // JSHint completely ignores .jshintignore files for STDIN on it's own
          // so we must re-implement the functionality
          const ignoreList = await readIgnoreList(ignoreFile);
          if (ignoreList.some(pattern => minimatch(filePath, pattern))) {
            // The file is ignored by one of the patterns
            return [];
          }
        }

        if (this.lintInlineJavaScript &&
          textEditor.getGrammar().scopeName.indexOf('text.html') !== -1
        ) {
          parameters.push('--extract', 'always');
        }
        parameters.push('-');

        const execOpts = {
          stdin: fileContents,
          ignoreExitCode: true,
          cwd: fileDir,
        };
        const result = await Helpers.execNode(
          this.executablePath, parameters, execOpts,
        );

        if (textEditor.getText() !== fileContents) {
          // File has changed since the lint was triggered, tell Linter not to update
          return null;
        }

        let parsed;
        try {
          parsed = JSON.parse(result);
        } catch (_) {
          // eslint-disable-next-line no-console
          console.error('[Linter-JSHint]', _, result);
          atom.notifications.addWarning('[Linter-JSHint]',
            { detail: 'JSHint return an invalid response, check your console for more info' },
          );
          return results;
        }

        Object.keys(parsed.result).forEach((entryID) => {
          const entry = parsed.result[entryID];

          if (!entry.error.id) {
            return;
          }

          const error = entry.error;
          const errorType = error.code.substr(0, 1);
          let type = 'Info';
          if (errorType === 'E') {
            type = 'Error';
          } else if (errorType === 'W') {
            type = 'Warning';
          }
          const errorLine = error.line > 0 ? error.line - 1 : 0;
          let range;

          // TODO: Remove workaround of jshint/jshint#2846
          if (error.character === null) {
            range = Helpers.generateRange(textEditor, errorLine);
          } else {
            let character = error.character > 0 ? error.character - 1 : 0;
            let line = errorLine;
            const buffer = textEditor.getBuffer();
            const maxLine = buffer.getLineCount();
            // TODO: Remove workaround of jshint/jshint#2894
            if (errorLine >= maxLine) {
              line = maxLine;
            }
            const maxCharacter = buffer.lineLengthForRow(line);
            // TODO: Remove workaround of jquery/esprima#1457
            if (character > maxCharacter) {
              character = maxCharacter;
            }
            range = Helpers.generateRange(textEditor, line, character);
          }

          results.push({
            type,
            text: `${error.code} - ${error.reason}`,
            filePath,
            range,
          });
        });
        return results;
      },
    };
  },
};
