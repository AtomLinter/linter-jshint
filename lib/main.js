'use babel';

/* @flow */

import Path from 'path';
// eslint-disable-next-line import/extensions, import/no-extraneous-dependencies
import { CompositeDisposable } from 'atom';

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
      description: 'Lint JavaScript inside `<script>` blocks in HTML or PHP files.',
    },
    disableWhenNoJshintrcFileInPath: {
      type: 'boolean',
      default: false,
      description: 'Disable linter when no `.jshintrc` is found in project.',
    },
    jshintFileName: {
      type: 'string',
      default: '.jshintrc',
      description: 'jshint file name',
    },
  },

  activate() {
    require('atom-package-deps').install('linter-jshint');

    this.scopes = ['source.js', 'source.js-semantic'];
    this.subscriptions = new CompositeDisposable();
    this.subscriptions.add(atom.config.observe('linter-jshint.executablePath', (executablePath) => {
      this.executablePath = executablePath;
    }));
    this.subscriptions.add(
      atom.config.observe('linter-jshint.disableWhenNoJshintrcFileInPath',
        (disableWhenNoJshintrcFileInPath) => {
          this.disableWhenNoJshintrcFileInPath = disableWhenNoJshintrcFileInPath;
        },
      ),
    );

    this.subscriptions.add(atom.config.observe('linter-jshint.jshintFileName', (jshintFileName) => {
      this.jshintFileName = jshintFileName;
    }));

    const scopeEmbedded = 'source.js.embedded.html';
    this.subscriptions.add(atom.config.observe('linter-jshint.lintInlineJavaScript',
      (lintInlineJavaScript) => {
        this.lintInlineJavaScript = lintInlineJavaScript;
        if (lintInlineJavaScript) {
          this.scopes.push(scopeEmbedded);
        } else if (this.scopes.indexOf(scopeEmbedded) !== -1) {
          this.scopes.splice(this.scopes.indexOf(scopeEmbedded), 1);
        }
      },
    ));
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
      lint: async (textEditor) => {
        const results = [];
        const filePath = textEditor.getPath();
        const fileContents = textEditor.getText();
        const parameters = ['--reporter', Reporter, '--filename', filePath];

        const configFile = await Helpers.findCachedAsync(
          Path.dirname(filePath), this.jshintFileName,
        );

        if (configFile) {
          parameters.push('--config', configFile);
        } else if (this.disableWhenNoJshintrcFileInPath) {
          return results;
        }

        if (this.lintInlineJavaScript &&
          textEditor.getGrammar().scopeName.indexOf('text.html') !== -1
        ) {
          parameters.push('--extract', 'always');
        }
        parameters.push('-');

        const execOpts = { stdin: fileContents, ignoreExitCode: true };
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
            range = Helpers.rangeFromLineNumber(textEditor, errorLine);
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
            range = Helpers.rangeFromLineNumber(textEditor, line, character);
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
