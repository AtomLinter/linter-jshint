{CompositeDisposable} =  require 'atom'

module.exports =
  config:
    jshintExecutablePath:
      default: ''
      title: 'JSHint Executable Path'
      type: 'string'
      description: "Leave empty to use bundled"

  activate: ->
    @subscriptions = new CompositeDisposable
    @subscriptions.add atom.config.observe 'linter-jshint.jshintExecutablePath', (value) =>
      @executablePath = value

  deactivate: ->
    @subscriptions.dispose()

  provideLinter: ->
    helpers = require('atom-linter')
    provider =
      grammarScopes: ['source.js']
      scope: 'file'
      lintOnFly: true
      lint: (textEditor) =>
        return new Promise (resolve, reject) =>
          message = {type: 'Error', text: 'Something went wrong', range:[[0,0], [0,1]]}
          resolve([message])
