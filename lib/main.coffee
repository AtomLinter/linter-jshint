
module.exports =
  config:
    jshintExecutablePath:
      default: ''
      type: 'string'
      description: 'Leave empty to use bundled'
  provideLinter: ->
    if process.platform is 'win32'
      jshintPath = require('path').join(__dirname, '..', 'node_modules', '.bin', 'jshint.cmd')
    else
      jshintPath = require('path').join(__dirname, '..', 'node_modules', '.bin', 'jshint')
    helpers = require('atom-linter')
    reporter = require('jshint-json') # a string path
    provider =
      grammarScopes: ['source.js', 'source.js.jsx']
      scope: 'file'
      lintOnFly: true
      lint: (textEditor) ->
        exePath = atom.config.get('linter-jshint.jshintExecutablePath') || jshintPath
        filePath = textEditor.getPath()
        text = textEditor.getText()
        parameters = ['--reporter', reporter, '--extract', 'auto', '--filename', filePath, '-']
        return helpers.exec(exePath, parameters, {stdin: text}).then (output) ->
          try
            output = JSON.parse(output).result
          catch error
            atom.notifications.addError("Invalid Result recieved from JSHint", {detail: "Check your console for more info", dismissible: true})
            console.log('JSHint Result:', output)
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
