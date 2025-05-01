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
  JianpuInfo, NoteInfo, KeySignatureInfo,
  DEFAULT_TEMPO, DEFAULT_TIME_SIGNATURE, DEFAULT_KEY_SIGNATURE
} from './jianpu_info';
import { MeasuresInfo } from './measure_info';
import { JianpuBlock, JianpuBlockMap, JianpuNote } from './jianpu_block';
import {
   MAJOR_SCALE_INTERVALS, MIDDLE_C_MIDI
} from './model_constants';

/** Temporary storage of accidentals activated within a measure by MIDI pitch */
type MeasureAccidentals = {[pitch: number]: number}; // 0:none, 1:#, 2:b, 3:natural

/**
 * Models JianpuInfo into a musical structure of JianpuBlocks indexed by the
 * quarter note time they start from. Handles note processing, splitting, and
 * rhythmic context.
 */
export class JianpuModel {
  /** The input score info, stored for potential external updates. */
  public jianpuInfo: JianpuInfo;
  /** Pre-calculated measure, tempo, key, and time signature info per time chunk. */
  public measuresInfo: MeasuresInfo;
  /** The result of analysis: JianpuBlocks indexed by start time (quarters). */
  public jianpuBlockMap: JianpuBlockMap;
  /** Last processed quarter note time, indicating the score's duration. */
  private lastQ: number;

  /**
   * Creates a `JianpuModel`.
   * @param jianpuInfo Generic information about the score.
   * @param defaultKey Optional default key signature (0-11, 0=C) if not specified at time 0.
   */
  constructor(jianpuInfo: JianpuInfo, defaultKey?: number) {
    this.jianpuInfo = jianpuInfo; // Keep a reference
    this.jianpuBlockMap = new Map();
    this.lastQ = 0;

    this.update(jianpuInfo, defaultKey);
  }


  /**
   * 判断给定时间是否处于乐谱最后一个小节
   * @param q 要检查的四分音符时间位置
   * @returns 如果处于最后小节返回true
   */
  public isLastMeasureAtQ(q: number): boolean {
    return q >= this.lastQ - 1e-6; // 允许浮点数精度误差
  }

  /**
   * 获取乐谱总时长(用于外部访问lastQ)
   */
  public getTotalDuration(): number {
    return this.lastQ;
  }



  /**
   * Processes new JianpuInfo to update the internal model.
   * Sorts input arrays and ensures defaults are present.
   * Recalculates `measuresInfo` and `jianpuBlockMap`.
   * @param jianpuInfo New score information.
   * @param defaultKey Optional default key.
   */
  public update(jianpuInfo: JianpuInfo, defaultKey?: number) {
    this.jianpuInfo = jianpuInfo; // Update reference

    // --- Prepare and Sort Input Data ---
    jianpuInfo.notes.sort((a, b) => a.start - b.start);

    this.lastQ = 0;
    jianpuInfo.notes.forEach(note => {
        this.lastQ = Math.max(this.lastQ, note.start + note.length);
    });
    // Add a small buffer to lastQ to ensure the final block is processed
    this.lastQ += 1e-6;


    // Ensure tempos exist and start at 0
    jianpuInfo.tempos = jianpuInfo.tempos && jianpuInfo.tempos.length ? jianpuInfo.tempos : [DEFAULT_TEMPO];
    jianpuInfo.tempos.sort((a, b) => a.start - b.start);
    if (jianpuInfo.tempos[0].start > 1e-6) {
        jianpuInfo.tempos.unshift({...DEFAULT_TEMPO, start: 0 });
    }


    // Ensure key signatures exist and start at 0
    const startingKey: KeySignatureInfo = defaultKey !== undefined ?
        { start: 0, key: defaultKey } : { ...DEFAULT_KEY_SIGNATURE }; // Clone default
     jianpuInfo.keySignatures = jianpuInfo.keySignatures && jianpuInfo.keySignatures.length ? jianpuInfo.keySignatures : [startingKey];
    jianpuInfo.keySignatures.sort((a, b) => a.start - b.start);
    if (jianpuInfo.keySignatures[0].start > 1e-6) {
         jianpuInfo.keySignatures.unshift({...startingKey, start: 0});
    }


    // Ensure time signatures exist and start at 0
    jianpuInfo.timeSignatures = jianpuInfo.timeSignatures && jianpuInfo.timeSignatures.length ? jianpuInfo.timeSignatures : [DEFAULT_TIME_SIGNATURE];
    jianpuInfo.timeSignatures.sort((a, b) => a.start - b.start);
    if (jianpuInfo.timeSignatures[0].start > 1e-6) {
         jianpuInfo.timeSignatures.unshift({...DEFAULT_TIME_SIGNATURE, start: 0}); // Clone default
    }

    // --- Recalculate Contextual Info ---
    this.measuresInfo = new MeasuresInfo(jianpuInfo, this.lastQ);

    // --- Rebuild Blocks ---
    this.infoToBlocks();
  }

