/**
 * Functional unit test set for the sparse segmentation and binary search
 * lookup of MeasuresInfo.
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
import { MeasureInfo, MeasuresInfo } from '../src/measure_info';
import { JianpuInfo } from '../src/jianpu_info';

/** Asserts that a number is within an epsilon of the expected value. */
function approx(
  t: test.Test, actual: number, expected: number, msg: string, epsilon = 1e-6
): void {
  t.ok(Math.abs(actual - expected) < epsilon, `${msg} (got ${actual}, expected ~${expected})`);
}

/** Builds a minimal JianpuInfo (no notes) with the given structural changes. */
function infoWith(changes: {
  tempos?: { start: number, qpm: number }[];
  keySignatures?: { start: number, key: number }[];
  timeSignatures?: { start: number, numerator: number, denominator: number }[];
}): JianpuInfo {
  return { notes: [], ...changes };
}

/** Gets the internal segment array (white box, to assert the sparse storage). */
function segmentsOf(measuresInfo: MeasuresInfo): MeasureInfo[] {
  return (measuresInfo as unknown as { measuresInfo: MeasureInfo[] }).measuresInfo;
}

test('measure_info_test: long score with tempo, key and time signature changes', (t: test.Test) => {
  const info = infoWith({
    tempos: [{ start: 0, qpm: 120 }, { start: 150, qpm: 90 }],
    keySignatures: [{ start: 0, key: 0 }, { start: 100, key: 7 }],
    timeSignatures: [
      { start: 0, numerator: 4, denominator: 4 },
      { start: 64, numerator: 3, denominator: 4 },
      { start: 112, numerator: 6, denominator: 8 }
    ]
  });
  const measuresInfo = new MeasuresInfo(info, 2000);

  // 2000 quarters of 4/4 would mean 32000 resolution steps on a per-step
  // storage, but there is only one segment per change point plus time 0.
  t.equal(segmentsOf(measuresInfo).length, 5, 'One segment per change point plus time 0');

  // 4/4 span: measure numbers grow by 1 every 4 quarters, starting at 1.
  approx(t, measuresInfo.measureNumberAtQ(0), 1, 'Score starts at measure 1');
  approx(t, measuresInfo.measureNumberAtQ(2), 1.5, 'Halfway through measure 1');
  approx(t, measuresInfo.measureNumberAtQ(8), 3, 'Start of measure 3');
  approx(t, measuresInfo.measureNumberAtQ(63.5), 16.875, 'Still 4/4 right before the change');
  t.equal(measuresInfo.measureLengthAtQ(63.5), 4, '4/4 measure length');

  // 3/4 span: measures 17 to 32 (the numbering continues from the 4/4 span).
  approx(t, measuresInfo.measureNumberAtQ(64), 17, 'Measure 17 starts with the 3/4 change');
  approx(t, measuresInfo.measureNumberAtQ(65.5), 17.5, 'Halfway through measure 17 (3/4)');
  approx(t, measuresInfo.measureNumberAtQ(70), 19, 'Start of measure 19');
  approx(t, measuresInfo.measureNumberAtQ(111.75), 32.9166667, 'End of the last 3/4 measure');

  // 6/8 span: measures of 3 quarters (6 eighths) from measure 33 on.
  approx(t, measuresInfo.measureNumberAtQ(112), 33, 'Measure 33 starts with the 6/8 change');
  approx(t, measuresInfo.measureNumberAtQ(115), 34, 'Start of measure 34');
  approx(t, measuresInfo.measureNumberAtQ(1999.75), 662.25, 'Measure numbering extrapolates to the end');
  t.equal(measuresInfo.measureLengthAtQ(112), 3, '6/8 measure length is 3 quarters');

  // Signatures, key and tempo at arbitrary times.
  t.equal(measuresInfo.timeSignatureAtQ(50)!.numerator, 4, '4/4 before the first change');
  t.equal(measuresInfo.timeSignatureAtQ(100)!.numerator, 3, '3/4 between the changes');
  t.equal(measuresInfo.timeSignatureAtQ(500)!.numerator, 6, '6/8 after the last change');
  t.equal(measuresInfo.keySignatureAtQ(50), 0, 'Initial key before the key change');
  t.equal(measuresInfo.keySignatureAtQ(99), 0, 'Key still applies up to its change');
  t.equal(measuresInfo.keySignatureAtQ(100), 7, 'New key from its change on');
  t.equal(measuresInfo.tempoAtQ(0), 120, 'Initial tempo');
  t.equal(measuresInfo.tempoAtQ(149), 120, 'Tempo applies up to its change');
  t.equal(measuresInfo.tempoAtQ(150), 90, 'New tempo from its change on');
  t.end();
});

