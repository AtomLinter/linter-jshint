linter-jshint
=========================

This linter plugin for [SublimeLinter](http://sublimelinter.readthedocs.org/) provides an interface to [jshint](http://www.jshint.com/docs/). It will be used with files that have the “JS” or “HTML” syntax.

## Installation
Linter package must be installed in order to use this plugin. If Linter is not installed, please follow the instructions [here](https://github.com/AtomLinter/Linter).

### jshint installation
Before using this plugin, you must ensure that `jshint` is installed on your system. To install `jshint`, do the following:

1. Install [Node.js](http://nodejs.org) (and [npm](https://github.com/joyent/node/wiki/Installing-Node.js-via-package-manager) on Linux).

1. Install `jshint` by typing the following in a terminal:
   ```
   npm install -g jshint
   ```

1. If you are using `nvm` and `zsh`, ensure that the line to load `nvm` is in `.zshenv` and not `.zshrc`.

**Note:** This plugin requires `jshint` 2.4.0 or later.

Now you can proceed to install the linter-jshint plugin.

### Plugin installation
```
$ apm install linter-jshint
```

## Settings
You can configure linter-jshint by editing ~/.atom/config.cson (choose Open Your Config in Atom menu):
```
'linter-jshint':
  'jshintExecutablePath': null #jshint path. run 'which jshint' to find the path
```

## Contributing
If you would like to contribute enhancements or fixes, please do the following:

1. Fork the plugin repository.
1. Hack on a separate topic branch created from the latest `master`.
1. Commit and push the topic branch.
1. Make a pull request.
1. welcome to the club

Please note that modications should follow these coding guidelines:

- Indent is 2 spaces.
- Code should pass coffeelint linter.
- Vertical whitespace helps readability, don’t be afraid to use it.

Thank you for helping out!
