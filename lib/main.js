'use babel';

/* @flow */

import Path from 'path';
import minimatch from 'minimatch';
import * as atomlinter from 'atom-linter';
/* eslint-disable import/extensions, import/no-extraneous-dependencies */
import { CompositeDisposable } from 'atom';
import type { TextEditor } from 'atom';
/* eslint-enable import/extensions, import/no-extraneous-dependencies */
import * as helpers from './helpers';

let Reporter;

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
      type: 'array',
      default: [
        'source.js',
        'source.js-semantic',
      ],
      description: 'List of scopes to run JSHint on, run `Editor: Log Cursor Scope` to determine the scopes for a file.',
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
    const scopeEmbedded = 'source.js.embedded.html';

    this.subscriptions.add(
      atom.config.observe('linter-jshint.executablePath', (value) => {
        this.executablePath = value;
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
        this.lintInlineJavaScript = value;
        if (value) {
          this.scopes.push(scopeEmbedded);
        } else if (this.scopes.indexOf(scopeEmbedded) !== -1) {
          this.scopes.splice(this.scopes.indexOf(scopeEmbedded), 1);
        }
      }),
    );
    // NOTE: Separating this out from the others to ensure lintInlineJavaScript is set
    this.subscriptions.add(
      atom.config.observe('linter-jshint.scopes', (value) => {
        // Remove any old scopes
        this.scopes.splice(0, this.scopes.length);
        // Add the current scopes
        Array.prototype.push.apply(this.scopes, value);
        // Re-check the embedded JS scope
        if (this.lintInlineJavaScript && this.scopes.indexOf(scopeEmbedded) !== -1) {
          this.scopes.push(scopeEmbedded);
        }
      }),
    );

    this.subscriptions.add(
      atom.commands.add('atom-text-editor', {
        'linter-jshint:debug': async () => {
          const debugString = await helpers.generateDebugString();
          const notificationOptions = { detail: debugString, dismissable: true };
          atom.notifications.addInfo('linter-jshint:: Debugging information', notificationOptions);
        },
      }),
    );
  },

  deactivate() {
    this.subscriptions.dispose();
  },

  provideLinter() {
    return {
      name: 'JSHint',
      grammarScopes: this.scopes,
      scope: 'file',
      lintsOnChange: true,
      lint: async (textEditor: TextEditor) => {
        const results = [];
        const filePath = textEditor.getPath();
        const fileDir = Path.dirname(filePath);
        const fileContents = textEditor.getText();
        if (!Reporter) {
          Reporter = require('jshint-json');
        }
        const parameters = ['--reporter', Reporter, '--filename', filePath];

        const configFile = await atomlinter.findCachedAsync(fileDir, this.jshintFileName);

        if (configFile) {
          parameters.push('--config', configFile);
        } else if (this.disableWhenNoJshintrcFileInPath) {
          return results;
        }

        const ignoreFile = await atomlinter.findCachedAsync(fileDir, this.jshintignoreFilename);

        if (ignoreFile) {
          // JSHint completely ignores .jshintignore files for STDIN on it's own
          // so we must re-implement the functionality
          const ignoreList = await helpers.readIgnoreList(ignoreFile);
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
        const result = await atomlinter.execNode(
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

        Object.keys(parsed.result).forEach(async (entryID) => {
          let message;
          const entry = parsed.result[entryID];

          if (!entry.error.id) {
            return;
          }

          const error = entry.error;
          const errorType = error.code.substr(0, 1);
          let severity = 'info';
          if (errorType === 'E') {
            severity = 'error';
          } else if (errorType === 'W') {
            severity = 'warning';
          }
          const line = error.line > 0 ? error.line - 1 : 0;
          const character = error.character > 0 ? error.character - 1 : 0;
          try {
            const position = atomlinter.generateRange(textEditor, line, character);
            message = {
              severity,
              excerpt: `${error.code} - ${error.reason}`,
              location: {
                file: filePath,
                position,
              },
            };
          } catch (e) {
            message = await helpers.generateInvalidTrace(
              line, character, filePath, textEditor, error);
          }

          results.push(message);
        });
        return results;
      },
    };
  },
};
