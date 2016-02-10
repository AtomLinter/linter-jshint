{CompositeDisposable} = require 'atom'
path = require 'path'

module.exports =
  config:
    executablePath:
      type: 'string'
      default: path.join(__dirname, '..', 'node_modules', 'jshint', 'bin', 'jshint')
      description: 'Path of the `jshint` executable.'
    lintInlineJavaScript:
      type: 'boolean'
      default: false
      description: 'Lint JavaScript inside `<script>` blocks in HTML or PHP files.'
    disableWhenNoJshintrcFileInPath:
      type: 'boolean'
      default: false
      description: 'Disable linter when no `.jshintrc` is found in project.'
    lintJSXFiles:
      title: 'Lint JSX Files'
      type: 'boolean'
      default: false

  activate: ->
    @subscriptions = new CompositeDisposable
    @subscriptions.add atom.config.observe 'linter-jshint.executablePath',
      (executablePath) =>
        @executablePath = executablePath

    @scopes = ['source.js', 'source.js.jsx', 'source.js-semantic']

    scopeEmbedded = 'source.js.embedded.html'
    @subscriptions.add atom.config.observe 'linter-jshint.lintInlineJavaScript',
      (lintInlineJavaScript) =>
        if lintInlineJavaScript
          @scopes.push(scopeEmbedded)
        else
          @scopes.splice(@scopes.indexOf(scopeEmbedded), 1) if scopeEmbedded in @scopes

    scopeJSX = 'source.js.jsx'
    @subscriptions.add atom.config.observe 'linter-jshint.lintJSXFiles',
      (lintJSXFiles) =>
        if lintJSXFiles
          @scopes.push(scopeJSX)
        else
          @scopes.splice(@scopes.indexOf(scopeJSX), 1) if lintJSXFiles in @scopes

    @subscriptions.add atom.config.observe 'linter-jshint.disableWhenNoJshintrcFileInPath',
      (disableWhenNoJshintrcFileInPath) =>
        @disableWhenNoJshintrcFileInPath = disableWhenNoJshintrcFileInPath

  deactivate: ->
    @subscriptions.dispose()

  provideLinter: ->
    helpers = require('atom-linter')
    reporter = require('jshint-json') # a string path
    provider =
      name: 'JSHint'
      grammarScopes: @scopes
      scope: 'file'
      lintOnFly: true
      lint: (textEditor) =>
        filePath = textEditor.getPath()
        if @disableWhenNoJshintrcFileInPath and not helpers.find(filePath, '.jshintrc')
          return []

        text = textEditor.getText()
        parameters = ['--reporter', reporter, '--filename', filePath]
        if textEditor.getGrammar().scopeName.indexOf('text.html') isnt -1 and 'source.js.embedded.html' in @scopes
          parameters.push('--extract', 'always')
        parameters.push('-')
        return helpers.execNode(@executablePath, parameters, {stdin: text}).then (output) ->
          unless output.length
            return []
          output = JSON.parse(output).result
          output = output.filter((entry) -> entry.error.id)
          return output.map (entry) ->
            error = entry.error
            line = error.line - 1
            # First, check if we are hitting jshint GH2846
            # TODO: Remove when JSHint > 2.9.1 is released
            if error.character?
              col = error.character
              # Now check if we are hitting esprima GH1457
              # TODO: Remove when JSHint uses esprima > 2.7.2
              maxCol = textEditor.getBuffer().lineLengthForRow(line)
              col = maxCol if col > maxCol
              range = helpers.rangeFromLineNumber(textEditor, line, col)
            else
              range = helpers.rangeFromLineNumber(textEditor, line)
            type = error.code.substr(0, 1)
            return {
              type: if type is 'E' then 'Error' else if type is 'W' then 'Warning' else 'Info'
              text: "#{error.code} - #{error.reason}"
              filePath
              range
            }
