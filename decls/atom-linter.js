// @flow

/* eslint-disable import/extensions, import/no-extraneous-dependencies */
import type { TextEditor } from 'atom';
/* eslint-enable import/extensions, import/no-extraneous-dependencies */

declare type ExecOptions = {
  timeout?: number,
  stream?: 'stdout' | 'stderr' | 'both',
  env?: Object,
  stdin?: string | Buffer,
  local?: {
    directory: string,
    prepend?: boolean
  },
  throwOnStderr?: boolean,
  allowEmptyStderr?: boolean,
  ignoreExitCode?: boolean
}

declare module 'atom-linter' {
  declare var findCachedAsync:
    (directory: string, names: string | Array<string>) => Promise<?string>;
  declare var execNode:
    (filePath: string, args: Array<string>, options?: ExecOptions) => Promise<string>;
  declare var generateRange:
    (textEditor: TextEditor, lineNumber?: number, colStart?: number) =>
      Array<Array<number>>
}
