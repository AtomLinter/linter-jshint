linterPath = atom.packages.getLoadedPackage("linter").path
Linter = require "#{linterPath}/lib/linter"
findFile = require "#{linterPath}/lib/util"

class LinterJshint extends Linter
  # The syntax that the linter handles. May be a string or
  # list/tuple of strings. Names should be all lowercase.
  @syntax: ['source.js', 'source.js.jquery', 'text.html.basic']

  # A string, list, tuple or callable that returns a string, list or tuple,
  # containing the command line (with arguments) used to lint.
  cmd: 'jshint --verbose --extract=auto'

  linterName: 'jshint'

  # A regex pattern used to extract information from the executable's output.
  regex:
    '((?<fail>ERROR: .+)|' +
    '.+?: line (?<line>[0-9]+), col (?<col>[0-9]+), ' +
    '(?<message>.+) ' +
    # capture error, warning and code
    '\\(((?<error>E)|(?<warning>W))(?<code>[0-9]+)\\)'+
    # '\\((?<warning>.).+\\)'
    ')'

  isNodeExecutable: yes

  constructor: (editor) ->
    super(editor)

    config = findFile @cwd, ['.jshintrc']
    if config
      @cmd += " -c #{config}"

    atom.config.observe 'linter-jshint.jshintExecutablePath', @formatShellCmd

  formatShellCmd: =>
    jshintExecutablePath = atom.config.get 'linter-jshint.jshintExecutablePath'
    @executablePath = "#{jshintExecutablePath}"

  destroy: ->
    atom.config.unobserve 'linter-jshint.jshintExecutablePath'

module.exports = LinterJshint
