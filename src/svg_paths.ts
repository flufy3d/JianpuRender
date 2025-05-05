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

/**
 * Base scale for path definitions. Most coordinates are relative to a 100x100 box.
 * Actual rendering size is determined by config.noteHeight.
 */
export const PATH_SCALE = 100;

// --- Accidentals ---
// Using simpler text symbols is often easier for Jianpu accidentals.
// If paths are preferred, keep these:
const sharpPath = `m 30,15 h 40 m -35,20 h 40 M 50,0 v 50 M 70,5 v 50`; // Simple sharp #
const flatPath = `m 45,5 v 40 c 0,15 20,15 20,0 V 20 C 65,5 45,5 45,5 Z`;    // Simple flat b
const naturalPath = `M 45,5 v 45 M 65,0 v 45 H 45 m 20,10 H 45`; // Simple natural ♮

/** Accidental paths indexed by numeric identifier (0=none, 1=#, 2=b, 3=♮) */
// Using null for 0, and potentially text symbols instead of paths.
export const ACCIDENTAL_PATHS = [null, sharpPath, flatPath, naturalPath];
/** Accidental text symbols */
export const ACCIDENTAL_TEXT = ['', '#', 'b', '♮'];

// --- Lines and Dots ---
/** Bar line (simple vertical line) */
export const barPath = 'm 0,-50 v 100'; // Centered vertically around y=0, height 100
/** Underline for duration (simple horizontal line) */
export const underlinePath = 'm 0,0 h 100'; // Width 100, at y=0
/** Augmentation Dash (simple horizontal line) */
export const augmentationDashPath = 'm 0,0 h 50'; // Width 50, at y=0 (adjust width as needed)
/** Tie/Slur Path (basic curve) */
export const tiePath = `M 0,10 C 25,-10 75,-10 100,10 C 75,-20 25,-20 0,10 Z`; // Basic arc below baseline
/** Dot Path (circle for octave/augmentation) */
export const dotPath = 'M 0 0 a 15 15 0 1 0 0.0001 0 z'; // Circle centered at 0,0, radius 15