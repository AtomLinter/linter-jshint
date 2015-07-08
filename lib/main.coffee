
module.exports =
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
