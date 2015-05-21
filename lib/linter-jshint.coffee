linterPath = atom.packages.getLoadedPackage("linter").path
Linter = require "#{linterPath}/lib/linter"
{findFile, warn} = require "#{linterPath}/lib/utils"
{CompositeDisposable} = require "atom"

class LinterJshint extends Linter
  # The syntax that the linter handles. May be a string or
  # list/tuple of strings. Names should be all lowercase.
  @syntax: 'source.js'

  disableWhenNoJshintrcFileInPath: false

  # A string, list, tuple or callable that returns a string, list or tuple,
  # containing the command line (with arguments) used to lint.
  cmd: ['jshint', '--verbose', '--extract=auto']

  linterName: 'jshint'

  # force the defaultLevel to info which will map to the generic css class .highlight-info which is blue
  # not red (error) nor brown - orange (warning)
  defaultLevel: 'info'

  # A regex pattern used to extract information from the executable's output.
  regex:
    '((?<fail>ERROR: .+)|' +
    '.+?: line (?<line>[0-9]+), col (?<col>[0-9]+), ' +
    '(?<message>.+) ' +
    # capture error, warning and code
    '\\((?<type>(?<error>E)|(?<warning>W)|(?<level>I))(?<code>[0-9]+)\\)'+
    ')'

  isNodeExecutable: yes

  constructor: (editor) ->
    super(editor)

    @disposables = new CompositeDisposable

    config = findFile @cwd, ['.jshintrc']
    ignore = findFile @cwd, ['.jshintignore']
    if config
      @cmd = @cmd.concat ['-c', config]

    if ignore
      @cmd = @cmd.concat ['--exclude-path', ignore]

    @disposables.add atom.config.observe 'linter-jshint.jshintExecutablePath', @formatShellCmd
    @disposables.add atom.config.observe 'linter-jshint.disableWhenNoJshintrcFileInPath',
      (skipNonJshint) =>
        @disableWhenNoJshintrcFileInPath = skipNonJshint

  lintFile: (filePath, callback) ->
    if not @config and @disableWhenNoJshintrcFileInPath
      return

    super(filePath, callback)

  formatShellCmd: =>
    jshintExecutablePath = atom.config.get 'linter-jshint.jshintExecutablePath'
    @executablePath = "#{jshintExecutablePath}"

  formatMessage: (match) ->
    unless match.type
      warn "Regex does not match lint output", match

    "#{match.message} (#{match.type}#{match.code})"

  destroy: ->
    super
    @disposables.dispose()

module.exports = LinterJshint
