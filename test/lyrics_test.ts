/**
 * Unit test set for lyric attachment on the jianpurender library (model layer
 * only, no DOM): lyrics landing on the notes sounding at their start time,
 * tolerance handling, chords, rest gaps, mid-note splitting and input order.
 *
 * @license
 * Copyright 2025 flufy3d All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Imports
 */
import * as test from 'tape';
import { JianpuModel } from '../src/jianpu_model';
import { JianpuBlock, JianpuBlockMap } from '../src/jianpu_block';
import { LyricInfo, NoteInfo } from '../src/jianpu_info';

/** Default tolerance: matches the 1e-6 epsilons used across the model layer. */
const EPS = 1e-6;

/** Builds a raw NoteInfo. */
function note(start: number, length: number, pitch: number, intensity = 100): NoteInfo {
  return { start, length, pitch, intensity };
}

/** Builds a LyricInfo. */
function lyric(start: number, text: string): LyricInfo {
  return { start, text };
}

/** Fetches a block by its exact start key, failing the test when missing. */
function getBlock(t: test.Test, score: JianpuBlockMap, start: number, msg: string): JianpuBlock | undefined {
  const block = score.get(start);
  t.ok(block, msg);
  return block;
}

/**
 * Finds a block whose start is within 1e-6 of the expected time. Split-produced
 * block starts carry a small (~1e-9 * measureLength) float offset inherited from
 * the epsilon in MeasuresInfo.measureNumberAtQ, so split results cannot be
 * looked up by exact key.
 */
function nearBlock(t: test.Test, score: JianpuBlockMap, expectedStart: number, msg: string): JianpuBlock | undefined {
  let found: JianpuBlock | undefined;
  score.forEach(block => {
    if (Math.abs(block.start - expectedStart) <= EPS) found = block;
  });
  t.ok(found, `${msg} (block starting within ${EPS} of ${expectedStart})`);
  return found;
}

test('lyrics_test: each lyric lands on the note sounding at its start', (t: test.Test) => {
  const score = new JianpuModel({
    notes: [note(0, 1, 60), note(1, 1, 62), note(2, 1, 64), note(3, 1, 65)],
    lyrics: [lyric(0, 'do'), lyric(1, 're'), lyric(2, 'mi'), lyric(3, 'fa')]
  }).jianpuBlockMap;

  const expected = ['do', 're', 'mi', 'fa'];
  [0, 1, 2, 3].forEach((start, i) => {
    const block = getBlock(t, score, start, `note block at q=${start}`);
    if (block) {
      t.equal(block.notes.length, 1, `block at q=${start} holds one note`);
      t.equal(block.notes[0].lyric, expected[i], `the note at q=${start} carries "${expected[i]}"`);
    }
  });
  t.end();
});

test('lyrics_test: start tolerance is 1e-6 (1e-7 attaches, 1e-5 does not)', (t: test.Test) => {
  // Slightly after the note start: inside the interval, attaches.
  const inside = new JianpuModel({
    notes: [note(0, 1, 60)],
    lyrics: [lyric(1e-7, 'near')]
  }).jianpuBlockMap;
  const insideBlock = getBlock(t, inside, 0, 'block for the 1e-7-late lyric');
  if (insideBlock) t.equal(insideBlock.notes[0].lyric, 'near', 'a lyric 1e-7 after the note start attaches');

  // Slightly before the note start: within the 1e-6 tolerance, attaches.
  const justBefore = new JianpuModel({
    notes: [note(0, 1, 60)],
    lyrics: [lyric(-1e-7, 'dust')]
  }).jianpuBlockMap;
  const justBeforeBlock = getBlock(t, justBefore, 0, 'block for the 1e-7-early lyric');
  if (justBeforeBlock) t.equal(justBeforeBlock.notes[0].lyric, 'dust', 'a lyric 1e-7 before the note start attaches');

  // Clearly before the note start (outside tolerance): ignored, and never
  // leaks onto the following note.
  const farBefore = new JianpuModel({
    notes: [note(0, 1, 60), note(1, 1, 62)],
    lyrics: [lyric(-1e-5, 'lost')]
  }).jianpuBlockMap;
  const first = getBlock(t, farBefore, 0, 'block at q=0 for the out-of-tolerance lyric');
  const second = getBlock(t, farBefore, 1, 'block at q=1 for the out-of-tolerance lyric');
  if (first) t.equal(first.notes[0].lyric, undefined, 'a lyric 1e-5 before the score start is ignored');
  if (second) t.equal(second.notes[0].lyric, undefined, 'the out-of-tolerance lyric does not leak to the next note');
  t.end();
});

test('lyrics_test: a lyric exactly at a note end belongs to the next note', (t: test.Test) => {
  const score = new JianpuModel({
    notes: [note(0, 1, 60), note(1, 1, 62)],
    lyrics: [lyric(1, 'boundary')]
  }).jianpuBlockMap;

  const first = getBlock(t, score, 0, 'block at q=0');
  const second = getBlock(t, score, 1, 'block at q=1');
  if (first) t.equal(first.notes[0].lyric, undefined, 'the half-open interval excludes the note end');
  if (second) t.equal(second.notes[0].lyric, 'boundary', 'the lyric at q=1 is carried by the note starting there');
  t.end();
});