 /**
 * Converts raw NoteInfo into structured JianpuBlocks.
 * Handles note grouping, rests, accidentals, and basic splitting.
 */
private infoToBlocks(): void {
    const rawBlocks = new Map<number, JianpuBlock>();
    let measureAccidentals: MeasureAccidentals = {}; // Track accidentals within the current measure
    let currentMeasure = 0; // Track the integer part of the measure number
    let lastNoteEndTime = 0; // Track the end time of the last processed note/rest

    // --- Pass 1: Group notes into blocks and handle initial rests ---
    this.jianpuInfo.notes.forEach(note => {
        const noteStart = note.start;
        const measureNumber = this.measuresInfo.measureNumberAtQ(noteStart);
        const measureInt = Math.floor(measureNumber);

        // --- Fill Rests ---
        if (noteStart > lastNoteEndTime + 1e-6) {
            // There's a gap, create a rest block
            const restStart = lastNoteEndTime;
            const restLength = noteStart - restStart;
            const restMeasureNum = this.measuresInfo.measureNumberAtQ(restStart);
            const restBlock = new JianpuBlock(restStart, restLength, [], restMeasureNum);
            rawBlocks.set(restStart, restBlock); // Add rest block
        }

        // --- Process Note ---
        // Reset accidentals if moving to a new measure
        if (measureInt > currentMeasure) {
            currentMeasure = measureInt;
            measureAccidentals = {}; // Reset for the new measure
        }

        // Convert NoteInfo to JianpuNote and determine rendering details
        const keySignatureKey = this.measuresInfo.keySignatureAtQ(noteStart);
        const jianpuNote = this.createJianpuNote(note, keySignatureKey, measureAccidentals);

        // Find or create the block at this note's start time
        let block = rawBlocks.get(noteStart);
        if (!block) {
            block = new JianpuBlock(noteStart, 0, [], measureNumber); // Length will be updated by addNote
            rawBlocks.set(noteStart, block);
        }
        block.addNote(jianpuNote); // Add note, handles duplicates and sets block length

        // Update the end time tracker
        lastNoteEndTime = Math.max(lastNoteEndTime, noteStart + block.length); // Use block length after potential shortening
    });

     // --- Add final rest if needed ---
     if (this.lastQ > lastNoteEndTime + 1e-6) {
         const restStart = lastNoteEndTime;
         const restLength = this.lastQ - restStart;
          if (restLength > 1e-6) {
             const restMeasureNum = this.measuresInfo.measureNumberAtQ(restStart);
             const restBlock = new JianpuBlock(restStart, restLength, [], restMeasureNum);
             rawBlocks.set(restStart, restBlock);
         }
     }


    // --- Pass 2: Split blocks by rhythm and standard symbols ---
    this.jianpuBlockMap = new Map(); // Final map
    const sortedStartsFromRaw = Array.from(rawBlocks.keys()).sort((a, b) => a - b);
    let blockProcessingQueue: JianpuBlock[] = [];
    sortedStartsFromRaw.forEach(start => {
        blockProcessingQueue.push(rawBlocks.get(start)!);
    });

    const processedBlocksForSplitting = new Set<number>(); // Track starts merged during splitting

    while (blockProcessingQueue.length > 0) {
        let currentBlock = blockProcessingQueue.shift()!;

        // Avoid reprocessing if a block was re-added after split
        if (processedBlocksForSplitting.has(currentBlock.start) && this.jianpuBlockMap.has(currentBlock.start)) {
             // It might have been merged already, potentially needs update if split further
             // For simplicity, let mergeToMap handle updates. Or skip if confident.
             // Let's re-merge to be safe, addNote should handle consistency.
             // console.log(`Re-processing ${currentBlock.start}?`);
        }


        // --- Split by Beat ---
        let remainingBeatSplit = currentBlock.splitToBeat(this.measuresInfo);
        if (remainingBeatSplit) {
             // Merge the first part after beat split
            currentBlock.mergeToMap(this.jianpuBlockMap);
            processedBlocksForSplitting.add(currentBlock.start);
            // Add the remainder back to the front of the queue
            blockProcessingQueue.unshift(remainingBeatSplit);
            continue; // Process the remainder next
        }

        // --- Split by Standard Symbol Length ---
         // If no beat split, or after beat split handled, process symbol splits
        let blockToSymbolSplit = currentBlock; // Start with the current block (post-beat-split if any)
        let remainingSymbolSplit : JianpuBlock | null = null;
        do {
            // Perform the split based on standard symbols
            remainingSymbolSplit = blockToSymbolSplit.splitToStandardSymbol(this.measuresInfo);

            // Merge the part that has a standard symbol length now
            blockToSymbolSplit.mergeToMap(this.jianpuBlockMap);
            processedBlocksForSplitting.add(blockToSymbolSplit.start);

            // If there was a remainder, it becomes the block for the next iteration
            if (remainingSymbolSplit) {
                blockToSymbolSplit = remainingSymbolSplit;
            }
         } while(remainingSymbolSplit); // Continue if split produced a remainder
    } // End of splitting loop


    // --- Pass 3: Calculate Rendering Properties based on Tied Durations ---
    const sortedStarts = Array.from(this.jianpuBlockMap.keys()).sort((a, b) => a - b);
    const startsProcessedForRendering = new Set<number>();

    for (const start of sortedStarts) {
        if (startsProcessedForRendering.has(start)) {
            continue; // Already handled as part of a previous tied sequence
        }

        const firstBlock = this.jianpuBlockMap.get(start)!;
        startsProcessedForRendering.add(start); // Mark this block as visited

        // Check if this block is the start of a visual event
        // (i.e., not tied FROM a previous block, or it's a rest)
        const isEventStart = firstBlock.notes.length === 0 || firstBlock.notes.every(n => !n.tiedFrom);

        if (isEventStart) {
            let totalEventDuration = 0;
            let currentBlockInSequence: JianpuBlock | undefined = firstBlock;
            let currentSequenceStart = start;

             // Follow ties to calculate total duration
            while (currentBlockInSequence) {
                totalEventDuration += currentBlockInSequence.length;

                // Check if the *next* block exists and is tied *from* this one
                const nextBlockStart = currentSequenceStart + currentBlockInSequence.length;
                 // Use tolerance when getting next block
                let nextBlock : JianpuBlock | undefined = undefined;
                for (const potentialNextStart of Array.from(this.jianpuBlockMap.keys())){
                    if(Math.abs(potentialNextStart - nextBlockStart) < 1e-6) {
                        nextBlock = this.jianpuBlockMap.get(potentialNextStart);
                        break;
                    }
                }

                // Does the next block continue the tie?
                // Simplified check: if *any* note ties forward, assume the block continues the tie visually.
                // Also ensure the next block actually starts where this one ends.
                if (nextBlock && currentBlockInSequence.notes.some(n => n.tiedTo) && nextBlock.notes.some(n => n.tiedFrom)) {
                    // Mark the next block as visited so we don't start a new calculation from it
                    startsProcessedForRendering.add(nextBlock.start);
                    currentBlockInSequence = nextBlock;
                    currentSequenceStart = nextBlock.start; // Update start for the next lookup
                } else {
                    currentBlockInSequence = undefined; // End of tied sequence
                }
            }


        } 

        firstBlock.calculateRenderProperties(this.measuresInfo);

    }



  }


