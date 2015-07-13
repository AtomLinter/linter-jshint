path = require('path')
jsHintName = if process.platform is 'win32' then 'jshint.cmd' else 'jshint'

module.exports =
  config:
    jshintExecutablePath:
      type: 'string'
      default: path.join(__dirname, '..', 'node_modules', '.bin', jsHintName)
      description: 'Path of the `jshint` executable'

  provideLinter: ->
    helpers = require('atom-linter')
    reporter = require('jshint-json') # a string path
    provider =
      grammarScopes: ['source.js', 'source.js.jsx']
      scope: 'file'
      lintOnFly: true
      lint: (textEditor) ->
        executablePath = atom.config.get('linter-jshint.jshintExecutablePath')
        filePath = textEditor.getPath()
        text = textEditor.getText()
        parameters = ['--reporter', reporter, '--extract', 'auto', '--filename', filePath, '-']
        return helpers.exec(executablePath, parameters, {stdin: text}).then (output) ->
          try
            output = JSON.parse(output).result
          catch error
            atom.notifications.addError('Invalid result recieved from JSHint', {detail: 'Check your console for more informations', dismissible: true})
            console.log('JSHint result:', output)
            return []
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
