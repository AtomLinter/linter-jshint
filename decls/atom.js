// @flow

declare var atom: Object;

declare class Disposable {
  dispose(): void;
}

declare module 'atom' {
  declare class CompositeDisposable {
    add(...observable: Array<Disposable>): void;
  }

  declare type Buffer = {
    getLineCount: () => number,
    lineLengthForRow: () => number,
  }

  declare type TextEditor = {
    getPath: () => string,
    getText: () => string,
    getGrammar: () => {
      scopeName: string
    },
    getBuffer: () => Buffer,
    // setCursorBufferPosition: (point: Point) => void,
    // scrollToCursorPosition: () => void,
    // onDidStopChanging: (cb: () => void) => any
    }
}
