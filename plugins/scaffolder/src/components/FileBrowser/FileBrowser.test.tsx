/*
 * Copyright 2022 The Backstage Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { FileEntry, parseFileEntries } from './FileBrowser';

function dir(path: string, ...children: FileEntry[]): FileEntry {
  return {
    type: 'directory',
    path: path,
    name: path.split('/').pop()!,
    children: children,
  };
}

function file(path: string): FileEntry {
  return {
    type: 'file',
    path: path,
    name: path.split('/').pop()!,
  };
}

describe('parseFileEntries', () => {
  it('parses an empty list', () => {
    expect(parseFileEntries([])).toEqual([]);
  });

  it('parses a single file', () => {
    expect(parseFileEntries(['a.txt'])).toEqual([file('a.txt')]);
    expect(parseFileEntries(['a/b.txt'])).toEqual([dir('a', file('a/b.txt'))]);
    expect(parseFileEntries(['a/b/c.txt'])).toEqual([
      dir('a', dir('a/b', file('a/b/c.txt'))),
    ]);
  });

  it('parses multiple files', () => {
    expect(parseFileEntries(['a.txt', 'b.txt'])).toEqual([
      file('a.txt'),
      file('b.txt'),
    ]);
    expect(parseFileEntries(['a.txt', 'a/b.txt'])).toEqual([
      dir('a', file('a/b.txt')),
      file('a.txt'),
    ]);
    expect(parseFileEntries(['a.txt', 'a/b.txt', 'a/c.txt'])).toEqual([
      dir('a', file('a/b.txt'), file('a/c.txt')),
      file('a.txt'),
    ]);
    expect(parseFileEntries(['a.txt', 'a/b/c.txt', 'a/b/d.txt'])).toEqual([
      dir('a', dir('a/b', file('a/b/c.txt'), file('a/b/d.txt'))),
      file('a.txt'),
    ]);
  });

  it('throws an error on invalid filenames', () => {
    expect(() => parseFileEntries([''])).toThrow(`Invalid path part: ''`);
    expect(() => parseFileEntries(['/'])).toThrow(`Invalid path part: ''`);
    expect(() => parseFileEntries(['a/'])).toThrow(`Invalid path part: ''`);
    expect(() => parseFileEntries(['/a.txt'])).toThrow(`Invalid path part: ''`);
    expect(() => parseFileEntries(['a//a.txt'])).toThrow(
      `Invalid path part: ''`,
    );
  });

  it('throws an error on conflicting directory and filenames', () => {
    expect(() => parseFileEntries(['a', 'a'])).toThrow(
      `Duplicate filename at 'a'`,
    );
    expect(() => parseFileEntries(['a', 'a/b'])).toThrow(
      `Duplicate filename at 'a'`,
    );
    expect(() => parseFileEntries(['a/b', 'a'])).toThrow(
      `Duplicate filename at 'a'`,
    );
    expect(() => parseFileEntries(['a/b', 'a/b/c'])).toThrow(
      `Duplicate filename at 'a/b'`,
    );
    expect(() => parseFileEntries(['a/b/c', 'a/b/c'])).toThrow(
      `Duplicate filename at 'a/b/c'`,
    );
  });
});
