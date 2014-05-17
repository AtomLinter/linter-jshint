{parseString} = require 'xml2js'

{Range} = require 'atom'

linterPath = atom.packages.getLoadedPackage('linter').path
Linter = require "#{linterPath}/lib/linter"
findFile = require "#{linterPath}/lib/util"

class LinterJshint extends Linter
  # The syntax that the linter handles. May be a string or
  # list/tuple of strings. Names should be all lowercase.
  @syntax: ['source.js', 'source.js.jquery', 'text.html.basic'] # , 'text.html.twig', 'text.html.erb', 'text.html.ruby']

  # A string, list, tuple or callable that returns a string, list or tuple,
  # containing the command line (with arguments) used to lint.
  cmd: 'jshint --reporter=checkstyle'

  linterName: 'jshint'

  isNodeExecutable: yes

  constructor: (editor) ->
    super(editor)

    config = findFile @cwd, ['.jshintrc']
    if config
      @cmd += " -c #{config}"

    atom.config.observe 'linter-jshint.jshintExecutablePath', @formatShellCmd

  formatShellCmd: =>
    jshintExecutablePath = atom.config.get 'linter-jshint.jshintExecutablePath'
    @executablePath = jshintExecutablePath

  processMessage: (xml, callback) ->
    parseString xml, (err, messagesUnprocessed) =>
      return err if err
      messages = messagesUnprocessed.checkstyle.file[0].error.map (message) =>
        message: message.$.message
        line: message.$.line
        col: message.$.column
        range: new Range([message.$.line - 1, message.$.column], [message.$.line - 1, message.$.column + 1])
        level: message.$.severity
        linter: @linterName
      callback? messages if messages?

  destroy: ->
    atom.config.unobserve 'linter-jshint.jshintExecutablePath'

module.exports = LinterJshint
