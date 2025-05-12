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
  MIN_RESOLUTION
} from './model_constants';

import {
  NoteInfo
} from './jianpu_info';

import {
  MeasuresInfo // Renamed from BarsInfo
} from './measure_info'; // Renamed from bars_info

/** A map of Jianpu blocks indexed by starting quarter */
export type JianpuBlockMap = Map<number, JianpuBlock>;

/** Stores processed information related to a musical note for Jianpu rendering */
export interface JianpuNote extends NoteInfo {
  /** Jianpu number (1-7) */
  jianpuNumber: number;
  /** Octave dots: positive for above, negative for below, 0 for none */
  octaveDot: number;
  /**
   * Identificator of the accidental kind: 0=none, 1=sharp, 2=flat, 3=natural
   */
  accidental: number;
  /** Reference to previous tied note */
  tiedFrom?: JianpuNote;
  /** Reference to following tied note */
  tiedTo?: JianpuNote;

}

/** Checks if a number is close to zero within a small tolerance */
function isSafeZero(n: number): boolean {
  return Math.abs(n) < 1e-6; // Use a small epsilon
}

/**
 * Splits a JianpuNote in two at a specific time point.
 * @param jianpuNote Note to be split.
 * @param quarters Split point time in quarter notes.
 * @returns The second half of the split note. The first half modifies the input note.
 */
export function splitJianpuNote(jianpuNote: JianpuNote, quarters: number): JianpuNote | null {
  const originalEnd = jianpuNote.start + jianpuNote.length;
  // Ensure split point is strictly within the note's duration
  if (quarters <= jianpuNote.start || quarters >= originalEnd || isSafeZero(originalEnd - quarters)) {
      return null;
  }

  const remainLength = originalEnd - quarters;
  jianpuNote.length = quarters - jianpuNote.start; // Modify original note

  const splitted: JianpuNote = {
      start: quarters,
      length: remainLength,
      pitch: jianpuNote.pitch,
      intensity: jianpuNote.intensity,
      jianpuNumber: jianpuNote.jianpuNumber,
      octaveDot: jianpuNote.octaveDot,
      accidental: 0, // Accidental only applies to the first part
      tiedFrom: jianpuNote, // The new note is tied *from* the modified original
      // Rendering properties will be recalculated later
  };

  if (jianpuNote.tiedTo) { // Relink ties if any in pre-splitted note
      splitted.tiedTo = jianpuNote.tiedTo;
      jianpuNote.tiedTo.tiedFrom = splitted;
  }
  jianpuNote.tiedTo = splitted; // The modified original note is tied *to* the new split part


  return splitted;
}


/**
 * Stores a block of notes in Jianpu, all starting simultaneously.
 * Can represent a chord or a single note/rest. A block with no notes is a rest.
 * Pre-processes context (key, rhythm) to store details for rendering.
 */
export class JianpuBlock {
  /** Starting time, in quarter note quantities (float) */
  public start: number;
  /** Duration of the block, in quarter note quantities (float) */
  public length: number;
  /** The list of notes in the block (empty for a rest) */
  public notes: JianpuNote[];
  /** Measure number (float) where the block starts (e.g., 3.5 is halfway through measure 3) */
  public measureNumber: number;

  // --- Rendering Properties (calculated later) ---
   /** Number of underlines for duration (e.g., 1 for 8th, 2 for 16th) */
   durationLines?: number;
   /** Number of augmentation dots */
   augmentationDots?: number;
   /** True if an augmentation dash is needed (for notes longer than quarter) */
   augmentationDash?: boolean; // Simple flag for now


  // --- Rhythmic Properties (calculated during processing) ---
  /** Whether the block begins on a beat */
  public beatBegin?: boolean;
  /** Whether the block ends exactly on a beat */
  public beatEnd?: boolean;
  /** Whether this block is part of a tie from the previous block */
  public isTieStart?: boolean;
  /** Whether this block continues a tie to the next block */
  public isTieEnd?: boolean;


  /**
   * Creates a `JianpuBlock`.
   * @param start Starting time (quarters).
   * @param length Duration (quarters).
   * @param notes Array of notes (empty for rest).
   * @param measureNumber Measure number where the block starts.
   */
  constructor (
    start = 0,
    length = 0,
    notes: JianpuNote[] = [],
    measureNumber = 1 // Start measures from 1
  ) {
    this.start = start;
    this.length = length;
    this.notes = notes; // Notes will be added via addNote
    this.measureNumber = measureNumber;
  }

