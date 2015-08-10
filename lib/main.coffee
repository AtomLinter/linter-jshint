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

  activate: ->
    @subscriptions = new CompositeDisposable
    @subscriptions.add atom.config.observe 'linter-jshint.executablePath',
      (executablePath) =>
        @executablePath = executablePath
    scopeEmbedded = 'source.js.embedded.html'
    @scopes = ['source.js', 'source.js.jsx', 'source.js-semantic']
    @subscriptions.add atom.config.observe 'linter-jshint.lintInlineJavaScript',
      (lintInlineJavaScript) =>
        if lintInlineJavaScript
          @scopes.push(scopeEmbedded) unless scopeEmbedded in @scopes
        else
          @scopes.splice(@scopes.indexOf(scopeEmbedded), 1) if scopeEmbedded in @scopes
    @subscriptions.add atom.config.observe 'linter-jshint.disableWhenNoJshintrcFileInPath',
      (disableWhenNoJshintrcFileInPath) =>
        @disableWhenNoJshintrcFileInPath = disableWhenNoJshintrcFileInPath

  deactivate: ->
    @subscriptions.dispose()

  provideLinter: ->
    helpers = require('atom-linter')
    reporter = require('jshint-json') # a string path
    provider =
      grammarScopes: @scopes
      scope: 'file'
      lintOnFly: true
      lint: (textEditor) =>
        filePath = textEditor.getPath()
        if @disableWhenNoJshintrcFileInPath and !helpers.findFile(filePath, '.jshintrc')
            return []

        text = textEditor.getText()
        parameters = ['--reporter', reporter, '--filename', filePath]
        if textEditor.getGrammar().scopeName.indexOf('text.html') isnt -1 and 'source.js.embedded.html' in @scopes
          parameters.push('--extract', 'always')
        parameters.push('-')
        return helpers.execNode(@executablePath, parameters, {stdin: text}).then (output) ->
          unless output.length
            atom.notifications.addError("Error Executing JSHint executable", {detail: "It's a known bug on OSX. See https://github.com/AtomLinter/Linter/issues/726", dismissable: true})
            return []
          output = JSON.parse(output).result
          output = output.filter((entry) -> entry.error.id)
          return output.map (entry) ->
            error = entry.error
            pointStart = [error.line - 1, error.character - 1]
            pointEnd = [error.line - 1, error.character]
            type = error.code.substr(0, 1)
            return {
              type: if type is 'E' then 'Error' else if type is 'W' then 'Warning' else 'Info'
              text: "#{error.code} - #{error.reason}"
              filePath
              range: [pointStart, pointEnd]
            }