  /**
   * Converts a raw NoteInfo into a JianpuNote, calculating the
   * Jianpu number, octave dots, and handling accidentals based on context.
   * @param note The raw NoteInfo.
   * @param key The current key signature (0-11).
   * @param measureAccidentals Accidentals currently active in the measure.
   * @returns A processed JianpuNote.
   */
   private createJianpuNote(note: NoteInfo, key: number, measureAccidentals: MeasureAccidentals): JianpuNote {
        const details = mapMidiToJianpu(note.pitch, key);

        let displayAccidental = details.accidental; // Accidental needed based purely on pitch and key scale

        // Check measure accidentals
        const accidentalInMemory = measureAccidentals[note.pitch];

        if (accidentalInMemory !== undefined) {
            // Note pitch has occurred before in this measure
            if (displayAccidental === accidentalInMemory) {
                // Same accidental is already active, don't display it again
                displayAccidental = 0; // 0 means no visual accidental needed
            } else {
                // Accidental is different from the one currently active for this pitch class
                // Keep displayAccidental as calculated (e.g., need a natural sign or a new sharp/flat)
                measureAccidentals[note.pitch] = displayAccidental; // Update memory
            }
        } else {
             // First time this pitch appears in the measure
             if (displayAccidental !== 0) {
                 measureAccidentals[note.pitch] = displayAccidental; // Store the needed accidental
             } else {
                 // If the note is diatonic and needs no accidental based on key,
                 // store '0' so we know if it changes later (e.g. to natural)
                  measureAccidentals[note.pitch] = 0;
             }
        }

        // Special case: If a natural is needed (details.accidental = 3), display it.
        // The logic above handles subsequent occurrences correctly.


        // Tie handling: tied notes generally don't repeat accidentals visually
        // We rely on the block splitting logic to handle ties across measures correctly,
        // resetting measureAccidentals at the measure boundary. A note starting a measure
        // that is tied *from* the previous measure might incorrectly show an accidental
        // if not handled carefully. Let's add a check here.
        // NOTE: This simple check assumes tiedFrom is already set if applicable.
        // This might need to happen *after* initial block creation and tie linking.
        // For now, let's assume ties are handled later or this check is sufficient.

        const jianpuNote: JianpuNote = {
            ...note, // Copy start, length, pitch, intensity
            jianpuNumber: details.jianpuNumber,
            octaveDot: details.octaveDot,
            accidental: displayAccidental, // The accidental to *display*
            // tiedFrom/tiedTo will be linked during block processing/splitting
        };

        return jianpuNote;
    }


} // End of JianpuModel class


