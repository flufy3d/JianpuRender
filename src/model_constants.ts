/**
 * @license
 * Copyright 2025 flufy3d. All Rights Reserved.
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
 * =============================================================================
 */

/** 1/16 of a quarter note (1/64th note) - smallest unit visually represented by underlines */
export const MIN_RESOLUTION = 0.0625; // 1/16th quarter = 64th note

/**
 * Minimal duration recognized note for internal calculations.
 * Allows for fine timing distinctions even if not visually distinct.
 */
export const MAX_QUARTER_DIVISION = 16 * 3 * 5; // = 240. Allows sixtyfourth triplets/quintuplets

/**
 * Simple mapping from MIDI pitch % 12 to Note Names (using sharps primarily).
 * Used for determining key signature display (e.g., "1=C", "1=G").
 */
export const PITCH_CLASS_NAMES = [
    'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'
];

/**
 * Defines the intervals (in semitones) of a major scale relative to the tonic.
 * Used for mapping MIDI pitches to Jianpu numbers (1-7) within a key.
 * Interval: 0  2  4  5  7  9  11
 * Degree:   1  2  3  4  5  6  7
 */
export const MAJOR_SCALE_INTERVALS: { [interval: number]: number } = {
    0: 1,  // Tonic
    2: 2,  // Major Second
    4: 3,  // Major Third
    5: 4,  // Perfect Fourth
    7: 5,  // Perfect Fifth
    9: 6,  // Major Sixth
    11: 7  // Major Seventh
};

// Note: Minor keys or modes would require different interval mappings.
// This implementation primarily assumes major keys for simplicity.

/**
 * Reference MIDI pitch for Middle C (C4)
 */
export const MIDDLE_C_MIDI = 60;

// Constants related to Staff rendering (Clefs, specific VSteps, SCALES) are removed.
// KEY_ACCIDENTALS structure might be needed if implementing automatic key signature
// accidental rendering beyond just "1=X", but is removed for now for simplicity.