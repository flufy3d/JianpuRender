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

import {
  JianpuInfo, TempoInfo, TimeSignatureInfo, KeySignatureInfo, getMeasureLength,
  DEFAULT_TIME_SIGNATURE, DEFAULT_KEY_SIGNATURE, DEFAULT_TEMPO
} from './jianpu_info';

import {
  MAX_QUARTER_DIVISION, MIN_RESOLUTION
} from './model_constants';

/**
 * Stores the score structural info in chunks, like signatures and measure details,
 * in order to use it for measure handling. Every chunk applies from its start
 * point to the next one. This info can be easily indexed to do a fast lookup.
 */
export interface MeasureInfo {
  /** Where all this info starts applying (in quarter notes) */
  start: number;
  /** The applicable measure number in this chunk (integer part is measure, fractional is position within) */
  measureNumber: number;
  /** The applicable measure length in this chunk (in quarter notes) */
  measureLength: number;
  /** The applicable tempo in this chunk */
  tempo: TempoInfo;
  /** The applicable Key Signature in this chunk */
  keySignature: KeySignatureInfo;
  /** The applicable Time Signature in this chunk */
  timeSignature: TimeSignatureInfo;
  /** Whether the Tempo changed at the beginning of this chunk */
  tempoChange?: boolean;
  /** Whether the Key Signature changed at the beginning of this chunk */
  keyChange?: boolean;
  /** Whether the Time Signature changed at the beginning of this chunk */
  timeChange?: boolean;
}

/** A change event with its start snapped to the resolution grid, ready to become a chunk boundary. */
interface SnappedChange<T> {
  /** Where the change starts applying (in quarter notes, snapped to MIN_RESOLUTION) */
  start: number;
  /** The original change event from the score info */
  event: T;
}

/**
 * Provides a framework for MeasureInfo indexing and fast traversing in order to
 * locate the structural info related to any note. It stores the info in sparse
 * chunks that only start at the points where a tempo, key signature or time
 * signature change takes effect (plus the initial chunk at time 0), so the
 * amount of stored chunks stays independent from the score length. The chunk
 * applying to any time is located with a binary search, and the measure number
 * is extrapolated linearly from the chunk start.
 */
export class MeasuresInfo {
  /** Internal storage of structural chunks, sorted by ascending start time. */
  private measuresInfo: MeasureInfo[];
  /** Flag to define dotted rests configuration (may change in a future). */
  public allowDottedRests?: boolean = true; // Default to allowing dotted rests in Jianpu