test('measure_info_test: measure number continuity across a time signature sequence', (t: test.Test) => {
  // 2 measures of 4/4, then 2 measures of 3/4, then 6/8.
  const info = infoWith({
    timeSignatures: [
      { start: 0, numerator: 4, denominator: 4 },
      { start: 8, numerator: 3, denominator: 4 },
      { start: 14, numerator: 6, denominator: 8 }
    ]
  });
  const measuresInfo = new MeasuresInfo(info, 20);
  t.equal(segmentsOf(measuresInfo).length, 3, 'Only the change points create segments');

  // 4/4: measures 1 [0, 4) and 2 [4, 8).
  approx(t, measuresInfo.measureNumberAtQ(4), 2, 'Measure 2 starts at q=4');
  approx(t, measuresInfo.measureNumberAtQ(7.75), 2.9375, 'Late in measure 2');
  approx(t, measuresInfo.measureNumberAtQ(7.9999), 3, 'Numbering is continuous up to the change', 0.001);

  // 3/4: measures 3 [8, 11) and 4 [11, 14).
  approx(t, measuresInfo.measureNumberAtQ(8), 3, 'Measure 3 starts with the 3/4 change');
  approx(t, measuresInfo.measureNumberAtQ(11), 4, 'Measure 4 starts at q=11');
  approx(t, measuresInfo.measureNumberAtQ(13.5), 4.8333333, 'Late in measure 4');
  approx(t, measuresInfo.measureNumberAtQ(13.9999), 5, 'Numbering is continuous up to the change', 0.001);

  // 6/8: measures 5 [14, 17) and 6 [17, 20).
  approx(t, measuresInfo.measureNumberAtQ(14), 5, 'Measure 5 starts with the 6/8 change');
  approx(t, measuresInfo.measureNumberAtQ(17), 6, 'Measure 6 starts at q=17');
  approx(t, measuresInfo.measureNumberAtQ(19.5), 6.8333333, 'Late in measure 6');

  t.equal(measuresInfo.measureLengthAtQ(4), 4, '4/4 measure length');
  t.equal(measuresInfo.measureLengthAtQ(11), 3, '3/4 measure length');
  t.equal(measuresInfo.measureLengthAtQ(19), 3, '6/8 measure length');
  t.equal(measuresInfo.timeSignatureAtQ(14)!.denominator, 8, '6/8 denominator in the last span');
  t.end();
});