/**
 * Maps a MIDI pitch to its Jianpu representation (number, octave dots, accidental)
 * relative to a given key signature (tonic).
 *
 * @param midiPitch The MIDI pitch number (e.g., 60 = Middle C).
 * @param key The key signature tonic (0=C, 1=Db/C#, ..., 11=B).
 * @returns Object containing { jianpuNumber (1-7), octaveDot, accidental (0=none, 1=#, 2=b, 3=natural) }.
 */
export function mapMidiToJianpu(midiPitch: number, key: number): {
  jianpuNumber: number;
  octaveDot: number;
  accidental: number;
} {
  // Find the MIDI pitch of the tonic in the same octave as Middle C
  const keyPitchClass = key % 12;
  let tonicMidiRef = MIDDLE_C_MIDI + keyPitchClass;
  if (keyPitchClass > (MIDDLE_C_MIDI % 12)) {
      tonicMidiRef -= 12;
  }
  // Adjust tonic to nearest octave to midiPitch
  const octaveOffset = Math.round((midiPitch - tonicMidiRef) / 12);
  const tonicMidi = tonicMidiRef + octaveOffset * 12;

  // Interval from tonic
  const interval = (midiPitch - tonicMidi + 12) % 12;

  // Determine base Jianpu number from major scale intervals
  let jianpuNumber = MAJOR_SCALE_INTERVALS[interval];
  let accidental = 0;

  if (jianpuNumber === undefined) {
      // Chromatic; find nearest diatonic degrees
      const lowerInterval = (interval - 1 + 12) % 12;
      const upperInterval = (interval + 1) % 12;
      const lowerDegree = MAJOR_SCALE_INTERVALS[lowerInterval];
      const upperDegree = MAJOR_SCALE_INTERVALS[upperInterval];

      if (lowerDegree !== undefined) {
          jianpuNumber = lowerDegree;
          accidental = 1; // sharp
      } else if (upperDegree !== undefined) {
          jianpuNumber = upperDegree;
          accidental = 2; // flat
      } else {
          console.warn(`Could not determine Jianpu number for interval ${interval} in key ${key}`);
          jianpuNumber = 1;
          accidental = 1;
      }
  }

  // Octave dots relative to tonic octave
  const octaveDot = Math.floor((midiPitch - tonicMidiRef) / 12);
  
  return {
      jianpuNumber,
      octaveDot,
      accidental,
  };
}
