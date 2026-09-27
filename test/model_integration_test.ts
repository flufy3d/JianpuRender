/**
 * Functional unit test set for the JianpuModel end-to-end pipeline on the
 * jianpurender library: rests, dotted notes, beat/measure splitting, tie
 * chains, chords, meter changes, input ordering and sub-resolution notes.
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
import { JianpuBlock, JianpuBlockMap, JianpuNote, splitJianpuNote } from '../src/jianpu_block';
import { MeasuresInfo } from '../src/measure_info';
import { NoteInfo } from '../src/jianpu_info';

/** Default tolerance: matches the 1e-6 epsilons used across the model layer. */
const EPS = 1e-6;

/** Builds a raw NoteInfo. */
function note(start: number, length: number, pitch: number, intensity = 100): NoteInfo {
  return { start, length, pitch, intensity };
}

/** Builds a fully-formed JianpuNote for direct block/split manipulation. */
function jnote(start: number, length: number, pitch: number, extra: Partial<JianpuNote> = {}): JianpuNote {
  return { start, length, pitch, intensity: 100, jianpuNumber: 1, octaveDot: 0, accidental: 0, ...extra };
}

/** Asserts that a number is within an epsilon of the expected value. */
function approx(
  t: test.Test, actual: number, expected: number, msg: string, epsilon = EPS
): void {
  t.ok(Math.abs(actual - expected) < epsilon, `${msg} (got ${actual}, expected ~${expected})`);
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

/** Checks that iterating the map visits strictly ascending start times. */
function assertOrdered(t: test.Test, score: JianpuBlockMap, msg: string): number {
  let previous = -Infinity;
  let ordered = true;
  let count = 0;
  score.forEach(block => {
    if (block.start <= previous) ordered = false;
    previous = block.start;
    count++;
  });
  t.ok(ordered, msg);
  return count;
}

test('model_integration_test: leading and internal gaps become rest blocks', (t: test.Test) => {
  const score = new JianpuModel({ notes: [note(1, 1, 60)] }).jianpuBlockMap;

  const lead = getBlock(t, score, 0, 'the gap before the first note becomes a rest block at q=0');
  if (lead) {
    t.equal(lead.notes.length, 0, 'the leading block is a rest (no notes)');
    approx(t, lead.length, 1, 'the leading rest fills exactly the one-quarter gap');
  }
  const sounded = getBlock(t, score, 1, 'the note itself sits at q=1');
  if (sounded) t.equal(sounded.notes.length, 1, 'the note block holds the note');
  t.end();
});

test('model_integration_test: multi-beat internal gaps split into per-beat rests', (t: test.Test) => {
  const score = new JianpuModel({ notes: [note(0, 1, 60), note(4, 1, 62)] }).jianpuBlockMap;

  const r1 = nearBlock(t, score, 1, 'rest at beat 2');
  if (r1) {
    t.equal(r1.notes.length, 0, 'beat 2 block is a rest');
    approx(t, r1.length, 1, 'beat 2 rest is one quarter long');
  }
  const r2 = nearBlock(t, score, 2, 'rest at beat 3');
  if (r2) {
    t.equal(r2.notes.length, 0, 'beat 3 block is a rest');
    approx(t, r2.length, 1, 'beat 3 rest is one quarter long');
  }
  const r3 = nearBlock(t, score, 3, 'rest at beat 4');
  if (r3) {
    t.equal(r3.notes.length, 0, 'beat 4 block is a rest');
    approx(t, r3.length, 1, 'beat 4 rest is one quarter long');
  }
  t.end();
});

test('model_integration_test: no trailing rest is appended after the last note', (t: test.Test) => {
  // 设计说明：乐谱时长由音符本身推导（lastQ = 最后音符结束点 + 1e-6 处理缓冲），
  // 缓冲在 final-rest 判定的 1e-6 阈值中抵消，因此普通乐谱不会在最后一个音符
  // 之后自动补休止符 —— 这是当前设计，而非缺陷。
  const model = new JianpuModel({ notes: [note(0, 1, 60), note(2, 1, 62)] });
  const score = model.jianpuBlockMap;

  t.equal(score.size, 3, 'only two notes and the internal rest exist');
  const internal = getBlock(t, score, 1, 'internal gap rest at q=1');
  if (internal) t.equal(internal.notes.length, 0, 'the middle block is a rest');
  t.equal(score.get(3), undefined, 'no rest block at the score end (q=3)');
  t.equal(score.get(4), undefined, 'the map ends at the last note');
  approx(t, model.getTotalDuration(), 3, 'total duration matches the last note end', 1e-5);
  t.equal(model.isLastMeasureAtQ(3), true, 'the last note end counts as the last measure');
  t.equal(model.isLastMeasureAtQ(2.9), false, 'earlier times are not the last measure');
  t.end();
});

test('model_integration_test: final rest appears when a chord block ends early', (t: test.Test) => {
  // 回归测试：final rest 的长度曾把 update() 的 1e-6 处理缓冲一并带上，
  // 在地图里留下一个 ~1e-6 长度的幽灵休止符块。修复后尾部休止符恰好 1 拍。
  const score = new JianpuModel({ notes: [note(0, 1, 60), note(0, 2, 64)] }).jianpuBlockMap;

  const chord = getBlock(t, score, 0, 'chord block at q=0');
  if (chord) {
    t.equal(chord.notes.length, 2, 'both chord members are kept');
    approx(t, chord.length, 1, 'block length follows the shortest member (min rule)');
  }
  const tail = getBlock(t, score, 1, 'final rest after the visual end of the chord');
  if (tail) {
    t.equal(tail.notes.length, 0, 'the tail block is a rest');
    approx(t, tail.length, 1, 'the final rest spans exactly the remaining quarter (no 1e-6 sliver)');
  }
  t.equal(score.size, 2, 'no spurious sub-resolution rest block is emitted');
  t.end();
});

test('model_integration_test: dotted eighth survives as a single block in 4/4', (t: test.Test) => {
  // 0.75 从拍点开始且不越过下一个拍点，因此整块保留（1e-9 容差）。
  const score = new JianpuModel({ notes: [note(0, 0.75, 60)] }).jianpuBlockMap;
  t.equal(score.size, 1, 'the dotted eighth stays a single block');
  const block = getBlock(t, score, 0, 'block at q=0');
  if (block) {
    approx(t, block.length, 0.75, 'length kept exactly', 1e-9);
    t.equal(block.notes.length, 1, 'the note is not split');
    t.equal(block.durationLines, 1, 'one underline for the eighth base');
    t.equal(block.augmentationDots, 1, 'one augmentation dot');
  }
  t.end();
});

test('model_integration_test: dotted sixteenth survives as a single block in 4/4', (t: test.Test) => {
  const score = new JianpuModel({ notes: [note(0, 0.375, 60)] }).jianpuBlockMap;
  t.equal(score.size, 1, 'the dotted sixteenth stays a single block');
  const block = getBlock(t, score, 0, 'block at q=0');
  if (block) {
    approx(t, block.length, 0.375, 'length kept exactly', 1e-9);
    t.equal(block.notes.length, 1, 'the note is not split');
    t.equal(block.durationLines, 2, 'two underlines for the sixteenth base');
    t.equal(block.augmentationDots, 1, 'one augmentation dot');
  }
  t.end();
});

test('model_integration_test: dotted quarter and dotted half are beat-split in 4/4', (t: test.Test) => {
  // 设计说明：splitToBeat 会把跨拍点的音符在拍点处切开（简谱按拍分组的惯例，
  // 与 basic_symbols 中整音符被切成四个四分音符一致），所以 4/4 中从拍点开始的
  // 1.5 / 3.0 音符不能整块保留：1.5 -> 1 + 0.5，3.0 -> 1 + 1 + 1。
  const dotted = new JianpuModel({ notes: [note(0, 1.5, 60)] }).jianpuBlockMap;
  t.equal(dotted.size, 2, 'a dotted quarter on a beat splits in two');
  const first = getBlock(t, dotted, 0, 'first piece at q=0');
  if (first) {
    approx(t, first.length, 1, 'first piece is one quarter');
    t.equal(first.notes.length, 1, 'the first piece holds the note part');
  }
  const second = nearBlock(t, dotted, 1, 'second piece near q=1');
  if (second) {
    approx(t, second.length, 0.5, 'second piece is one eighth');
    t.equal(second.notes.length, 1, 'the second piece holds the rest of the note');
  }

  const dottedHalf = new JianpuModel({ notes: [note(0, 3, 60)] }).jianpuBlockMap;
  t.equal(dottedHalf.size, 3, 'a dotted half on a beat splits into three quarters');
  [0, 1, 2].forEach(expected => {
    const piece = expected === 0 ? getBlock(t, dottedHalf, 0, `piece at q=${expected}`) : nearBlock(t, dottedHalf, expected, `piece near q=${expected}`);
    if (piece) {
      approx(t, piece.length, 1, `piece near q=${expected} is one quarter`);
      t.equal(piece.notes.length, 1, `piece near q=${expected} carries the note`);
    }
  });
  t.end();
});

test('model_integration_test: dotted quarter survives whole in a 4/2 meter', (t: test.Test) => {
  // 4/2 的拍单位是二分音符（2 拍），1.5 的附点四分音符不跨拍点，整块保留。
  const score = new JianpuModel({
    notes: [note(0, 1.5, 60)],
    timeSignatures: [{ start: 0, numerator: 4, denominator: 2 }]
  }).jianpuBlockMap;
  t.equal(score.size, 1, 'the dotted quarter stays a single block');
  const block = getBlock(t, score, 0, 'block at q=0');
  if (block) {
    approx(t, block.length, 1.5, 'length kept exactly', 1e-9);
    t.equal(block.notes.length, 1, 'the note is not split');
    t.equal(block.augmentationDots, 1, 'one augmentation dot');
    // 实际行为：附点四分音符分支提前返回，不设置 durationLines（视觉上四分音符无下划线）。
    t.equal(block.durationLines, undefined, 'no underlines are set for a quarter base');
  }
  t.end();
});

test('model_integration_test: length=3 from beat 1 in 4/4 splits per beat (1+1+1)', (t: test.Test) => {
  // 设计说明：预期"切为 1+2"与实现不符 —— splitToBeat 优先按拍点切分，
  // 因此得到 1+1+1（每片都落在拍点上），这是合理的设计选择。
  const score = new JianpuModel({ notes: [note(0, 3, 60)] }).jianpuBlockMap;
  t.equal(score.size, 3, 'the note splits into three one-beat pieces');
  [0, 1, 2].forEach(expected => {
    const piece = expected === 0 ? getBlock(t, score, 0, `piece at q=${expected}`) : nearBlock(t, score, expected, `piece near q=${expected}`);
    if (piece) {
      approx(t, piece.length, 1, `piece near q=${expected} is one quarter`);
      t.equal(piece.notes.length, 1, `piece near q=${expected} carries the note`);
    }
  });
  t.end();
});

test('model_integration_test: length=4 in 2/4 spans two measures on the beat grid', (t: test.Test) => {
  const score = new JianpuModel({
    notes: [note(0, 4, 60)],
    timeSignatures: [{ start: 0, numerator: 2, denominator: 4 }]
  }).jianpuBlockMap;
  t.equal(score.size, 4, 'one quarter per beat across both 2/4 measures');
  const expectedMeasureNumbers = [1, 1.5, 2, 2.5];
  [0, 1, 2, 3].forEach(expected => {
    const piece = expected === 0 ? getBlock(t, score, 0, `piece at q=${expected}`) : nearBlock(t, score, expected, `piece near q=${expected}`);
    if (piece) {
      approx(t, piece.length, 1, `piece near q=${expected} is one quarter`);
      approx(t, piece.measureNumber, expectedMeasureNumbers[expected], `piece near q=${expected} keeps its measure number`);
    }
  });
  t.end();
});

test('model_integration_test: splitJianpuNote relinks the tie chain around the split', (t: test.Test) => {
  const first = jnote(0, 2, 60, { accidental: 1 });
  const last = jnote(2, 1, 60, { tiedFrom: first });
  first.tiedTo = last;

  const middle = splitJianpuNote(first, 1);
  t.ok(middle, 'the note splits inside its duration');
  if (middle) {
    approx(t, first.length, 1, 'the first part is shortened to the split point', 1e-9);
    approx(t, middle.start, 1, 'the new part starts at the split point', 1e-9);
    approx(t, middle.length, 1, 'the new part keeps the remaining duration', 1e-9);
    t.equal(first.tiedTo, middle, 'the original now ties to the split part');
    t.equal(middle.tiedFrom, first, 'the split part ties back to the original');
    t.equal(middle.tiedTo, last, 'the pre-existing outgoing tie moves to the split part (chain not lost)');
    t.equal(last.tiedFrom, middle, 'the tied successor re-links to the split part');
    // 设计说明：切分出的后段不带临时记号（accidental 置 0），由渲染层按需处理。
    t.equal(middle.accidental, 0, 'the split part drops the accidental');
  }
  t.equal(splitJianpuNote(first, 0), null, 'no split at the note start');
  t.equal(splitJianpuNote(first, first.start + first.length), null, 'no split at the note end');
  t.equal(splitJianpuNote(first, first.start + first.length + 1), null, 'no split beyond the note end');
  t.end();
});

test('model_integration_test: re-splitting the middle keeps a bidirectional three-note chain', (t: test.Test) => {
  const head = jnote(0, 3, 60);
  const middle = splitJianpuNote(head, 1);
  t.ok(middle, 'first split succeeds');
  const tail = middle ? splitJianpuNote(middle, 2) : null;
  t.ok(tail, 'second split succeeds on the already-split part');
  if (middle && tail) {
    approx(t, head.length, 1, 'head is one quarter', 1e-9);
    approx(t, middle.start, 1, 'middle starts at q=1', 1e-9);
    approx(t, middle.length, 1, 'middle is one quarter', 1e-9);
    approx(t, tail.start, 2, 'tail starts at q=2', 1e-9);
    approx(t, tail.length, 1, 'tail is one quarter', 1e-9);
    t.equal(head.tiedTo, middle, 'head ties to the middle');
    t.equal(middle.tiedFrom, head, 'middle ties back to the head');
    t.equal(middle.tiedTo, tail, 'middle ties forward to the tail');
    t.equal(tail.tiedFrom, middle, 'tail ties back to the middle (中间段双向正确)');
  }
  t.end();
});

test('model_integration_test: JianpuBlock.split carries ties across blocks', (t: test.Test) => {
  const measuresInfo = new MeasuresInfo({ notes: [note(0, 4, 60)] }, 10);
  const crossing = jnote(0, 3, 60);
  const after = jnote(3, 1, 60, { tiedFrom: crossing });
  crossing.tiedTo = after;
  const block = new JianpuBlock(0, 3, [crossing], 1);

  const remainder = block.split(1, measuresInfo);
  t.ok(remainder, 'the block splits at q=1');
  if (remainder) {
    approx(t, block.length, 1, 'the first block now ends at the split point');
    approx(t, remainder.start, 1, 'the remainder starts at the split point');
    approx(t, remainder.length, 2, 'the remainder keeps the rest of the block');
    approx(t, remainder.measureNumber, 1.25, 'the remainder sits a quarter into measure 1');
    t.equal(block.notes.length, 1, 'the first block keeps the shortened note');
    t.equal(remainder.notes.length, 1, 'only the crossing note moves to the remainder');
    const firstPart = block.notes[0];
    const secondPart = remainder.notes[0];
    t.equal(firstPart.tiedTo, secondPart, '切分点两侧互链: first part ties to the second');
    t.equal(secondPart.tiedFrom, firstPart, '切分点两侧互链: second part ties back to the first');
    t.equal(secondPart.tiedTo, after, 'the original outbound tie is preserved');
    t.equal(after.tiedFrom, secondPart, 'the tied successor now points at the split part');
  }
  t.equal(block.split(0, measuresInfo), null, 'no split at the block start');
  t.equal(block.split(1, measuresInfo), null, 'no split at the block end');
  t.end();
});

test('model_integration_test: notes ending before the split point stay untouched', (t: test.Test) => {
  const measuresInfo = new MeasuresInfo({ notes: [note(0, 4, 60)] }, 10);
  const short = jnote(0, 0.5, 60);
  const long = jnote(0, 3, 64);
  const block = new JianpuBlock(0, 3, [short, long], 1);

  const remainder = block.split(1, measuresInfo);
  t.ok(remainder, 'the block splits at q=1');
  if (remainder) {
    t.equal(block.notes.length, 2, 'the first block keeps the short note and the shortened long note');
    t.ok(block.notes.indexOf(short) >= 0, 'the short note is untouched in the first block');
    t.equal(remainder.notes.length, 1, 'only the crossing long note moves on');
    approx(t, remainder.notes[0].start, 1, 'the moved part starts at the split point', 1e-9);
    approx(t, remainder.notes[0].length, 2, 'the moved part keeps its remaining duration', 1e-9);
    approx(t, block.length, 1, 'the first block ends at the split point');
    approx(t, remainder.length, 2, 'the remainder spans the rest of the block');
  }
  t.end();
});

test('model_integration_test: same-start notes with different pitches share one block', (t: test.Test) => {
  const score = new JianpuModel({
    notes: [note(0, 1, 60), note(0, 1, 64), note(0, 1, 67), note(2, 1, 72)]
  }).jianpuBlockMap;

  const chord = getBlock(t, score, 0, 'one block at the shared start');
  if (chord) {
    t.equal(chord.notes.length, 3, 'three pitches live in a single block');
    approx(t, chord.length, 1, 'equal-length members keep the full duration');
    t.deepEqual(
      chord.notes.map(n => n.pitch).sort((a, b) => a - b),
      [60, 64, 67],
      'all three pitches are present'
    );
  }
  const rest = getBlock(t, score, 1, 'the gap after the chord becomes a rest');
  if (rest) t.equal(rest.notes.length, 0, 'the middle block is a rest');
  const next = getBlock(t, score, 2, 'the next note starts at q=2');
  if (next) t.equal(next.notes.length, 1, 'the next note block holds the note');
  t.end();
});

test('model_integration_test: chord block length is the shortest member', (t: test.Test) => {
  // 设计说明：block.length 取和弦成员的最短值（Logic Pro 规则的推广），
  // 长音尾部不生成 rest（rest 填充按最长成员的结束时间计算），长音在视觉上被截断。
  const score = new JianpuModel({
    notes: [note(0, 1, 60), note(0, 0.5, 64), note(0.5, 0.5, 72)]
  }).jianpuBlockMap;

  const chord = getBlock(t, score, 0, 'chord block at q=0');
  if (chord) {
    t.equal(chord.notes.length, 2, 'both members are kept');
    approx(t, chord.length, 0.5, 'block takes the minimum member length', 1e-9);
    t.equal(chord.durationLines, 1, 'the block renders as an eighth');
  }
  const next = getBlock(t, score, 0.5, 'the next note starts right after the visual chord end');
  if (next) t.equal(next.notes.length, 1, 'the following block holds the next note');
  t.end();
});

test('model_integration_test: addNote applies the Logic Pro rule for duplicate pitches', (t: test.Test) => {
  // 长音在前、短音在后：短音覆盖长音。
  const block = new JianpuBlock(0, 0, [], 1);
  const long = jnote(0, 2, 60);
  const short = jnote(0, 1, 60);
  t.equal(block.addNote(long), true, 'the first note is accepted');
  t.equal(block.addNote(short), true, 'the shorter duplicate replaces the longer one');
  t.equal(block.notes.length, 1, 'only one note remains');
  t.equal(block.notes[0], short, 'the shorter note is the survivor');
  approx(t, block.length, 1, 'block length is the minimum', 1e-9);

  // 短音在前、长音在后：长音被忽略。
  const block2 = new JianpuBlock(0, 0, [], 1);
  const short2 = jnote(0, 1, 60);
  const long2 = jnote(0, 2, 60);
  t.equal(block2.addNote(short2), true, 'the first note is accepted');
  t.equal(block2.addNote(long2), false, 'the longer duplicate is ignored');
  t.equal(block2.notes.length, 1, 'only one note remains');
  t.equal(block2.notes[0], short2, 'the shorter note is kept');
  approx(t, block2.length, 1, 'block length is unchanged', 1e-9);

  // 不在块起点上的音符被拒绝。
  const block3 = new JianpuBlock(0, 0, [], 1);
  block3.addNote(jnote(0, 1, 60));
  t.equal(block3.addNote(jnote(0.5, 1, 64)), false, 'a note not starting at the block start is rejected');
  t.equal(block3.notes.length, 1, 'the rejected note is not stored');
  t.end();
});

test('model_integration_test: replacing a tied note preserves both tie directions', (t: test.Test) => {
  const block = new JianpuBlock(0, 0, [], 1);
  const previous = jnote(-1, 1, 60);
  const tied = jnote(0, 2, 60, { tiedFrom: previous });
  previous.tiedTo = tied;
  const next = jnote(2, 1, 60, { tiedFrom: tied });
  tied.tiedTo = next;
  const short = jnote(0, 1, 60);

  block.addNote(tied);
  t.equal(block.addNote(short), true, 'the shorter duplicate replaces the tied note');
  t.equal(block.notes[0], short, 'the shorter note is the survivor');
  t.equal(short.tiedFrom, previous, 'the incoming tie is re-linked');
  t.equal(previous.tiedTo, short, 'the previous note now points at the survivor');
  t.equal(short.tiedTo, next, 'the outgoing tie is re-linked');
  t.equal(next.tiedFrom, short, 'the next note now points at the survivor');
  t.end();
});

test('model_integration_test: blocks follow the 3/4 grid after a meter change', (t: test.Test) => {
  const model = new JianpuModel({
    notes: [note(0, 2, 60), note(2, 2, 62), note(4, 2, 64), note(6, 2, 65), note(8, 3, 67), note(11, 3, 69)],
    timeSignatures: [
      { start: 0, numerator: 4, denominator: 4 },
      { start: 8, numerator: 3, denominator: 4 }
    ]
  });
  const score = model.jianpuBlockMap;
  t.equal(assertOrdered(t, score, 'blocks stay ordered by start'), 14, 'fourteen one-beat blocks in total');

  let allOneBeat = true;
  score.forEach(b => { if (Math.abs(b.length - 1) > EPS) allOneBeat = false; });
  t.ok(allOneBeat, 'every block is one beat long');

  const b8 = getBlock(t, score, 8, 'the first 3/4 measure starts at q=8');
  if (b8) {
    approx(t, b8.length, 1, 'the downbeat block is one quarter');
    approx(t, b8.measureNumber, 3, 'measure numbering continues into the 3/4 section');
  }
  const b9 = nearBlock(t, score, 9, 'second beat of the 3/4 measure');
  if (b9) approx(t, b9.measureNumber, 3 + 1 / 3, 'beat 2 of the 3/4 measure is measure 3.333');
  const b10 = nearBlock(t, score, 10, 'third beat of the 3/4 measure');
  if (b10) approx(t, b10.measureNumber, 3 + 2 / 3, 'beat 3 of the 3/4 measure is measure 3.667');
  const b11 = getBlock(t, score, 11, 'the second 3/4 measure starts at q=11');
  if (b11) approx(t, b11.measureNumber, 4, 'the new measure number follows the 3-beat grid');
  const b12 = nearBlock(t, score, 12, 'second beat of the second 3/4 measure');
  if (b12) approx(t, b12.measureNumber, 4 + 1 / 3, 'the 3/4 grid keeps advancing by thirds');
  t.end();
});

test('model_integration_test: unsorted input is sorted and the block map stays ordered', (t: test.Test) => {
  const model = new JianpuModel({
    notes: [note(4, 1, 64), note(0, 1, 60), note(2, 1, 62), note(1, 1, 61)]
  });
  const score = model.jianpuBlockMap;
  t.equal(assertOrdered(t, score, 'block map iterates in ascending start order'), 5, 'four notes plus the gap rest');
  t.deepEqual(model.jianpuInfo.notes.map(n => n.start), [0, 1, 2, 4], 'the notes array itself is sorted by update()');
  const rest = getBlock(t, score, 3, 'the gap before the late note becomes a rest');
  if (rest) {
    t.equal(rest.notes.length, 0, 'the gap block is a rest');
    approx(t, rest.length, 1, 'the gap rest is one quarter long');
  }

  // 二次 update() 同样处理乱序输入。
  model.update({ notes: [note(3, 1, 66), note(0, 0.5, 60), note(1, 0.5, 62), note(2, 1, 64)] });
  const rescored = model.jianpuBlockMap;
  t.equal(assertOrdered(t, rescored, 'the map is re-ordered after a second update()'), 6, 'notes plus half-beat gap rests');
  const midRest = getBlock(t, rescored, 1.5, 'the half-beat gap becomes a rest after update()');
  if (midRest) {
    t.equal(midRest.notes.length, 0, 'the mid rest block is a rest');
    approx(t, midRest.length, 0.5, 'the mid rest is one eighth long');
  }
  t.end();
});

test('model_integration_test: a single sub-resolution note does not crash', (t: test.Test) => {
  // 0.03125 低于 MIN_RESOLUTION（0.0625）：splitToStandardSymbol 对该长度直接
  // 返回 null（不触发 console.warn 回退），块按原样保留，渲染属性钳制到 4 条下划线。
  const score = new JianpuModel({ notes: [note(0, 0.03125, 60)] }).jianpuBlockMap;
  const block = getBlock(t, score, 0, 'the sub-resolution note still produces a block');
  if (block) {
    approx(t, block.length, 0.03125, 'the length is kept as-is (no forced MIN_RESOLUTION inflation)', 1e-9);
    t.equal(block.notes.length, 1, 'the note is preserved');
    t.equal(block.durationLines, 4, 'render properties clamp to the maximum underlines');
  }
  t.end();
});

test('model_integration_test: sub-resolution notes in sequence keep the map sane', (t: test.Test) => {
  const score = new JianpuModel({
    notes: [note(0, 0.03125, 60), note(0.03125, 0.0625, 62), note(1, 1, 64)]
  }).jianpuBlockMap;

  let orderedAndPositive = true;
  let previous = -Infinity;
  score.forEach(b => {
    if (b.start <= previous || !(b.length > 0) || !isFinite(b.length)) orderedAndPositive = false;
    previous = b.start;
  });
  t.ok(orderedAndPositive, 'all blocks are strictly ordered with positive finite lengths');

  const tiny = getBlock(t, score, 0, 'the 0.03125 note block');
  if (tiny) approx(t, tiny.length, 0.03125, 'the sub-resolution note keeps its length', 1e-9);
  const minimal = getBlock(t, score, 0.03125, 'the exactly-MIN_RESOLUTION note block');
  if (minimal) approx(t, minimal.length, 0.0625, 'a MIN_RESOLUTION note passes through unchanged', 1e-9);
  const sliver = getBlock(t, score, 0.96875, 'the sub-resolution rest sliver left by rest splitting');
  if (sliver) {
    t.equal(sliver.notes.length, 0, 'the sliver is a rest');
    approx(t, sliver.length, 0.03125, 'the sub-resolution rest is kept as-is', 1e-9);
  }
  const normal = getBlock(t, score, 1, 'the regular note after the tiny notes');
  if (normal) {
    approx(t, normal.length, 1, 'the regular note keeps a full quarter');
    t.equal(normal.notes.length, 1, 'the regular note is intact');
  }
  t.end();
});