  /**
   * Fills the reference info (measure, tempo, time signature and key signature)
   * into a sparse chunk array holding one chunk per change point, as a fast
   * method to further fill details in blocks.
   * @param jianpuInfo The score information to get references from.
   * @param lastQ The end time (in quarter notes) of the score.
   */
  constructor (jianpuInfo: JianpuInfo, lastQ: number) {
    this.measuresInfo = [];
    if (!(lastQ > 0)) return; // No duration to cover: keep the array empty, the getters fall back to defaults.

    // Change events sorted by start (in copies, the given score info is not
    // mutated) and with their starts snapped to the resolution grid: changes
    // take effect at the closest resolution step within MIN_RESOLUTION / 2.
    const tempoChanges = MeasuresInfo.getSortedChanges(jianpuInfo.tempos, DEFAULT_TEMPO);
    const keyChanges = MeasuresInfo.getSortedChanges(jianpuInfo.keySignatures, DEFAULT_KEY_SIGNATURE);
    const timeChanges = MeasuresInfo.getSortedChanges(jianpuInfo.timeSignatures, DEFAULT_TIME_SIGNATURE);

    let tempoIndex = 0;
    let keyIndex = 0;
    let timeIndex = 0;
    let currentTempo = tempoChanges[0].event;
    let currentKeySignature = keyChanges[0].event;
    let currentTimeSignature = timeChanges[0].event;

    // Start numbering measures from 1, handle potential anacrusis later if needed
    let measureNumberAtCurrentTimeSignature = 1;
    let currentMeasureLength = getMeasureLength(currentTimeSignature);
    let timeOfLastTimeSigChange = currentTimeSignature.start;

    // New chunks start at time 0 and at every change point before the score end
    const boundaries: number[] = [0];
    tempoChanges.forEach(change => boundaries.push(change.start));
    keyChanges.forEach(change => boundaries.push(change.start));
    timeChanges.forEach(change => boundaries.push(change.start));
    boundaries.sort((a, b) => a - b);

    let previousBoundary = -1;
    for (let i = 0; i < boundaries.length; i++) {
      const boundary = boundaries[i];
      if (boundary >= lastQ) break; // Sorted boundaries: changes at or after the end never apply
      if (boundary === previousBoundary) continue; // Several changes share this start point
      previousBoundary = boundary;

      let tempoChange = false;
      let keyChange = false;
      let timeChange = false;

      // Check for Tempo Change
      while (tempoIndex < tempoChanges.length && tempoChanges[tempoIndex].start <= boundary) {
        currentTempo = tempoChanges[tempoIndex++].event;
        tempoChange = true;
      }

      // Check for Key Signature Change
      while (keyIndex < keyChanges.length && keyChanges[keyIndex].start <= boundary) {
        currentKeySignature = keyChanges[keyIndex++].event;
        keyChange = true;
      }

      // Check for Time Signature Change
      while (timeIndex < timeChanges.length && timeChanges[timeIndex].start <= boundary) {
        // Recalculate measure number at the point of change *before* updating,
        // measuring the elapsed time from the raw event start (the previous
        // per-step version anchored the elapsed time the same way)
        const timeAtChange = timeChanges[timeIndex].event.start;
        const timeSincePrevSigChange = timeAtChange - timeOfLastTimeSigChange;
        measureNumberAtCurrentTimeSignature += timeSincePrevSigChange / currentMeasureLength;
        // Ensure it aligns reasonably (might need floor/ceil depending on anacrusis handling)
        measureNumberAtCurrentTimeSignature = Math.round(measureNumberAtCurrentTimeSignature * 1000) / 1000;

        currentTimeSignature = timeChanges[timeIndex++].event;
        currentMeasureLength = getMeasureLength(currentTimeSignature);
        timeOfLastTimeSigChange = boundary;
        timeChange = true;
      }

      // Measure numbering is continuous: extrapolate from the last time
      // signature anchor. At a change boundary this is exactly the anchor.
      const measureInfo: MeasureInfo = {
        start: boundary,
        measureNumber: measureNumberAtCurrentTimeSignature +
          (boundary - timeOfLastTimeSigChange) / currentMeasureLength,
        measureLength: currentMeasureLength,
        tempo: currentTempo,
        keySignature: currentKeySignature,
        timeSignature: currentTimeSignature
      };
      if (tempoChange) measureInfo.tempoChange = true;
      if (keyChange) measureInfo.keyChange = true;
      if (timeChange) measureInfo.timeChange = true;
      this.measuresInfo.push(measureInfo);
    }
  }

  /**
   * Returns the given change events sorted by start (in a copy, the given
   * array is not mutated) with their starts snapped to the resolution grid and
   * clamped to 0, so every change applies at its closest chunk start. A single
   * default event is used when the array is missing or empty.
   * @param events The change events from the score info (optional).
   * @param fallback The default event to use when there is none.
   */
  private static getSortedChanges<T extends {start: number}>(
    events: T[] | undefined, fallback: T
  ): SnappedChange<T>[] {
    const sorted = (events && events.length) ? events.slice() : [fallback];
    sorted.sort((a, b) => a.start - b.start);
    return sorted.map(event => {
      return {
        start: Math.max(0, Math.round(event.start / MIN_RESOLUTION) * MIN_RESOLUTION),
        event: event
      };
    });
  }

