path = require 'path'

module.exports =
  configDefaults:
    jshintExecutablePath: path.join __dirname, '..', 'node_modules', 'jshint', 'bin'
    jshintExecutable: 'jshint'

  activate: ->
    console.log 'activate linter-jshint'