  /**
   * Adds a note to the block. Assumes the note starts *exactly* at the block's start time.
   * Handles potential duplicates (e.g., from overlapping MIDI). The shortest duration prevails.
   * Updates block length if necessary.
   * @param jianpuNote The note to add.
   * @returns `true` if the note was added/updated, `false` if ignored (e.g., identical or longer duplicate).
   */
  public addNote(jianpuNote: JianpuNote): boolean {
    if (this.notes.length === 0) {
        // First note sets the start and initial length
        this.start = jianpuNote.start;
        this.length = jianpuNote.length;
        this.notes.push(jianpuNote);
        return true;
    }

    // Ensure the note starts at the block's start time (within tolerance)
    if (!isSafeZero(this.start - jianpuNote.start)) {
        console.warn(`JianpuBlock: Attempted to add note at ${jianpuNote.start} to block starting at ${this.start}. Ignoring.`);
        return false;
    }

    let replacedDuplicate = false;
    let isDuplicate = false;

    for (let i = 0; i < this.notes.length; i++) {
        if (this.notes[i].pitch === jianpuNote.pitch) {
            isDuplicate = true;
            // Logic Pro rule: Shorter note overrides longer one at the same pitch/start
            if (jianpuNote.length < this.notes[i].length) {
                // Preserve ties from the note being replaced
                if (this.notes[i].tiedFrom) {
                    jianpuNote.tiedFrom = this.notes[i].tiedFrom;
                    jianpuNote.tiedFrom.tiedTo = jianpuNote; // Relink previous
                }
                 if (this.notes[i].tiedTo) {
                    jianpuNote.tiedTo = this.notes[i].tiedTo;
                    jianpuNote.tiedTo.tiedFrom = jianpuNote; // Relink next
                }
                this.notes[i] = jianpuNote; // Replace
                replacedDuplicate = true;
            }
            // If new note is same length or longer, ignore it
            break; // Found the duplicate, no need to check further
        }
    }

    if (!isDuplicate) {
        this.notes.push(jianpuNote);
    }

    // Update block length to the minimum length of contained notes if a shorter note was added/replaced
    // Find the minimum length among all notes in the block
    let minLength = Infinity;
    for(const note of this.notes) {
        minLength = Math.min(minLength, note.length);
    }
    this.length = minLength;


    return !isDuplicate || replacedDuplicate;
}


  /**
   * Splits this block into two at a given time point.
   * Modifies the current block to end at the split point and returns the new block
   * representing the remainder. Handles splitting notes and ties.
   * @param quarters Split point time in quarter notes.
   * @param measuresInfo Provides measure context for the new block.
   * @returns The new `JianpuBlock` representing the second part, or `null` if split is not possible.
   */
  public split(quarters: number, measuresInfo: MeasuresInfo): JianpuBlock | null {
    const originalEnd = this.start + this.length;

    // Check if split point is valid (strictly between start and end)
     if (quarters <= this.start || quarters >= originalEnd || isSafeZero(originalEnd - quarters)) {
       return null; // Cannot split at the boundaries or outside
    }

    const remainLength = originalEnd - quarters;
    const newBlockLength = quarters - this.start;

    const splittedBlock = new JianpuBlock(
      quarters,
      remainLength,
      [], // Notes will be added below
      measuresInfo.measureNumberAtQ(quarters) // Calculate measure number for the new block
    );

    const notesForNewBlock: JianpuNote[] = [];
    
    // Iterate through existing notes to split or move them
    for (const note of this.notes) {
        const noteEnd = note.start + note.length;

        if (noteEnd > quarters + 1e-6) { // Note crosses the split point
            const remainingNotePart = splitJianpuNote(note, quarters);
             if (remainingNotePart) {
                // Original note duration was already updated by splitJianpuNote
                notesForNewBlock.push(remainingNotePart);
            } else {
                 // This case shouldn't happen if split point is valid, but good to handle
                 console.warn("Split failed for note, unexpected state.");
            }
        } else if (isSafeZero(noteEnd - quarters)) {
             // Note ends exactly at the split point, it stays entirely in the first block
        }
        // If note ends before split point, it stays in original block unaffected

    }

    // Add the newly created note parts to the split block
    notesForNewBlock.forEach(note => splittedBlock.addNote(note));

    // Update the original block's length
    this.length = newBlockLength;

     // Clear rendering properties, they need recalculation
    delete this.durationLines;
    delete this.augmentationDots;
    delete this.augmentationDash;


    // Transfer beatEnd property if applicable
    if (this.beatEnd) {
      splittedBlock.beatEnd = true; // The new block now potentially ends on a beat
      // The original block *might* no longer end on the beat it previously did,
      // unless the split point itself was a beat. We'll recalculate beatEnd later if needed.
       delete this.beatEnd; // Let beat status be recalculated
    }
     if (this.isTieEnd) {
        // The original block was tied to something *after* the split point
        splittedBlock.isTieStart = true; // The new block starts with a tie
        delete this.isTieEnd; // Original block no longer ends with this tie
    }

    return splittedBlock;
  }

