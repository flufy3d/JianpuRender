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
      this.jianpuInfo = jianpuInfo;
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
      this.jianpuInfo = jianpuInfo;
  
      jianpuInfo.notes.sort((a, b) => a.start - b.start);
  
      this.lastQ = 0;
      jianpuInfo.notes.forEach(note => {
          this.lastQ = Math.max(this.lastQ, note.start + note.length);
      });
      this.lastQ += 1e-6; // Small buffer for final block processing
  
      jianpuInfo.tempos = jianpuInfo.tempos && jianpuInfo.tempos.length ? jianpuInfo.tempos : [DEFAULT_TEMPO];
      jianpuInfo.tempos.sort((a, b) => a.start - b.start);
      if (jianpuInfo.tempos[0].start > 1e-6) {
          jianpuInfo.tempos.unshift({...DEFAULT_TEMPO, start: 0 });
      }
  
      const startingKey: KeySignatureInfo = defaultKey !== undefined ?
          { start: 0, key: defaultKey } : { ...DEFAULT_KEY_SIGNATURE };
      jianpuInfo.keySignatures = jianpuInfo.keySignatures && jianpuInfo.keySignatures.length ? jianpuInfo.keySignatures : [startingKey];
      jianpuInfo.keySignatures.sort((a, b) => a.start - b.start);
      if (jianpuInfo.keySignatures[0].start > 1e-6) {
           jianpuInfo.keySignatures.unshift({...startingKey, start: 0});
      }
  
      jianpuInfo.timeSignatures = jianpuInfo.timeSignatures && jianpuInfo.timeSignatures.length ? jianpuInfo.timeSignatures : [DEFAULT_TIME_SIGNATURE];
      jianpuInfo.timeSignatures.sort((a, b) => a.start - b.start);
      if (jianpuInfo.timeSignatures[0].start > 1e-6) {
           jianpuInfo.timeSignatures.unshift({...DEFAULT_TIME_SIGNATURE, start: 0});
      }
  
      this.measuresInfo = new MeasuresInfo(jianpuInfo, this.lastQ);
      this.infoToBlocks();
    }
  
    /**
    * Converts raw NoteInfo into structured JianpuBlocks.
    * Handles note grouping, rests, and basic splitting.
    */
    private infoToBlocks(): void {
      const rawBlocks = new Map<number, JianpuBlock>();
      let lastNoteEndTime = 0;
  
      this.jianpuInfo.notes.forEach(note => {
          const noteStart = note.start;
          const measureNumber = this.measuresInfo.measureNumberAtQ(noteStart);
  
          if (noteStart > lastNoteEndTime + 1e-6) { // Fill Rests
              const restStart = lastNoteEndTime;
              const restLength = noteStart - restStart;
              const restMeasureNum = this.measuresInfo.measureNumberAtQ(restStart);
              const restBlock = new JianpuBlock(restStart, restLength, [], restMeasureNum);
              rawBlocks.set(restStart, restBlock);
          }
  
          const keySignatureKey = this.measuresInfo.keySignatureAtQ(noteStart);
          const jianpuNote = this.createJianpuNote(note, keySignatureKey);
  
          let block = rawBlocks.get(noteStart);
          if (!block) {
              block = new JianpuBlock(noteStart, 0, [], measureNumber);
              rawBlocks.set(noteStart, block);
          }
          block.addNote(jianpuNote);
          lastNoteEndTime = Math.max(lastNoteEndTime, noteStart + block.length);
      });
  
       if (this.lastQ > lastNoteEndTime + 1e-6) { // Add final rest if needed
           const restStart = lastNoteEndTime;
           const restLength = this.lastQ - restStart;
            if (restLength > 1e-6) {
               const restMeasureNum = this.measuresInfo.measureNumberAtQ(restStart);
               const restBlock = new JianpuBlock(restStart, restLength, [], restMeasureNum);
               rawBlocks.set(restStart, restBlock);
           }
       }
  
      this.jianpuBlockMap = new Map();
      const sortedStartsFromRaw = Array.from(rawBlocks.keys()).sort((a, b) => a - b);
      let blockProcessingQueue: JianpuBlock[] = [];
      sortedStartsFromRaw.forEach(start => {
          blockProcessingQueue.push(rawBlocks.get(start)!);
      });
  
      const processedBlocksForSplitting = new Set<number>();
  
      while (blockProcessingQueue.length > 0) {
          let currentBlock = blockProcessingQueue.shift()!;
  
          if (processedBlocksForSplitting.has(currentBlock.start) && this.jianpuBlockMap.has(currentBlock.start)) {
              // Block might have been re-added after a split, potentially merged already.
              // mergeToMap should handle updates if necessary.
          }
  
          let remainingBeatSplit = currentBlock.splitToBeat(this.measuresInfo);
          if (remainingBeatSplit) {
              currentBlock.mergeToMap(this.jianpuBlockMap);
              processedBlocksForSplitting.add(currentBlock.start);
              blockProcessingQueue.unshift(remainingBeatSplit);
              continue;
          }
  
          let blockToSymbolSplit = currentBlock;
          let remainingSymbolSplit : JianpuBlock | null = null;
          do {
              remainingSymbolSplit = blockToSymbolSplit.splitToStandardSymbol(this.measuresInfo);
              blockToSymbolSplit.mergeToMap(this.jianpuBlockMap);
              processedBlocksForSplitting.add(blockToSymbolSplit.start);
              if (remainingSymbolSplit) {
                  blockToSymbolSplit = remainingSymbolSplit;
              }
           } while(remainingSymbolSplit);
      }
  
      this.jianpuBlockMap.forEach((block) => {
          block.calculateRenderProperties(this.measuresInfo);
      });
    }
  
    /**
     * Converts a raw NoteInfo into a JianpuNote, calculating the
     * Jianpu number, octave dots, and accidental based on key context.
     * @param note The raw NoteInfo.
     * @param key The current key signature (0-11).
     * @returns A processed JianpuNote.
     */
     private createJianpuNote(note: NoteInfo, key: number): JianpuNote {
          const details = mapMidiToJianpu(note.pitch, key);
  
          const jianpuNote: JianpuNote = {
              ...note,
              jianpuNumber: details.jianpuNumber,
              octaveDot: details.octaveDot,
              accidental: details.accidental, // Directly use accidental from key context
          };
          return jianpuNote;
      }
  }
  

