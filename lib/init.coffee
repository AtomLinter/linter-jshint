path = require 'path'

module.exports =
  config:
    jshintExecutablePath:
      default: path.join __dirname, '..', 'node_modules', 'jshint', 'bin'
      title: 'JSHint Executable Path'
      type: 'string'

    disableWhenNoJshintrcFileInPath:
      default: false
      title: 'Disable when no .jshintrc file found in path'
      type: 'boolean'

  activate: ->
    console.log 'activate linter-jshint'
  provideLinter: ->
    provider =
      grammarScopes: ['source.js']
      scope: 'file'
      lintOnFly: true
      lint: (textEditor)->
        return new Promise (resolve, reject)->
          message = {type: 'Error', text: 'Something went wrong', range:[[0,0], [0,1]]}
          resolve([message])
