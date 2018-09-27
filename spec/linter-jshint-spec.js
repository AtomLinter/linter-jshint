'use babel';

import {
  // eslint-disable-next-line no-unused-vars
  it, fit, wait, beforeEach, afterEach,
} from 'jasmine-fix';
import * as path from 'path';
import linter from '../lib/main';

const goodPath = path.join(__dirname, 'fixtures', 'good.js');
const bitwisePath = path.join(__dirname, 'fixtures', 'bitwise', 'bitwise.js');

async function getNotification(expectedMessage) {
  return new Promise((resolve) => {
    let notificationSub;
    const newNotification = (notification) => {
      if (notification.getMessage() !== expectedMessage) {
        // As the specs execute asynchronously, it's possible a notification
        // from a different spec was grabbed, if the message doesn't match what
        // is expected simply return and keep waiting for the next message.
        return;
      }
      // Dispose of the notificaiton subscription
      notificationSub.dispose();
      resolve(notification);
    };
    // Subscribe to Atom's notifications
    notificationSub = atom.notifications.onDidAddNotification(newNotification);
  });
}

describe('The JSHint provider for Linter', () => {
  const { lint } = linter.provideLinter();

  beforeEach(async () => {
    await atom.packages.activatePackage('linter-jshint');
    await atom.packages.activatePackage('language-javascript');
  });

  it('should be in the packages list', () => {
    expect(atom.packages.isPackageLoaded('linter-jshint')).toBe(true);
  });

  it('should be an active package', () => {
    expect(atom.packages.isPackageActive('linter-jshint')).toBe(true);
  });

  describe('shows errors in a file with issues', () => {
    let editor = null;

    beforeEach(async () => {
      editor = await atom.workspace.open(bitwisePath);
    });

    it('verifies the first message', async () => {
      const expected = "W016 - Unexpected use of '&'.";

      const messages = await lint(editor);
      expect(messages[0].severity).toBe('warning');
      expect(messages[0].excerpt).toBe(expected);
      expect(messages[0].location.file).toBe(bitwisePath);
      expect(messages[0].location.position).toEqual([[0, 10], [0, 13]]);
    });
  });

  it('finds nothing wrong with an empty file', async () => {
    const emptyPath = path.join(__dirname, 'fixtures', 'empty.js');
    const editor = await atom.workspace.open(emptyPath);
    const messages = await lint(editor);
    expect(messages.length).toBe(0);
  });

  it('finds nothing wrong with a valid file', async () => {
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
      expect(messages[0].severity).toBe('error');
      expect(messages[0].excerpt).toBe(message);
      expect(messages[0].location.file).toBe(syntaxPath);
      expect(messages[0].location.position).toEqual([[0, 10], [0, 11]]);
    });
  });

  describe('handles .jshintignore files', () => {
    const checkMessage = (message, filePath) => {
      const expected = "W098 - 'foo' is defined but never used.";

      expect(message.severity).toBe('warning');
      expect(message.excerpt).toBe(expected);
      expect(message.location.file).toBe(filePath);
      expect(message.location.position).toEqual([[0, 4], [0, 7]]);
    };

    it('works when in the same directory', async () => {
      const ignoreDir = path.join(__dirname, 'fixtures', 'ignore');
      const checkedPath = path.join(ignoreDir, 'checked.js');
      const ignoredPath = path.join(ignoreDir, 'ignored.js');
      const checkEditor = await atom.workspace.open(checkedPath);
      const ignoreEditor = await atom.workspace.open(ignoredPath);
      const checkMessages = await lint(checkEditor);
      const ignoreMessages = await lint(ignoreEditor);

      expect(checkMessages.length).toBe(1);
      checkMessage(checkMessages[0], checkedPath);

      expect(ignoreMessages.length).toBe(0);
    });

    it('handles relative paths in .jshintignore', async () => {
      const ignoreDir = path.join(__dirname, 'fixtures', 'ignore-relative', 'js');
      const checkedPath = path.join(ignoreDir, 'checked.js');
      const ignoredPath = path.join(ignoreDir, 'ignored.js');
      const checkEditor = await atom.workspace.open(checkedPath);
      const ignoreEditor = await atom.workspace.open(ignoredPath);
      const checkMessages = await lint(checkEditor);
      const ignoreMessages = await lint(ignoreEditor);

      expect(checkMessages.length).toBe(1);
      checkMessage(checkMessages[0], checkedPath);

      expect(ignoreMessages.length).toBe(0);
    });
  });

  describe('prints debugging information with the `debug` command', () => {
    let editor;
    const expectedMessage = 'linter-jshint:: Debugging information';
    beforeEach(async () => {
      editor = await atom.workspace.open(goodPath);
    });

    it('shows an info notification', async () => {
      atom.commands.dispatch(atom.views.getView(editor), 'linter-jshint:debug');
      const notification = await getNotification(expectedMessage);

      expect(notification.getMessage()).toBe(expectedMessage);
      expect(notification.getType()).toEqual('info');
    });

    it('includes debugging information in the details', async () => {
      atom.commands.dispatch(atom.views.getView(editor), 'linter-jshint:debug');
      const notification = await getNotification(expectedMessage);
      const detail = notification.getDetail();

      expect(detail.includes(`Atom version: ${atom.getVersion()}`)).toBe(true);
      expect(detail.includes('linter-jshint version:')).toBe(true);
      expect(detail.includes(`Platform: ${process.platform}`)).toBe(true);
      expect(detail.includes('linter-jshint configuration:')).toBe(true);
    });
  });
});
