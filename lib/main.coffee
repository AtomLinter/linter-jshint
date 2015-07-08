
module.exports =
  provideLinter: ->
    jshintPath = require('path').join(__dirname, '..', 'node_modules', '.bin', 'jshint')
    helpers = require('atom-linter')
    reporter = require('jshint-json') # a string path
    provider =
      grammarScopes: ['source.js']
      scope: 'file'
      lintOnFly: true
      lint: (textEditor) ->
        return new Promise (resolve) ->
          filePath = textEditor.getPath()
          text = textEditor.getText()
          parameters = ['--reporter', reporter, '--extract', 'auto']
          return helpers.exec(jshintPath, parameters, {stdin: text}).then (output) ->
            console.log output
            return []