  /**
   * Splits the block, if necessary, so the first part ends at the next beat boundary.
   * Marks `beatBegin` and `beatEnd` properties.
   * @param measuresInfo Provides measure and beat context.
   * @returns The second part of the split block (if split occurred), otherwise `null`.
   */
  public splitToBeat(measuresInfo: MeasuresInfo): JianpuBlock | null {
      const timeSignature = measuresInfo.timeSignatureAtQ(this.start);
      if (!timeSignature) return null; // Should not happen with proper initialization

      const measureLength = measuresInfo.measureLengthAtQ(this.start);
      const measureNum = measuresInfo.measureNumberAtQ(this.start);
      const measureStart = this.start - (measureNum - Math.floor(measureNum)) * measureLength;
      const timeInMeasure = this.start - measureStart;

      const beatLength = 4 / timeSignature.denominator;

      // Check if block starts on a beat
      const startBeatFraction = timeInMeasure / beatLength;
      this.beatBegin = isSafeZero(startBeatFraction - Math.round(startBeatFraction));

      // Calculate the time of the *next* beat boundary after the block starts
      const currentBeatNumber = Math.floor(startBeatFraction + 1e-6); // Beat # within measure (0-indexed)
      const nextBeatTimeInMeasure = (currentBeatNumber + 1) * beatLength;
      const nextBeatTimeAbsolute = measureStart + nextBeatTimeInMeasure;

      // Calculate the time of the measure end
      const measureEndTime = measureStart + measureLength;

       // Time where the current block ends
      const blockEndTime = this.start + this.length;

      let splitTime: number | null = null;

      // Determine split point: the earliest of (next beat, measure end) that falls *within* the block's duration
      if (nextBeatTimeAbsolute < blockEndTime - 1e-6 && nextBeatTimeAbsolute > this.start + 1e-6) {
          splitTime = nextBeatTimeAbsolute;
      }

      // Also consider splitting at measure end if it falls within the block
      if(measureEndTime < blockEndTime - 1e-6 && measureEndTime > this.start + 1e-6) {
           if (splitTime === null || measureEndTime < splitTime) {
                splitTime = measureEndTime;
           }
      }


      let splittedBlock: JianpuBlock | null = null;
      if (splitTime !== null) {
          splittedBlock = this.split(splitTime, measuresInfo);
          if (splittedBlock) {
              // The first (original) block now ends exactly on a beat or measure end
              this.beatEnd = true;
          }
      } else {
          // No split needed within the block based on beats/measure end.
          // Check if the block *already* ends on a beat boundary.
          const endBeatFraction = (timeInMeasure + this.length) / beatLength;
          this.beatEnd = isSafeZero(endBeatFraction - Math.round(endBeatFraction));
          // Also check if it ends exactly at measure end
          if (!this.beatEnd) {
              this.beatEnd = isSafeZero(blockEndTime - measureEndTime);
          }
      }

       // Set tie properties based on notes
        this.isTieStart = this.notes.some(n => n.tiedFrom);
        this.isTieEnd = this.notes.some(n => n.tiedTo);
        if (splittedBlock) {
             splittedBlock.isTieStart = splittedBlock.notes.some(n => n.tiedFrom);
             splittedBlock.isTieEnd = splittedBlock.notes.some(n => n.tiedTo);
             // If original block ended with a tie, and we split, the new splittedBlock
             // starts with that tie. The original block no longer ends the tie.
             if (this.notes.some(n => n.tiedTo && (n.start + n.length > splitTime!))) {
                 delete this.isTieEnd;
             }
        }


      return splittedBlock;
  }