/**
 * Maps a MIDI pitch to its Jianpu representation (number, octave dots, accidental)
 * relative to a given key signature (tonic).
 * @param midiPitch The MIDI pitch number (e.g., 60 = Middle C).
 * @param key The key signature tonic (0=C, 1=Db/C#, ..., 11=B).
 * @returns Object containing { jianpuNumber (1-7), octaveDot, accidental (0=none, 1=#, 2=b, 3=natural is not used by this func) }.
 */
export function mapMidiToJianpu(midiPitch: number, key: number): {
    jianpuNumber: number;
    octaveDot: number;
    accidental: number;
  } {
    const keyPitchClass = key % 12;
    let tonicMidiRef = MIDDLE_C_MIDI + keyPitchClass;
    // Adjust tonicMidiRef to be the tonic in the octave typically represented with no dots
    // For C major, tonicMidiRef is C4. For G major, G3. For F major, F3 etc.
    if (keyPitchClass > (MIDDLE_C_MIDI % 12)) { // MIDDLE_C_MIDI % 12 is 0 (C)
        tonicMidiRef -= 12;
    }
  
    // tonicMidi: The tonic of the key, adjusted to be in an octave close to the input midiPitch
    // This helps in calculating the interval within a single octave.
    const octaveOffsetForIntervalCalc = Math.round((midiPitch - tonicMidiRef) / 12);
    const tonicMidi = tonicMidiRef + octaveOffsetForIntervalCalc * 12;
  
    // Interval in semitones from the octave-adjusted tonic to the midiPitch.
    const interval = (midiPitch - tonicMidi + 12) % 12;
  
    let jianpuNumber = MAJOR_SCALE_INTERVALS[interval];
    let accidental = 0; // 0:none, 1:#, 2:b
  
    if (jianpuNumber === undefined) { // Note is chromatic relative to the major scale of the key
        // interval is the chromatic semitone distance from the tonic of the current key.
        // e.g. in C major (tonic C): C# is interval 1, Eb is interval 3, etc.
        // MAJOR_SCALE_INTERVALS maps diatonic intervals from tonic to jianpu degrees (1-7)
        // e.g. MAJOR_SCALE_INTERVALS[0] is 1 (Do), MAJOR_SCALE_INTERVALS[4] is 3 (Mi)
  
        switch (interval) {
            case 1: // e.g., C# in C major (1 semitone above tonic)
                // Prefer C# (Do sharp) over Db (Re flat)
                jianpuNumber = MAJOR_SCALE_INTERVALS[0]; // Jianpu degree of the note it's sharpening (tonic)
                accidental = 1; // sharp
                break;
            case 3: // e.g., Eb in C major (3 semitones above tonic)
                // Prefer Eb (Mi flat) over D# (Re sharp)
                jianpuNumber = MAJOR_SCALE_INTERVALS[4]; // Jianpu degree of the note it's flatting (major third)
                accidental = 2; // flat
                break;
            case 6: // e.g., F# in C major (6 semitones above tonic)
                // Prefer F# (Fa sharp) over Gb (So flat)
                jianpuNumber = MAJOR_SCALE_INTERVALS[5]; // Jianpu degree of the note it's sharpening (perfect fourth)
                accidental = 1; // sharp
                break;
            case 8: // e.g., Ab in C major (8 semitones above tonic)
                // Prefer Ab (La flat) over G# (So sharp)
                jianpuNumber = MAJOR_SCALE_INTERVALS[9]; // Jianpu degree of the note it's flatting (major sixth)
                accidental = 2; // flat
                break;
            case 10: // e.g., Bb in C major (10 semitones above tonic)
                // Prefer Bb (Ti flat) over A# (La sharp)
                jianpuNumber = MAJOR_SCALE_INTERVALS[11]; // Jianpu degree of the note it's flatting (major seventh)
                accidental = 2; // flat
                break;
            default:
                // This case should ideally not be reached if `interval` is truly chromatic (1,3,6,8,10)
                // and MAJOR_SCALE_INTERVALS is well-defined.
                // As a fallback, try the original logic's sharp preference.
                console.warn(`Unexpected chromatic interval ${interval} in mapMidiToJianpu. Defaulting to sharp of lower valid degree.`);
                const lowerIntervalFallback = (interval - 1 + 12) % 12;
                const upperIntervalFallback = (interval + 1 + 12) % 12;
                const lowerDegreeFallback = MAJOR_SCALE_INTERVALS[lowerIntervalFallback];
                const upperDegreeFallback = MAJOR_SCALE_INTERVALS[upperIntervalFallback];
  
                if (lowerDegreeFallback !== undefined) {
                    jianpuNumber = lowerDegreeFallback;
                    accidental = 1; // sharp
                } else if (upperDegreeFallback !== undefined) {
                    jianpuNumber = upperDegreeFallback;
                    accidental = 2; // flat
                } else {
                    // Extremely unlikely fallback if MAJOR_SCALE_INTERVALS is sparse.
                    jianpuNumber = 1; // Default to 1#
                    accidental = 1;
                    console.error(`Could not determine Jianpu number components for MIDI ${midiPitch}, interval ${interval} from tonic in key ${key}.`);
                }
                break;
        }
  
        // Final check: jianpuNumber should be defined after the switch if interval was one of 1,3,6,8,10
        // and MAJOR_SCALE_INTERVALS has entries for 0,4,5,9,11.
        if (jianpuNumber === undefined) {
             console.error(`Jianpu number became undefined for MIDI ${midiPitch} (interval ${interval}, key ${key}) after chromatic processing. This indicates a logic error or misconfigured MAJOR_SCALE_INTERVALS.`);
             // Provide a very basic fallback to prevent crashes, though this state is erroneous.
             jianpuNumber = 1;
             accidental = 1; // Default to 1#
        }
    }
  
    // Octave dots are relative to the tonicMidiRef (the "no dots" reference octave for the current key's tonic).
    const octaveDot = Math.floor((midiPitch - tonicMidiRef) / 12);
    
    return {
        jianpuNumber,
        octaveDot,
        accidental,
    };
  }