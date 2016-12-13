'use babel';

import * as path from 'path';
import linter from '../lib/main';

const bitwisePath = path.join(__dirname, 'fixtures', 'bitwise', 'bitwise.js');
const syntaxPath = path.join(__dirname, 'fixtures', 'syntax', 'badSyntax.js');
const emptyPath = path.join(__dirname, 'fixtures', 'empty.js');
const goodPath = path.join(__dirname, 'fixtures', 'good.js');

describe('The JSHint provider for Linter', () => {
  const lint = linter.provideLinter().lint;

  beforeEach(() => {
    waitsForPromise(() =>
      atom.packages.activatePackage('linter-jshint'),
    );
    waitsForPromise(() =>
      atom.packages.activatePackage('language-javascript'),
    );
    waitsForPromise(() =>
      atom.workspace.open(bitwisePath),
    );
  });

  it('should be in the packages list', () =>
    expect(atom.packages.isPackageLoaded('linter-jshint')).toBe(true),
  );

  it('should be an active package', () =>
    expect(atom.packages.isPackageActive('linter-jshint')).toBe(true),
  );

  describe('shows errors in a file with issues', () => {
    let editor = null;
    beforeEach(() => {
      waitsForPromise(() =>
        atom.workspace.open(bitwisePath).then((openEditor) => {
          editor = openEditor;
        }),
      );
    });

    it('verifies the first message', () => {
      const message = "W016 - Unexpected use of '&'.";
      waitsForPromise(() =>
        lint(editor).then((messages) => {
          expect(messages[0].type).toBe('Warning');
          expect(messages[0].html).not.toBeDefined();
          expect(messages[0].text).toBe(message);
          expect(messages[0].filePath).toBe(bitwisePath);
          expect(messages[0].range).toEqual([[0, 10], [0, 13]]);
        }),
      );
    });
  });

  it('finds nothing wrong with an empty file', () => {
    waitsForPromise(() =>
      atom.workspace.open(emptyPath).then(editor =>
        lint(editor).then((messages) => {
          expect(messages.length).toBe(0);
        }),
      ),
    );
  });

  it('finds nothing wrong with a valid file', () => {
    waitsForPromise(() =>
      atom.workspace.open(goodPath).then(editor =>
        lint(editor).then((messages) => {
          expect(messages.length).toBe(0);
        }),
      ),
    );
  });

  describe('shows syntax errors', () => {
    let editor = null;
    beforeEach(() => {
      waitsForPromise(() =>
        atom.workspace.open(syntaxPath).then((openEditor) => {
          editor = openEditor;
        }),
      );
    });

    it('verifies the first message', () => {
      const message = 'E006 - Unexpected early end of program.';
      waitsForPromise(() =>
        lint(editor).then((messages) => {
          expect(messages[0].type).toBe('Error');
          expect(messages[0].html).not.toBeDefined();
          expect(messages[0].text).toBe(message);
          expect(messages[0].filePath).toBe(syntaxPath);
          expect(messages[0].range).toEqual([[0, 10], [0, 11]]);
        }),
      );
    });
  });
});