test('measure_info_test: onlyChanges reports values exactly at change points', (t: test.Test) => {
  const info = infoWith({
    tempos: [{ start: 0, qpm: 120 }, { start: 10, qpm: 90 }],
    keySignatures: [{ start: 0, key: 0 }, { start: 12, key: 5 }],
    timeSignatures: [
      { start: 0, numerator: 4, denominator: 4 },
      { start: 8, numerator: 3, denominator: 4 }
    ]
  });
  const measuresInfo = new MeasuresInfo(info, 20);

  // Time signature: changes at 0 and 8 only.
  const ts0 = measuresInfo.timeSignatureAtQ(0, true);
  t.ok(ts0 && ts0.numerator === 4 && ts0.denominator === 4, 'Initial time signature at time 0');
  t.equal(measuresInfo.timeSignatureAtQ(4, true), null, 'No time signature change mid-measure');
  const ts8 = measuresInfo.timeSignatureAtQ(8, true);
  t.ok(ts8 && ts8.numerator === 3 && ts8.denominator === 4, 'Time signature change at q=8');
  const tsNear = measuresInfo.timeSignatureAtQ(8 + 0.02, true);
  t.ok(tsNear && tsNear.numerator === 3, 'Change still reported within the exact-start tolerance');
  t.equal(measuresInfo.timeSignatureAtQ(8.5, true), null, 'Change not reported away from q=8');
  t.equal(measuresInfo.timeSignatureAtQ(12, true), null, 'A key change is not a time signature change');

  // Key signature: changes at 0 and 12 only.
  t.equal(measuresInfo.keySignatureAtQ(0, true), 0, 'Initial key at time 0');
  t.equal(measuresInfo.keySignatureAtQ(6, true), -1, 'No key change mid-score');
  t.equal(measuresInfo.keySignatureAtQ(12, true), 5, 'Key change at q=12');
  t.equal(measuresInfo.keySignatureAtQ(12.5, true), -1, 'Key change not reported away from q=12');
  t.equal(measuresInfo.keySignatureAtQ(13), 5, 'Without onlyChanges the key applies everywhere');

  // Tempo: changes at 0 and 10 only.
  t.equal(measuresInfo.tempoAtQ(0, true), 120, 'Initial tempo at time 0');
  t.equal(measuresInfo.tempoAtQ(5, true), -1, 'No tempo change mid-score');
  t.equal(measuresInfo.tempoAtQ(10, true), 90, 'Tempo change at q=10');
  t.equal(measuresInfo.tempoAtQ(10.5, true), -1, 'Tempo change not reported away from q=10');
  t.equal(measuresInfo.tempoAtQ(11), 90, 'Without onlyChanges the tempo applies everywhere');
  t.end();
});

test('measure_info_test: isBeatStart on 4/4 and 6/8 spans', (t: test.Test) => {
  const info = infoWith({
    timeSignatures: [
      { start: 0, numerator: 4, denominator: 4 },
      { start: 14, numerator: 6, denominator: 8 }
    ]
  });
  const measuresInfo = new MeasuresInfo(info, 20);

  // 4/4 beats are whole quarters.
  t.equal(measuresInfo.isBeatStart(0), true, 'Score start is a beat');
  t.equal(measuresInfo.isBeatStart(1), true, 'Quarter beats in 4/4');
  t.equal(measuresInfo.isBeatStart(2), true, 'Quarter beats in 4/4');
  t.equal(measuresInfo.isBeatStart(1.5), false, 'Offbeat eighth is not a beat');
  t.equal(measuresInfo.isBeatStart(1.25), false, 'Sixteenth position is not a beat');
  t.equal(measuresInfo.isBeatStart(2.5), false, 'Offbeat eighth is not a beat');
  t.equal(measuresInfo.isBeatStart(4), true, 'Measure boundary is a beat');
  t.equal(measuresInfo.isBeatStart(13), true, 'Beat right before the 6/8 change');
  t.equal(measuresInfo.isBeatStart(13.5), false, 'Half quarter before the change is not a beat');

  // 6/8 beats are eighths (0.5 quarters), continuing the running measure number.
  t.equal(measuresInfo.isBeatStart(14), true, '6/8 change starts a measure and a beat');
  t.equal(measuresInfo.isBeatStart(14.5), true, 'Eighth beats in 6/8');
  t.equal(measuresInfo.isBeatStart(14.75), false, 'Sixteenth position is not a 6/8 beat');
  t.equal(measuresInfo.isBeatStart(15.25), false, 'Sixteenth position is not a 6/8 beat');
  t.equal(measuresInfo.isBeatStart(16), true, 'Beat within the 6/8 span');
  t.end();
});

