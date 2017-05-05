// @flow

declare type MinimatchOptions = {
  debug?: boolean,
  nobrace?: boolean,
  noglobstar?: boolean,
  dot?: boolean,
  noext?: boolean,
  nocase?: boolean,
  nonull?: boolean,
  matchBase?: boolean,
  nocomment?: boolean,
  nonegate?: boolean,
  flipNegate?: boolean,
}

declare module 'minimatch' {
  declare module.exports:
    (path: string, pattern: string, options?: MinimatchOptions) => boolean;
}
