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

/** Stores minimal information related to a musical note */
export interface NoteInfo {
  /** Starting time, in quarter note quantities (float) */
  start: number;
  /** Note length, in quarter note quantities (float) */
  length: number;
  /** Note pitch according to MIDI standard */
  pitch: number;
  /** Note intensity according to MIDI velocity */
  intensity: number;
}
  
/** Stores information related to a tempo change on a score (not used yet) */
export interface TempoInfo {
  /** Starting time, in quarter note quantities (float) */
  start: number; 
  /** Quarters Per Minute from this quarter on, unless further changes */
  qpm: number;
}

/** Stores information related to a key signature change on a score */
export interface KeySignatureInfo {
  /** Starting time, in quarter note quantities (float) */
  start: number; 
  /** Key signature from this quarter on, unless further changes */
  key: number;
}

/** Stores information related to a time signature change on a score */
export interface TimeSignatureInfo {
  /** Starting time, in quarter note quantities (float) */
  start: number;
  /** Would hold 3 in a 3/4 time signature change */
  numerator: number; 
  /** Would hold 4 in a 3/4 time signature change */
  denominator: number;
}

/** Stores the bare minimal information related to a full single staff score */
export interface StaffInfo {
  /** All notes in a staff. There's no need to be sorted by start q */
  notes: NoteInfo[];
  /** All tempo changes in a staff. They will get sorted by start q */
  tempos?: TempoInfo[];
  /** All key signature changes in a staff. They will get sorted by start q */
  keySignatures?: KeySignatureInfo[];
  /** All time signature changes in a staff. They will get sorted by start q */
  timeSignatures?: TimeSignatureInfo[];
}

/** Default tempo in case none is found (60 bpm) */
export const DEFAULT_TEMPO: TempoInfo = {
  start: 0,
  qpm: 60
};
/** Default key in case none is found (C key) */
export const DEFAULT_KEY_SIGNATURE: KeySignatureInfo = {
  start: 0,
  key: 0
};
/** Default time signature in case none is found (4/4) */
export const DEFAULT_TIME_SIGNATURE: TimeSignatureInfo = {
  start: 0, 
  numerator: 4, 
  denominator: 4
};

/**
 * Calculates the number of quarters that fits within a bar in a given
 * time signature
 * @param timeSignature The time signature
 * @returns The number of quarters that fit in
 */
export function getBarLength(timeSignature: TimeSignatureInfo): number {
  return timeSignature.numerator * 4 / timeSignature.denominator;
}
