/**
 * Functional unit test set for the MIDI pitch to Jianpu number / octave dot /
 * accidental mapping (mapMidiToJianpu) on jianpurender library.
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
import { mapMidiToJianpu } from '../src/jianpu_model';

/** Asserts that a MIDI pitch in a key maps to the exact jianpu triple. */
function assertMapping(
  t: test.Test, midi: number, key: number,
  jianpuNumber: number, octaveDot: number, accidental: number, msg: string
): void {
  t.deepEqual(
    mapMidiToJianpu(midi, key),
    { jianpuNumber, octaveDot, accidental },
    msg
  );
}

test('midi_mapping_test: C key covers the chromatic octave above middle C', (t: test.Test) => {
  // [midi, jianpuNumber, octaveDot, accidental]
  const cKeyOctave: Array<[number, number, number, number]> = [
    [60, 1, 0, 0],  // C4  -> 1
    [61, 1, 0, 1],  // C#4 -> #1 (sharp of the tonic, preferred over b2)
    [62, 2, 0, 0],  // D4  -> 2
    [63, 3, 0, 2],  // Eb4 -> b3 (flat of the major third, preferred over #2)
    [64, 3, 0, 0],  // E4  -> 3
    [65, 4, 0, 0],  // F4  -> 4
    [66, 4, 0, 1],  // F#4 -> #4 (sharp of the fourth, preferred over b5)
    [67, 5, 0, 0],  // G4  -> 5
    [68, 6, 0, 2],  // Ab4 -> b6 (flat of the major sixth, preferred over #5)
    [69, 6, 0, 0],  // A4  -> 6
    [70, 7, 0, 2],  // Bb4 -> b7 (flat of the major seventh, preferred over #6)
    [71, 7, 0, 0]   // B4  -> 7
  ];
  cKeyOctave.forEach(([midi, number, dot, acc]) => {
    assertMapping(t, midi, 0, number, dot, acc, `C key: MIDI ${midi} maps to ${number}${acc === 1 ? '#' : acc === 2 ? 'b' : ''}/${dot}`);
  });
  t.end();
});

test('midi_mapping_test: C key flips the octave dot across the middle-C boundary', (t: test.Test) => {
  assertMapping(t, 59, 0, 7, -1, 0, 'B3 is 7 with one dot below');
  assertMapping(t, 60, 0, 1, 0, 0, 'C4 is 1 with no dots');
  assertMapping(t, 61, 0, 1, 0, 1, 'C#4 stays in the no-dot octave');
  assertMapping(t, 71, 0, 7, 0, 0, 'B4 closes the no-dot octave');
  assertMapping(t, 72, 0, 1, 1, 0, 'C5 gets one dot above');
  t.end();
});

test('midi_mapping_test: C key keeps the degree and shifts the dot across octaves', (t: test.Test) => {
  // The tonic degree 1 from C1 (MIDI 36) up to C6 (MIDI 84).
  [36, 48, 60, 72, 84].forEach((midi, i) => {
    assertMapping(t, midi, 0, 1, i - 2, 0, `C key: MIDI ${midi} is still degree 1 (dot ${i - 2})`);
  });
  // The third degree (mi) across three octaves.
  [52, 64, 76].forEach((midi, i) => {
    assertMapping(t, midi, 0, 3, i - 1, 0, `C key: MIDI ${midi} is still degree 3 (dot ${i - 1})`);
  });
  t.end();
});

test('midi_mapping_test: extreme MIDI pitches map without crashing', (t: test.Test) => {
  assertMapping(t, 21, 0, 6, -4, 0, 'A0 (lowest piano pitch) is 6 with four dots below');
  assertMapping(t, 108, 0, 1, 4, 0, 'C8 (highest piano pitch) is 1 with four dots above');
  t.end();
});

test('midi_mapping_test: all 12 keys map tonic, fifth, seventh and chromatic degrees', (t: test.Test) => {
  for (let key = 0; key <= 11; key++) {
    // For key > 0 the tonic reference drops one octave (tonicMidiRef = 48 + key),
    // so MIDI 60..71 sits one octave ABOVE the no-dot reference. Key 0 (C)
    // keeps C4 as the reference, which instead puts MIDI 48 one octave below.
    const upDot = key === 0 ? 0 : 1;
    const refDot = key === 0 ? -1 : 0;
    assertMapping(t, 48 + key, key, 1, refDot, 0, `key ${key}: tonic in the no-dot reference octave`);
    assertMapping(t, 59 + key, key, 7, refDot, 0, `key ${key}: major seventh degree`);
    assertMapping(t, 60 + key, key, 1, upDot, 0, `key ${key}: tonic one octave above the reference`);
    assertMapping(t, 67 + key, key, 5, upDot, 0, `key ${key}: dominant fifth above the tonic`);
    assertMapping(t, 63 + key, key, 3, upDot, 2, `key ${key}: chromatic minor third spelled b3`);
    assertMapping(t, 66 + key, key, 4, upDot, 1, `key ${key}: chromatic tritone spelled #4`);
  }
  t.end();
});

test('midi_mapping_test: G key places the tonic an octave below middle C', (t: test.Test) => {
  // G 调的 1 是 G3（MIDI 55）：key > 0 时 tonicMidiRef 下移一个八度。
  assertMapping(t, 55, 7, 1, 0, 0, 'G key: "1" is G3 (MIDI 55), the no-dot reference');
  assertMapping(t, 67, 7, 1, 1, 0, 'G key: G4 (MIDI 67) is "1" with one dot above');
  t.end();
});
