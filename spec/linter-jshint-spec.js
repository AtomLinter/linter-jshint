'use babel';

// eslint-disable-next-line no-unused-vars
import { it, fit, wait, beforeEach, afterEach } from 'jasmine-fix';
import * as path from 'path';
import linter from '../lib/main';

const bitwisePath = path.join(__dirname, 'fixtures', 'bitwise', 'bitwise.js');

describe('The JSHint provider for Linter', () => {
  const lint = linter.provideLinter().lint;

  beforeEach(async () => {
    await atom.packages.activatePackage('linter-jshint');
    await atom.packages.activatePackage('language-javascript');
  });

  it('should be in the packages list', () =>
    expect(atom.packages.isPackageLoaded('linter-jshint')).toBe(true),
  );

  it('should be an active package', () =>
    expect(atom.packages.isPackageActive('linter-jshint')).toBe(true),
  );

  describe('shows errors in a file with issues', () => {
    let editor = null;

    beforeEach(async () => {
      editor = await atom.workspace.open(bitwisePath);
    });

    it('verifies the first message', async () => {
      const expected = "W016 - Unexpected use of '&'.";

      const messages = await lint(editor);
      expect(messages[0].type).toBe('Warning');
      expect(messages[0].html).not.toBeDefined();
      expect(messages[0].text).toBe(expected);
      expect(messages[0].filePath).toBe(bitwisePath);
      expect(messages[0].range).toEqual([[0, 10], [0, 13]]);
    });
  });

  it('finds nothing wrong with an empty file', async () => {
    const emptyPath = path.join(__dirname, 'fixtures', 'empty.js');
    const editor = await atom.workspace.open(emptyPath);
    const messages = await lint(editor);
    expect(messages.length).toBe(0);
  });

  it('finds nothing wrong with a valid file', async () => {
    const goodPath = path.join(__dirname, 'fixtures', 'good.js');
    const editor = await atom.workspace.open(goodPath);
    const messages = await lint(editor);
    expect(messages.length).toBe(0);
  });

  describe('shows syntax errors', () => {
    const syntaxPath = path.join(__dirname, 'fixtures', 'syntax', 'badSyntax.js');
    let editor = null;

    beforeEach(async () => {
      editor = await atom.workspace.open(syntaxPath);
    });

    it('verifies the first message', async () => {
      const message = 'E006 - Unexpected early end of program.';
      const messages = await lint(editor);
      expect(messages[0].type).toBe('Error');
      expect(messages[0].html).not.toBeDefined();
      expect(messages[0].text).toBe(message);
      expect(messages[0].filePath).toBe(syntaxPath);
      expect(messages[0].range).toEqual([[0, 10], [0, 11]]);
    });
  });

  describe('handles .jshintignore files', () => {
    const ignoreDir = path.join(__dirname, 'fixtures', 'ignore');
    const checkedPath = path.join(ignoreDir, 'checked.js');
    const ignoredPath = path.join(ignoreDir, 'ignored.js');

    it('works when in the same directory', async () => {
      const checkEditor = await atom.workspace.open(checkedPath);
      const ignoreEditor = await atom.workspace.open(ignoredPath);
      const checkMessages = await lint(checkEditor);
      const ignoreMessages = await lint(ignoreEditor);
      const expected = "W098 - 'foo' is defined but never used.";

      expect(checkMessages.length).toBe(1);
      expect(checkMessages[0].type).toBe('Warning');
      expect(checkMessages[0].html).not.toBeDefined();
      expect(checkMessages[0].text).toBe(expected);
      expect(checkMessages[0].filePath).toBe(checkedPath);
      expect(checkMessages[0].range).toEqual([[0, 4], [0, 7]]);

      expect(ignoreMessages.length).toBe(0);
    });
  });
});