  /**
   * Finds the index in the measuresInfo array of the chunk covering a given
   * time, with a binary search over the chunk start times.
   */
  private findIndex(start: number): number {
    // Binary search for the last chunk starting at or before 'start': it is
    // the one applying to that time (chunks are sorted by start, and the
    // stored values extrapolate linearly from each chunk start).
    let low = 0;
    let high = this.measuresInfo.length - 1;
    let found = 0;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (this.measuresInfo[mid].start <= start) {
        found = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    return found;
  }


  /**
   * Gets the measure number of a note starting at a given position.
   * It returns a float where the integer part is the measure number (starting from 1)
   * and the fractional part indicates the position within the measure.
   * (e.g., 3.5 means halfway through the 3rd measure).
   * @param start Time in quarter notes.
   */
  public measureNumberAtQ(start: number): number {
    if (this.measuresInfo.length === 0) return 1.0; // Default if empty
    const index = this.findIndex(start);
    const reference = this.measuresInfo[index];
    const quartersAdvance = start - reference.start;
    const measureAdvanceSinceReference = quartersAdvance / reference.measureLength;
    // Add a small epsilon to handle potential floating point issues at boundaries
    return reference.measureNumber + measureAdvanceSinceReference + 1e-9;
  }

  /**
   * Gets the measure length (in quarter notes) at a given time position.
   * @param start Time in quarter notes.
   * @returns The length of the measure at the given time.
   */
  public measureLengthAtQ(start: number): number {
     if (this.measuresInfo.length === 0) return getMeasureLength(DEFAULT_TIME_SIGNATURE);
    const index = this.findIndex(start);
    return this.measuresInfo[index].measureLength;
  }

  /**
   * Gets the tempo (in QPM) at a given time position.
   * @param start Time in quarter notes.
   * @param onlyChanges If true, returns -1 if there's no tempo change *exactly* at 'start'.
   * @returns The QPM, or -1 if onlyChanges is true and there's no change.
   */
  public tempoAtQ(
    start: number, onlyChanges = false
  ): number {
    if (this.measuresInfo.length === 0) return DEFAULT_TEMPO.qpm;
    const index = this.findIndex(start);
    const measureInfo = this.measuresInfo[index];
    // For onlyChanges, check if the start time *exactly* matches the info block's start
    // (within a small tolerance due to float calculations)
    const isExactStart = Math.abs(measureInfo.start - start) < MIN_RESOLUTION / 2;
    return !onlyChanges || (measureInfo.tempoChange && isExactStart) ? measureInfo.tempo.qpm : -1;
  }

  /**
   * Gets the key signature (0-11) at a given time position.
   * @param start Time in quarter notes.
   * @param onlyChanges If true, returns -1 if there's no key change *exactly* at 'start'.
   * @returns The key (0-11), or -1 if onlyChanges is true and there's no change.
   */
  public keySignatureAtQ(
    start: number, onlyChanges = false
  ): number {
     if (this.measuresInfo.length === 0) return DEFAULT_KEY_SIGNATURE.key;
    const index = this.findIndex(start);
    const measureInfo = this.measuresInfo[index];
    const isExactStart = Math.abs(measureInfo.start - start) < MIN_RESOLUTION / 2;
    return !onlyChanges || (measureInfo.keyChange && isExactStart) ? measureInfo.keySignature.key : -1;
  }

  /**
   * Gets the time signature at a given time position.
   * @param start Time in quarter notes.
   * @param onlyChanges If true, returns null if there's no time signature change *exactly* at 'start'.
   * @returns The TimeSignatureInfo, or null if onlyChanges is true and there's no change.
   */
  public timeSignatureAtQ(
    start: number, onlyChanges = false
  ): TimeSignatureInfo | null {
     if (this.measuresInfo.length === 0) return DEFAULT_TIME_SIGNATURE;
    const index = this.findIndex(start);
    const measureInfo = this.measuresInfo[index];
    const isExactStart = Math.abs(measureInfo.start - start) < MIN_RESOLUTION / 2;
    return !onlyChanges || (measureInfo.timeChange && isExactStart) ? measureInfo.timeSignature : null;
  }

  /**
   * Convert a given amount of quarters to seconds based on the tempo at the start time.
   * **NOTE**: This simple version doesn't account for tempo changes *during* the duration.
   * A more accurate version would integrate tempo over the interval.
   * @param quarters The duration in quarter notes.
   * @param startTime The time (in quarter notes) at which the duration begins, to determine tempo.
   * @returns The equivalent duration in seconds.
   */
  public quartersToTime(quarters: number, startTime: number): number {
    const qpm = this.tempoAtQ(startTime);
    if (qpm <= 0) return 0; // Avoid division by zero or negative tempo
    return (quarters / qpm) * 60;
  }

  /**
   * Convert a given amount of seconds to quarters based on the tempo at the start time.
   * **NOTE**: This simple version assumes constant tempo.
   * It will be rounded to the maximum internal precision to avoid floating point issues.
   * @param time The duration in seconds.
   * @param startTime The time (in quarter notes) where the conversion is relevant for tempo.
   * @returns The equivalent duration in quarters.
   */
  public timeToQuarters(time: number, startTime: number): number {
    const qpm = this.tempoAtQ(startTime);
    if (qpm <= 0) return 0;
    const q = (time * qpm) / 60;
    return Math.round(q * MAX_QUARTER_DIVISION) / MAX_QUARTER_DIVISION;
  }

  /**
   * Checks if a given time falls exactly on a beat boundary according to the time signature.
   * @param time Time in quarter notes.
   * @returns True if the time is on a beat, false otherwise.
   */
  public isBeatStart(time: number): boolean {
    if (this.measuresInfo.length === 0) return false;
    const index = this.findIndex(time);
    const measureInfo = this.measuresInfo[index];
    const timeSignature = measureInfo.timeSignature;
    const measureStart = measureInfo.start - ((measureInfo.measureNumber - Math.floor(measureInfo.measureNumber)) * measureInfo.measureLength);
    const timeInMeasure = time - measureStart;

    const beatLength = 4 / timeSignature.denominator; // Length of one beat in quarter notes

    // Check if timeInMeasure is a multiple of beatLength (within tolerance)
    const beatNumber = timeInMeasure / beatLength;
    return Math.abs(beatNumber - Math.round(beatNumber)) < MIN_RESOLUTION / 2;
  }
}