test('measure_info_test: mid-measure time signature change keeps numbering running', (t: test.Test) => {
  // The 3/4 change happens halfway through the second 4/4 measure.
  const info = infoWith({
    timeSignatures: [
      { start: 0, numerator: 4, denominator: 4 },
      { start: 6, numerator: 3, denominator: 4 }
    ]
  });
  const measuresInfo = new MeasuresInfo(info, 12);

  // The running measure number continues fractionally from the change point.
  approx(t, measuresInfo.measureNumberAtQ(5.9999), 2.5, 'Numbering is continuous up to the change', 0.001);
  approx(t, measuresInfo.measureNumberAtQ(6), 2.5, 'Measure number 2.5 at the mid-measure change');
  approx(t, measuresInfo.measureNumberAtQ(7.5), 3, 'New 3/4 measures complete the running number');
  approx(t, measuresInfo.measureNumberAtQ(10.5), 4, 'Measure 4 of the continued numbering');

  // Beats of the new signature count from the inferred measure start (q=4.5).
  t.equal(measuresInfo.isBeatStart(6), false, 'The change point is off the new beat grid');
  t.equal(measuresInfo.isBeatStart(6.5), true, 'Beats follow the new signature');
  t.equal(measuresInfo.isBeatStart(7), false, 'Halfway between 3/4 beats');
  t.equal(measuresInfo.isBeatStart(7.5), true, 'Beats follow the new signature');
  t.end();
});

test('measure_info_test: defaults and empty scores', (t: test.Test) => {
  // A score with no duration has no segments and falls back to the defaults.
  const empty = new MeasuresInfo({ notes: [] }, 0);
  t.equal(segmentsOf(empty).length, 0, 'No segments for an empty score');
  t.equal(empty.measureNumberAtQ(0), 1.0, 'Empty score defaults to measure 1');
  t.equal(empty.measureLengthAtQ(0), 4, 'Empty score defaults to 4/4 length');
  t.equal(empty.tempoAtQ(0), 60, 'Empty score defaults to 60 qpm');
  t.equal(empty.keySignatureAtQ(0), 0, 'Empty score defaults to C key');
  const defaultTs = empty.timeSignatureAtQ(0);
  t.ok(defaultTs && defaultTs.numerator === 4 && defaultTs.denominator === 4, 'Empty score defaults to 4/4');
  t.equal(empty.isBeatStart(0), false, 'Empty score has no beats');

  // A score with no changes at all uses the defaults everywhere.
  const plain = new MeasuresInfo(infoWith({}), 10);
  t.equal(segmentsOf(plain).length, 1, 'A change-less score holds a single segment');
  approx(t, plain.measureNumberAtQ(5), 2.25, '4/4 numbering with default signatures');
  t.equal(plain.tempoAtQ(9), 60, 'Default tempo everywhere');
  t.equal(plain.isBeatStart(3), true, 'Quarter beats in default 4/4');
  t.equal(plain.isBeatStart(3.5), false, 'Eighth offbeats in default 4/4');
  approx(t, plain.quartersToTime(1, 0), 1, 'One quarter at 60 qpm is one second');
  t.equal(plain.timeToQuarters(2, 0), 2, 'Two seconds at 60 qpm are two quarters');
  t.end();
});

test('measure_info_test: very long scores stay sparse and correct', (t: test.Test) => {
  const info = infoWith({
    timeSignatures: [
      { start: 0, numerator: 4, denominator: 4 },
      { start: 40000, numerator: 3, denominator: 4 }
    ]
  });
  const measuresInfo = new MeasuresInfo(info, 50000);

  // 50000 quarters would mean 800000 resolution steps on a per-step storage.
  t.equal(segmentsOf(measuresInfo).length, 2, 'One segment per change point plus time 0');
  approx(t, measuresInfo.measureNumberAtQ(39996), 10000, 'Measure 10000 in the long 4/4 span');
  approx(t, measuresInfo.measureNumberAtQ(40000), 10001, 'Numbering continues at the late change');
  approx(t, measuresInfo.measureNumberAtQ(40003), 10002, 'Measures of 3 quarters after the change');
  t.equal(measuresInfo.measureLengthAtQ(45000), 3, '3/4 length applies to the end');
  t.equal(measuresInfo.isBeatStart(40001), true, 'Beats keep working far into the score');
  t.equal(measuresInfo.isBeatStart(40001.5), false, 'Offbeats keep working far into the score');
  t.end();
});
