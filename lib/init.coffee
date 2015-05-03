path = require 'path'

module.exports =
  config:
    jshintExecutablePath:
      default: path.join __dirname, '..', 'node_modules', 'jshint', 'bin'
      title: 'JSHint Executable Path'
      type: 'string'

  activate: ->
    console.log 'activate linter-jshint'
