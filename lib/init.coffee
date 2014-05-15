path = require 'path'

module.exports =
  configDefaults:
    jshintExecutablePath: path.join __dirname, '..', 'node_modules', 'jshint', 'bin'
    nodeExecutablePath: path.join require.resolve('package'), '..', 'apm/node_modules/atom-package-manager/bin/node'

  activate: ->
    console.log 'activate linter-jshint'
