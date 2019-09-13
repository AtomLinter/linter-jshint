'use babel';

/* @flow */

import Path from 'path';
/* eslint-disable import/extensions, import/no-extraneous-dependencies */
import { CompositeDisposable } from 'atom';
import type { TextEditor } from 'atom';
/* eslint-enable import/extensions, import/no-extraneous-dependencies */

// Dependencies
let helpers;
let atomlinter;
let Reporter;

function loadDeps() {
  if (!helpers) {
    helpers = require('./helpers');
  }
  if (!atomlinter) {
    atomlinter = require('atom-linter');
  }
  if (!Reporter) {
    Reporter = require('jshint-json');
  }
}

module.exports = {
  activate() {
    this.idleCallbacks = new Set();
    let depsCallbackID;
    const installLinterJSHintDeps = () => {
      this.idleCallbacks.delete(depsCallbackID);
      if (!atom.inSpecMode()) {
        require('atom-package-deps').install('linter-jshint');
      }
      loadDeps();
    };
    depsCallbackID = window.requestIdleCallback(installLinterJSHintDeps);
    this.idleCallbacks.add(depsCallbackID);

    this.scopes = [];

    this.subscriptions = new CompositeDisposable();
    const scopeEmbedded = 'source.js.embedded.html';

    this.subscriptions.add(
      atom.config.observe('linter-jshint.executablePath', (value) => {
        if (value === '') {
          this.executablePath = Path.join(__dirname, '..', 'node_modules', 'jshint', 'bin', 'jshint');
        } else {
          this.executablePath = value;
        }
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
      atom.config.observe('linter-jshint.scopes', (value) => {
        // NOTE: Subscriptions are created in the order given to add() so this
        // is safe at the end.

        // Remove any old scopes
        this.scopes.splice(0, this.scopes.length);
        // Add the current scopes
        Array.prototype.push.apply(this.scopes, value);
        // Re-check the embedded JS scope
        if (this.lintInlineJavaScript && this.scopes.indexOf(scopeEmbedded) !== -1) {
          this.scopes.push(scopeEmbedded);
        }
      }),
      atom.commands.add('atom-text-editor', {
        'linter-jshint:debug': async () => {
          loadDeps();
          const debugString = await helpers.generateDebugString();
          const notificationOptions = { detail: debugString, dismissable: true };
          atom.notifications.addInfo('linter-jshint:: Debugging information', notificationOptions);
        },
      }),
    );
  },

  deactivate() {
    this.idleCallbacks.forEach((callbackID) => window.cancelIdleCallback(callbackID));
    this.idleCallbacks.clear();
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
        loadDeps();
        const parameters = ['--reporter', Reporter, '--filename', filePath];

        const configFile = await atomlinter.findCachedAsync(fileDir, this.jshintFileName);

        if (configFile) {
          if (this.jshintFileName !== '.jshintrc') {
            parameters.push('--config', configFile);
          }
        } else if (this.disableWhenNoJshintrcFileInPath && !(await helpers.hasHomeConfig())) {
          return results;
        }

        // JSHint completely ignores .jshintignore files for STDIN on it's own
        // so we must re-implement the functionality
        const ignoreFile = await atomlinter.findCachedAsync(fileDir, this.jshintignoreFilename);
        if (ignoreFile) {
          const isIgnored = await helpers.isIgnored(filePath, ignoreFile);
          if (isIgnored) {
            return [];
          }
        }

        if (this.lintInlineJavaScript
          && textEditor.getGrammar().scopeName.indexOf('text.html') !== -1
        ) {
          parameters.push('--extract', 'always');
        }
        parameters.push('-');

        const execOpts = {
          stdin: fileContents,
          ignoreExitCode: true,
          cwd: fileDir,
        };
        const result = await atomlinter.execNode(this.executablePath, parameters, execOpts);

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
          atom.notifications.addWarning(
            '[Linter-JSHint]',
            { detail: 'JSHint return an invalid response, check your console for more info' },
          );
          return results;
        }

        Object.keys(parsed.result).forEach((entryID) => {
          let message;
          const entry = parsed.result[entryID];

          const { error } = entry;
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
            message = helpers.generateInvalidTrace(line, character, filePath, textEditor, error);
          }

          results.push(message);
        });

        // Make sure any invalid traces have resolved
        return Promise.all(results);
      },
    };
  },
};