    /**
     * Calculates and sets the rendering properties (duration lines, dots, dashes).
     * Call this AFTER all splitting.
     * @param measuresInfo Provides context (e.g., allowDottedRests).
     */
    public calculateRenderProperties(measuresInfo: MeasuresInfo): void {
        // 重置渲染属性
        delete this.durationLines;
        delete this.augmentationDots;
        delete this.augmentationDash;
    
        const blockLength = this.length;
        if (isSafeZero(blockLength) || blockLength < 0) return;
    
        // 处理附点音符逻辑
        const dottedQuarter = 1.5;
        const dottedEighth = 0.75;
        const dottedSixteenth = 0.375;
        const dottedHalf = 3.0;
    
        if (measuresInfo.allowDottedRests || this.notes.length > 0) {
            if (isSafeZero(blockLength - dottedQuarter)) {
                this.augmentationDots = 1;
                return;
            }
            if (isSafeZero(blockLength - dottedEighth)) {
                this.durationLines = 1;
                this.augmentationDots = 1;
                return;
            }
            if (isSafeZero(blockLength - dottedSixteenth)) {
                this.durationLines = 2;
                this.augmentationDots = 1;
                return;
            }
            if (isSafeZero(blockLength - dottedHalf)) {
                this.augmentationDots = 1;
            }
        }


        if (blockLength >= 4.0 - 1e-6) {
            this.durationLines = 0;
        } else if (blockLength >= 2.0 - 1e-6) {
            this.durationLines = 0;
        } else if (blockLength >= 1.0 - 1e-6) {
            this.durationLines = 0;
        } else if (blockLength >= 0.5 - 1e-6) {
            this.durationLines = 1;
        } else if (blockLength >= 0.25 - 1e-6) {
            this.durationLines = 2;
        } else if (blockLength >= 0.125 - 1e-6) {
            this.durationLines = 3;
        } else if (blockLength >= 0.0625 - 1e-6) {
            this.durationLines = 4;
        } else {
            this.durationLines = 4;
        }
    
        // 新增的 augmentationDash 逻辑
        this.augmentationDash = false;
    
        // 条件 1: block 中只有一个音符
        if (this.notes.length === 1) {
            const currentNote = this.notes[0];
            const timeSignature = measuresInfo.timeSignatureAtQ(this.start);
            if (!timeSignature) return;
            
            // 根据拍号获取基本节拍单位 最小到四分音符长度
            const beatLength = Math.max(4 / timeSignature.denominator, 1.0);
            
            const isFirstBlock = this.measureNumber % 1 <=  1e-6; // 使用小节号判断更准确


            // 条件 2 & 3: 存在前一个完整基本节拍单位音符且音高相同
            if (!isFirstBlock && currentNote.tiedFrom && 
                isSafeZero(currentNote.tiedFrom.length - beatLength) && 
                currentNote.tiedFrom.pitch === currentNote.pitch &&
                currentNote.length >= 1.0) {
                
                // 条件 4: 后续连接的音符没有跨小节
                let validNextNote = true;
                if (currentNote.tiedTo) {
                    const nextNoteStart = currentNote.start + currentNote.length;
                    const currentMeasure = Math.floor(measuresInfo.measureNumberAtQ(this.start));
                    const nextNoteMeasure = Math.floor(measuresInfo.measureNumberAtQ(nextNoteStart));
                    validNextNote = (currentMeasure === nextNoteMeasure) && 
                                  (currentNote.tiedTo.length >= 1.0); // 新增条件：下一个note不小于四分音符长度
                }
    
                if (validNextNote) {
                    this.augmentationDash = true;
                }
            }
        }


    }