test('lyrics_test: a chord at one start gives the lyric to its first note only', (t: test.Test) => {
  const score = new JianpuModel({
    notes: [note(0, 1, 60), note(0, 1, 64), note(0, 1, 67), note(2, 1, 72)],
    lyrics: [lyric(0, 'chord')]
  }).jianpuBlockMap;

  const chord = getBlock(t, score, 0, 'chord block at q=0');
  if (chord) {
    t.equal(chord.notes.length, 3, 'three chord members share the block');
    t.equal(chord.notes[0].lyric, 'chord', 'the first chord member takes the lyric');
    t.equal(chord.notes[1].lyric, undefined, 'the second chord member stays lyric-free');
    t.equal(chord.notes[2].lyric, undefined, 'the third chord member stays lyric-free');
  }
  const next = getBlock(t, score, 2, 'block at q=2');
  if (next) t.equal(next.notes[0].lyric, undefined, 'the consumed lyric is not repeated on a later note');
  t.end();
});

test('lyrics_test: lyrics falling in rest gaps or beyond the score are ignored', (t: test.Test) => {
  const score = new JianpuModel({
    notes: [note(0, 1, 60), note(3, 1, 64)],
    lyrics: [lyric(1.5, 'gap'), lyric(5, 'beyond')]
  }).jianpuBlockMap;

  const first = getBlock(t, score, 0, 'note block at q=0');
  const last = getBlock(t, score, 3, 'note block at q=3');
  if (first) t.equal(first.notes[0].lyric, undefined, 'the note before the gap gets no lyric');
  if (last) t.equal(last.notes[0].lyric, undefined, 'the note after the gap does not inherit the gap lyric');
  score.forEach(block => {
    block.notes.forEach(n => t.equal(n.lyric, undefined, `no note anywhere (q=${block.start}) carries a stray lyric`));
  });
  t.end();
});

test('lyrics_test: a mid-note lyric stays on the first segment after beat splitting', (t: test.Test) => {
  // 设计说明：歌词附加发生在 createJianpuNote（切分之前），歌词 start=1.5 命中
  // 覆盖该时刻的原始长音符（0-3），切分成 1+1+1 后歌词跟着前段（start 早于切分
  // 点的第一段，splitJianpuNote 不复制 lyric 字段到后段），而不是按歌词 start
  // 重新分配给中间段 —— 这是当前设计，而非缺陷。
  const score = new JianpuModel({
    notes: [note(0, 3, 60)],
    lyrics: [lyric(1.5, 'mid')]
  }).jianpuBlockMap;

  t.equal(score.size, 3, 'the three-beat note splits into three one-beat pieces');
  const first = getBlock(t, score, 0, 'first piece at q=0');
  if (first) {
    t.equal(first.notes.length, 1, 'the first piece holds the note part');
    t.equal(first.notes[0].lyric, 'mid', 'the lyric rides on the first segment');
    t.ok(first.notes[0].tiedTo, 'sanity: the first segment ties onward to the split parts');
  }
  const second = nearBlock(t, score, 1, 'second piece near q=1');
  if (second) t.equal(second.notes[0].lyric, undefined, 'the second segment carries no lyric');
  const third = nearBlock(t, score, 2, 'third piece near q=2');
  if (third) t.equal(third.notes[0].lyric, undefined, 'the third segment carries no lyric');
  t.end();
});

test('lyrics_test: no lyrics field leaves every note lyric-free', (t: test.Test) => {
  const model = new JianpuModel({ notes: [note(0, 1, 60), note(1, 0.5, 62), note(2, 1, 64)] });
  t.equal(model.jianpuInfo.lyrics, undefined, 'the lyrics field stays undefined on the info');
  let noteCount = 0;
  model.jianpuBlockMap.forEach(block => {
    block.notes.forEach(n => {
      noteCount++;
      t.equal(n.lyric, undefined, `the note at q=${n.start} has no lyric`);
    });
  });
  t.equal(noteCount, 3, 'all three notes were checked');
  t.end();
});

test('lyrics_test: unordered lyrics attach correctly and the input array keeps its order', (t: test.Test) => {
  const inputLyrics = [lyric(3, 'fa'), lyric(1, 're'), lyric(2, 'mi'), lyric(0, 'do')];
  const model = new JianpuModel({
    notes: [note(0, 1, 60), note(1, 1, 62), note(2, 1, 64), note(3, 1, 65)],
    lyrics: inputLyrics
  });
  const score = model.jianpuBlockMap;

  const expected = ['do', 're', 'mi', 'fa'];
  [0, 1, 2, 3].forEach((start, i) => {
    const block = getBlock(t, score, start, `note block at q=${start}`);
    if (block) t.equal(block.notes[0].lyric, expected[i], `the note at q=${start} carries "${expected[i]}" despite unordered input`);
  });

  // 设计说明：与 notes/tempos 的就地排序（既有行为）不同，lyrics 使用副本排序，
  // 用户传入的数组引用与顺序保持不变。
  t.equal(model.jianpuInfo.lyrics, inputLyrics, 'the user array reference is kept');
  t.deepEqual(model.jianpuInfo.lyrics!.map(l => l.start), [3, 1, 2, 0], 'the user array order is untouched');

  // Re-running update() (as redraw does) re-attaches lyrics idempotently.
  model.update(model.jianpuInfo);
  const rescored = model.jianpuBlockMap;
  [0, 1, 2, 3].forEach((start, i) => {
    const block = getBlock(t, rescored, start, `re-updated note block at q=${start}`);
    if (block) t.equal(block.notes[0].lyric, expected[i], `after a second update() the note at q=${start} still carries "${expected[i]}"`);
  });
  t.end();
});
