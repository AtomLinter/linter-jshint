'use babel'

/* @flow */

import Path from 'path'
import { CompositeDisposable } from 'atom'

type Linter$Provider = Object

module.exports = {
  config: {
    executablePath: {
      type: 'string',
      default: Path.join(__dirname, '..', 'node_modules', 'jshint', 'bin', 'jshint'),
      description: 'Path of the `jshint` node script'
    },
    lintInlineJavaScript: {
      type: 'boolean',
      default: false,
      description: 'Lint JavaScript inside `<script>` blocks in HTML or PHP files.'
    },
    disableWhenNoJshintrcFileInPath: {
      type: 'boolean',
      default: false,
      description: 'Disable linter when no `.jshintrc` is found in project.'
    },
    lintJSXFiles: {
      title: 'Lint JSX Files',
      type: 'boolean',
      default: false
    }
  },

  activate() {
    require('atom-package-deps').install('linter-jshint')
    this.scopes = ['source.js', 'source.js-semantic']
    this.subscriptions = new CompositeDisposable()
    this.subscriptions.add(atom.config.observe('linter-jshint.executablePath', executablePath => {
      this.executablePath = executablePath
    }))
    this.subscriptions.add(
      atom.config.observe('linter-jshint.disableWhenNoJshintrcFileInPath',
        disableWhenNoJshintrcFileInPath => {
          this.disableWhenNoJshintrcFileInPath = disableWhenNoJshintrcFileInPath
        }
      )
    )

    const scopeJSX = 'source.js.jsx'
    this.subscriptions.add(atom.config.observe('linter-jshint.lintJSXFiles', lintJSXFiles => {
      this.lintJSXFiles = lintJSXFiles
      if (lintJSXFiles) {
        this.scopes.push(scopeJSX)
      } else {
        if (this.scopes.indexOf(scopeJSX) !== -1) {
          this.scopes.splice(this.scopes.indexOf(scopeJSX), 1)
        }
      }
    }))

    const scopeEmbedded = 'source.js.embedded.html'
    this.subscriptions.add(atom.config.observe('linter-jshint.lintInlineJavaScript',
      lintInlineJavaScript => {
        this.lintInlineJavaScript = lintInlineJavaScript
        if (lintInlineJavaScript) {
          this.scopes.push(scopeEmbedded)
        } else {
          if (this.scopes.indexOf(scopeEmbedded) !== -1) {
            this.scopes.splice(this.scopes.indexOf(scopeEmbedded), 1)
          }
        }
      }
    ))
  },

  deactivate() {
    this.subscriptions.dispose()
  },

  provideLinter(): Linter$Provider {
    const Helpers = require('atom-linter')
    const Reporter = require('jshint-json')

    return {
      name: 'JSHint',
      grammarScopes: this.scopes,
      scope: 'file',
      lintOnFly: true,
      lint: async (textEditor) => {
        const results = []
        const filePath = textEditor.getPath()
        const fileContents = textEditor.getText()
        const parameters = ['--reporter', Reporter, '--filename', filePath]

        let configFile = null
        if (this.disableWhenNoJshintrcFileInPath) {
          configFile = await Helpers.findCachedAsync(Path.dirname(filePath), '.jshintrc')
          if (configFile) {
            parameters.push('--config', configFile)
          } else {
            return results
          }
        }
        if (this.lintInlineJavaScript &&
          textEditor.getGrammar().scopeName.indexOf('text.html') !== -1
        ) {
          parameters.push('--extract', 'always')
        }
        parameters.push('-')

        const result = await Helpers.execNode(
          this.executablePath, parameters, { stdin: fileContents }
        )
        let parsed
        try {
          parsed = JSON.parse(result)
        } catch (_) {
          console.error('[Linter-JSHint]', _, result)
          atom.notifications.addWarning('[Linter-JSHint]',
            { detail: 'JSHint return an invalid response, check your console for more info' }
          )
          return results
        }

        for (const entry of parsed.result) {
          if (!entry.error.id) {
            continue
          }

          const error = entry.error
          const errorType = error.code.substr(0, 1)
          const errorLine = error.line > 0 ? error.line - 1 : 0
          let range

          // TODO: Remove workaround of jshint/jshint#2846
          if (error.character === null) {
            range = Helpers.rangeFromLineNumber(textEditor, errorLine)
          } else {
            let character = error.character > 0 ? error.character - 1 : 0
            // TODO: Remove workaround of jquery/esprima#1457
            const maxCharacter = textEditor.getBuffer().lineLengthForRow(errorLine)
            if (character > maxCharacter) {
              character = maxCharacter
            }
            range = Helpers.rangeFromLineNumber(textEditor, errorLine, character)
          }

          results.push({
            type: errorType === 'E' ? 'Error' : errorType === 'W' ? 'Warning' : 'Info',
            text: `${error.code} - ${error.reason}`,
            filePath,
            range
          })
        }
        return results
      }
    }
  }
}