    /**
     * Splits a block to fit standard musical symbol lengths (lines/dots/dashes).
     * This is complex in Jianpu as duration isn't just head shape + flags.
     * It tries to find the largest standard representable duration (like dotted quarter,
     * half, eighth, etc.) that fits within the current block length.
     * @param measuresInfo Context for splitting rules.
     * @returns The remainder of the block after splitting off the first symbol, or null.
     */
    public splitToStandardSymbol(measuresInfo: MeasuresInfo): JianpuBlock | null {
        const blockLength = this.length;
        if (isSafeZero(blockLength) || blockLength < MIN_RESOLUTION - 1e-6) {
             // Already too short or zero length, cannot split further meaningfully
             return null;
        }

        // Define standard renderable lengths (longest first)
        // Including common dotted values if allowed
        const standardLengths: number[] = [];
         if (measuresInfo.allowDottedRests || this.notes.length > 0) {
             standardLengths.push(6.0); // Dotted Whole (less common)
             standardLengths.push(4.0); // Whole
             standardLengths.push(3.0); // Dotted Half
             standardLengths.push(2.0); // Half
             standardLengths.push(1.5); // Dotted Quarter
             standardLengths.push(1.0); // Quarter
             standardLengths.push(0.75);// Dotted Eighth
             standardLengths.push(0.5); // Eighth
             standardLengths.push(0.375);// Dotted Sixteenth
             standardLengths.push(0.25);// Sixteenth
             standardLengths.push(0.125);// 32nd
             standardLengths.push(0.0625); // 64th
         } else { // Only non-dotted rests
              standardLengths.push(4.0); // Whole
              standardLengths.push(2.0); // Half
              standardLengths.push(1.0); // Quarter
              standardLengths.push(0.5); // Eighth
              standardLengths.push(0.25);// Sixteenth
              standardLengths.push(0.125);// 32nd
              standardLengths.push(0.0625); // 64th
         }


        let bestFitLength = 0;

        // Find the largest standard length that is less than or equal to the block length
        for (const standardLen of standardLengths) {
            if (blockLength >= standardLen - 1e-6) { // Allow for float tolerance
                bestFitLength = standardLen;
                break; // Found the longest fit
            }
        }


        if (isSafeZero(bestFitLength)) {
            // Block length is smaller than the smallest standard unit, weird state.
            // Render as shortest possible.
            bestFitLength = MIN_RESOLUTION; // Force it to the minimum representable
            if(blockLength < bestFitLength - 1e-6 && blockLength > 1e-6) {
                console.warn(`Block length ${blockLength} is too small, rendering as ${bestFitLength}`);
            }
        }


        // Split the block at the determined best fit length
        let splittedBlock: JianpuBlock | null = null;
        if (blockLength > bestFitLength + 1e-6) { // Only split if there's remaining duration
            splittedBlock = this.split(this.start + bestFitLength, measuresInfo);
            // Ensure the first part (this block) has the exact bestFitLength
           if (this.length !== bestFitLength) {
                console.warn(`Adjusting block length after split from ${this.length} to ${bestFitLength}`);
                this.length = bestFitLength;
           }
        } else {
            // The block is exactly a standard symbol length, no split needed.
            // Ensure the length is precisely the standard length found.
            this.length = bestFitLength;
        }

        return splittedBlock;
    }


  /**
   * Merges this block into a map, either adding it or merging its notes
   * into an existing block at the same start time.
   * @param map The `JianpuBlockMap` to merge into.
   */
  public mergeToMap(map: JianpuBlockMap) {
    const existingBlock = map.get(this.start);
    if (existingBlock) {
      // Merge notes into the existing block. Assumes addNote handles duplicates/length.
      this.notes.forEach(note => existingBlock.addNote(note));
      // Update measure number if the new block had a more accurate one (e.g., after split)
      // This might need refinement based on how measure numbers are tracked.
      if (this.measureNumber !== 0) existingBlock.measureNumber = this.measureNumber;

    } else {
      // Add this block as a new entry
      map.set(this.start, this);
    }
  }

  /**
   * Checks if the block starts exactly at the beginning of a measure.
   * @returns `true` if it starts at the beginning of a measure.
   */
  public isMeasureBeginning(): boolean {
    // Check if the fractional part of the measure number is zero (or very close)
    return isSafeZero(this.measureNumber - Math.floor(this.measureNumber));
  }

}