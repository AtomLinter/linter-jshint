linterPath = atom.packages.getLoadedPackage("linter").path
Linter = require "#{linterPath}/lib/linter"

class LinterJshint extends Linter
  # The syntax that the linter handles. May be a string or
  # list/tuple of strings. Names should be all lowercase.
  @syntax: ['source.js', 'source.js.jquery', 'text.html.basic'] # , 'text.html.twig', 'text.html.erb', 'text.html.ruby']

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

  constructor: (editor)->
    @cwd = path.dirname(editor.getUri())
    @executablePath = atom.config.get 'linter-jshint.jshintExecutablePath'

module.exports = LinterJshint
