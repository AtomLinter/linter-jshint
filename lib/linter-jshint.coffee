linterPath = atom.packages.getLoadedPackage("linter").path
Linter = require "#{linterPath}/lib/linter"
path = require 'path'
fs = require 'fs'

class LinterJshint extends Linter
  # The syntax that the linter handles. May be a string or
  # list/tuple of strings. Names should be all lowercase.
  @syntax: ['source.js', 'source.js.jquery', 'text.html.basic'] # , 'text.html.twig', 'text.html.erb', 'text.html.ruby']

  # A string, list, tuple or callable that returns a string, list or tuple,
  # containing the command line (with arguments) used to lint.
  cmd: 'jshint --verbose --extract=auto'

  executablePath: null

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

  constructor: (editorView)->
    # Let's find a `.jshintrc` file to use
    # with the JSHint cli
    jshintrc = @findJSHintrc()
    @cmd = "#{@cmd} -c #{jshintrc}" if jshintrc

    @executablePath = atom.config.get 'linter-jshint.jshintExecutablePath'

  findJSHintrc: ->
    projectDir = atom.project.path
    jshintrcPath = path.join projectDir, '.jshintrc'
    # Check if there's a `.jshintrc` file in project dir
    if fs.existsSync jshintrcPath
      # found, return this file
      return jshintrcPath
    else
      # Okey no `.jshintrc` file found in project dir
      # let's try in home folder
      homeDir = process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE
      jshintrcPath = path.join homeDir, '.jshintrc'
      if fs.existsSync jshintrcPath
        # found in Home dir, return this file
        return jshintrcPath
      else
        # nothing false, let's use default config
        return false

module.exports = LinterJshint
