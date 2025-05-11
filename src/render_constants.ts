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

/** Stroke width for lines like bar lines, underlines */
export const LINE_STROKE_WIDTH = 1; // Pixel width for SVG strokes

/** Horizontal spacing multiplier in compact mode (relative to base note size) */
export const COMPACT_SPACING_FACTOR = 1.5; // e.g., 1.5 times the note number width

/** Vertical spacing between underlines (relative to note height) */
export const UNDERLINE_SPACING_FACTOR = 0.2;

/** Vertical offset for octave dots (relative to note height) */
export const OCTAVE_DOT_OFFSET_FACTOR = 1.0;

/** Size of octave/augmentation dots (relative to note height) */
export const DOT_SIZE_FACTOR = 0.1;

/** Length of augmentation dash (relative to note width) */
export const AUGMENTATION_DASH_FACTOR = 0.8;

/** Horizontal spacing after accidentals (relative to note height) */
export const ACCIDENTAL_SPACING_FACTOR = 0.1;

/** Horizontal spacing after augmentation dots/dashes (relative to note height) */
export const AUGMENTATION_SPACING_FACTOR = 0.2;

/** Default font size multiplier relative to config.noteHeight */
export const FONT_SIZE_MULTIPLIER = 1.2; // Adjust for good number size

/** Font size multiplier for smaller elements like accidentals, time signatures */
export const SMALL_FONT_SIZE_MULTIPLIER = 0.75;


export const DURATION_LINE_SCALES = new Map<number, number>([
    [1, 1.78],
    [2, 1.6], 
    [3, 1.3],
    [4, 1.15]
]);