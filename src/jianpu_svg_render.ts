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
  LINE_STROKE_WIDTH, COMPACT_SPACING_FACTOR, UNDERLINE_SPACING_FACTOR,
  OCTAVE_DOT_OFFSET_FACTOR, DOT_SIZE_FACTOR, AUGMENTATION_DASH_FACTOR,
  FONT_SIZE_MULTIPLIER, SMALL_FONT_SIZE_MULTIPLIER, DURATION_LINE_SCALES
} from './render_constants';

import {
  SVGNS, drawSVGPath, drawSVGText, createSVGGroupChild, setBlinkAnimation,
  setStroke, highlightElement, resetElementHighlight
} from './svg_tools';

import  {
  PATH_SCALE, ACCIDENTAL_TEXT, // Using text for accidentals
  barPath, underlinePath, augmentationDashPath, tiePath, dotPath
} from './svg_paths';

import {
  JianpuInfo, TimeSignatureInfo, NoteInfo,
   DEFAULT_TIME_SIGNATURE
} from './jianpu_info';

import {
  JianpuBlock, JianpuNote
} from './jianpu_block';

import {
  JianpuModel
} from './jianpu_model';

import { PITCH_CLASS_NAMES } from './model_constants';


/**
 * Enumeration of different ways of horizontal score scrolling.
 */
export enum ScrollType {
  PAGE = 0, // Scroll page by page
  NOTE = 1, // Center each highlighted note
  BAR = 2   // Scroll to center the start of a measure when its first note is highlighted
}

/**
 * Configuration options for JianpuSVGRender.
 */
export interface JianpuSVGRenderConfig {
  /** Base vertical height in pixels for a standard note number (e.g., '1'). Controls overall scale. */
  noteHeight?: number;
  /** Horizontal spacing factor in COMPACT mode (multiple of note width). This factor determines the base gap *after* a note. */
  noteSpacingFactor?: number;
  /** Pixels per quarter note in PROPORTIONAL mode. 0 or undefined for COMPACT mode. */
  pixelsPerTimeStep?: number;
  /** Color for standard notes/symbols (RGB string or CSS color name). */
  noteColor?: string;
  /** Color for highlighted/active notes (RGB string or CSS color name). */
  activeNoteColor?: string;
  /** Default key signature (0-11) if not specified in JianpuInfo at time 0. */
  defaultKey?: number;
  /** Scroll behavior during playback. */
  scrollType?: ScrollType;
  /** Font family for rendering numbers and text. */
  fontFamily?: string;
  /** Explicitly set the width of the SVG container */
  width?: number;
   /** Explicitly set the height of the SVG container */
  height?: number;
}

/** Internal structure to track visual elements tied together (e.g., across blocks). */
interface LinkedSVGDetails {
  /** The SVG group element containing the note parts. */
  g: SVGGElement;
  /** x position at the rightmost edge of the note number/dots/dashes (for tie start). */
  xNoteRight: number;
  /** y position of the note number baseline (for tie vertical placement). */
  yNoteBaseline: number;
}

/** Map to link logical notes to their rendered SVG elements for ties. */
type LinkedNoteMap = Map<JianpuNote, LinkedSVGDetails>;

/**
 * Renders `JianpuInfo` data as numbered musical notation (Jianpu) in an SVG element.
 */
export class JianpuSVGRender {
  public jianpuInfo: JianpuInfo;
  public jianpuModel: JianpuModel;
  private config: Required<JianpuSVGRenderConfig>; // Use Required for internal consistency
  private height: number;
  private width: number;

  // SVG Elements
  private parentElement: HTMLElement; // The user-provided container div's direct child for scrolling
  private div: HTMLDivElement;       // The user-provided container div
  private mainSVG: SVGSVGElement;    // The main SVG drawing area
  private mainG: SVGGElement;        // Top-level group in mainSVG for transforms
  private musicG: SVGGElement;       // Group for notes, rests, ties, bar lines
  private signaturesG: SVGGElement;  // Group for key/time signatures *within* the scrollable area
  private overlaySVG: SVGSVGElement; // Fixed overlay SVG for current signatures
  private overlayG: SVGGElement;     // Group within overlaySVG

  // State
  private signaturesBlinking: boolean;
  private lastKnownScrollLeft: number;
  private isScrolling: boolean;
  private currentKey: number;
  private currentTimeSignature: TimeSignatureInfo;
  private playingNotes: Map<string, NoteInfo>; // Map key: `${start}-${pitch}`
  private lastRenderedQ: number; // Track the last quarter note time rendered
  private estimatedNoteWidth: number; // Estimated width of a basic number for spacing

  // Layout & Scaling
  private numberFontSize: number;
  private smallFontSize: number;
  private yBaseline: number; // Vertical position for the number baseline


    /**
     * 解析多种格式的颜色字符串为有效的CSS颜色值
     * @param colorStr 颜色字符串，支持格式："blue"、"rgb(255,165,0)"、"255,165,0"
     * @returns 标准化的CSS颜色字符串
     */
    private parseColorString(colorStr: string): string {
        // 如果是CSS颜色名称或rgb()格式，直接返回
        if (/^[a-z]+$/i.test(colorStr) || colorStr.startsWith('rgb(')) {
            return colorStr;
        }
        // 处理"255,165,0"格式
        if (/^\d+,\s*\d+,\s*\d+$/.test(colorStr)) {
            return `rgb(${colorStr})`;
        }
        return colorStr; // 默认返回原字符串
    }


  /**
   * `JianpuSVGRender` constructor.
   * @param score The `JianpuInfo` to visualize.
   * @param config Visualization configuration options.
   * @param div The HTMLDivElement where the visualization should be displayed.
   */
  constructor(
    score: JianpuInfo,
    config: JianpuSVGRenderConfig,
    div: HTMLDivElement
  ) {
    this.jianpuInfo = score;
    this.div = div;

    // --- Default Configuration ---
    const defaultNoteHeight = 20; // Base size in pixels
    const defaultPixelsPerTimeStep = 0; // Default to compact mode
    this.config = {
      noteHeight: config.noteHeight ?? defaultNoteHeight,
      noteSpacingFactor: config.noteSpacingFactor ?? COMPACT_SPACING_FACTOR,
      pixelsPerTimeStep: config.pixelsPerTimeStep ?? defaultPixelsPerTimeStep,
      noteColor: this.parseColorString(config.noteColor ?? 'black'),
      activeNoteColor: this.parseColorString(config.activeNoteColor ?? 'red'),
      defaultKey: config.defaultKey ?? 0, // Default to C Major
      scrollType: config.scrollType ?? ScrollType.PAGE,
      fontFamily: config.fontFamily ?? 'sans-serif',
      width: config.width ?? 0, // Auto-width by default
      height: config.height ?? 0, // Auto-height by default
    };

     // --- Initial Model Creation ---
    this.jianpuModel = new JianpuModel(this.jianpuInfo, this.config.defaultKey);
    this.currentKey = this.jianpuModel.measuresInfo.keySignatureAtQ(0);
    this.currentTimeSignature = this.jianpuModel.measuresInfo.timeSignatureAtQ(0) ?? DEFAULT_TIME_SIGNATURE;


    // --- Initialize State & Layout ---
    this.playingNotes = new Map();
    this.lastRenderedQ = -1;
    this.signaturesBlinking = false;
    this.lastKnownScrollLeft = 0;
    this.isScrolling = false;

    // Calculate scaling and font sizes based on noteHeight
    this.numberFontSize = this.config.noteHeight * FONT_SIZE_MULTIPLIER;
    this.smallFontSize = this.config.noteHeight * SMALL_FONT_SIZE_MULTIPLIER;
     // Estimate width for spacing (crude, might need measurement)
    this.estimatedNoteWidth = this.numberFontSize * 0.6; // Guess based on typical font aspect ratio
    // Position baseline: place it slightly above center for balanced look with dots/lines
    this.yBaseline = this.config.noteHeight * 1.5; // Start baseline lower to allow space above

    this.height = 0; // Will be calculated
    this.width = 0; // Will be calculated

    this.clear(); // Setup SVG structure
    this.redraw(); // Initial drawing
  }

  /**
   * Clears the SVG elements and resets internal state for a fresh draw.
   */
  public clear() {
    // Empty the container div
    while (this.div.lastChild) {
      this.div.removeChild(this.div.lastChild);
    }
    this.div.style.position = 'relative'; // Needed for overlay positioning
    this.div.style.overflow = 'hidden'; // Hide internal scrollbars if parentElement scrolls

    // --- Overlay for Fixed Signatures ---
    this.overlaySVG = document.createElementNS(SVGNS, 'svg');
    this.overlaySVG.style.position = 'absolute';
    this.overlaySVG.style.left = '0';
    this.overlaySVG.style.top = '0';
    this.overlaySVG.style.pointerEvents = 'none'; // Allow interaction with content below
    this.div.appendChild(this.overlaySVG);
    this.overlayG = createSVGGroupChild(this.overlaySVG, 'overlay');

    // --- Scrollable Container ---
    this.parentElement = document.createElement('div');
    this.parentElement.style.overflowX = 'auto'; // Enable horizontal scrolling
    this.parentElement.style.overflowY = 'hidden'; // Vertical scroll managed by overall height
    this.parentElement.style.width = '100%';
    this.parentElement.style.height = '100%'; // Take available space
    this.div.appendChild(this.parentElement);
    this.parentElement.addEventListener('scroll', this.handleScrollEvent);

    // --- Main SVG for Score Content ---
    this.mainSVG = document.createElementNS(SVGNS, 'svg');
    this.mainSVG.style.display = 'block'; // Prevent extra space below SVG
    this.parentElement.appendChild(this.mainSVG);
    this.mainG = createSVGGroupChild(this.mainSVG, 'main-content');

    // Specific layers within main content
    this.signaturesG = createSVGGroupChild(this.mainG, 'signatures'); // In-line signatures
    this.musicG = createSVGGroupChild(this.mainG, 'music'); // Notes, rests, bars, ties

    // Reset state
    this.playingNotes.clear();
    this.lastRenderedQ = -1;
    this.signaturesBlinking = false;
    this.lastKnownScrollLeft = 0;
    this.isScrolling = false;
    this.height = this.config.height > 0 ? this.config.height : this.config.noteHeight * 5; // Initial guess
    this.width = this.config.width > 0 ? this.config.width : 0;

    // Initial signature setup
    this.currentKey = this.jianpuModel.measuresInfo.keySignatureAtQ(0);
    this.currentTimeSignature = this.jianpuModel.measuresInfo.timeSignatureAtQ(0) ?? DEFAULT_TIME_SIGNATURE;
    this.drawSignatures(this.overlayG, 0, true, true); // Draw initial signatures in overlay
    this.updateLayout(); // Set initial sizes
  }

  /** Updates SVG and container dimensions */
   private updateLayout(contentWidth?: number) {
        this.width = contentWidth ?? this.width;
        if (this.config.width > 0) {
            this.width = this.config.width;
        }
   
        // 增加基线偏移量，为签名留出更多空间
        this.height = Math.max(this.height, this.config.noteHeight * 6); // 从5增加到6
        if (this.config.height > 0) {
            this.height = this.config.height;
        }
   
        // 增加yBaseline的值，使乐谱内容下移
        const verticalPadding = this.config.noteHeight * 1.65; // 增加noteHeight的间距
        this.mainSVG.setAttribute('width', `${this.width}`);
        this.mainSVG.setAttribute('height', `${this.height}`);
        this.mainG.setAttribute('transform', `translate(0, ${this.yBaseline + verticalPadding})`); // 增加垂直间距
   
        this.overlaySVG.setAttribute('width', '200');
        this.overlaySVG.setAttribute('height', `${this.height}`);
        this.overlayG.setAttribute('transform', `translate(0, ${this.yBaseline})`); // 签名保持原位置
   }

  /**
   * Redraws the score or highlights notes.
   * If `activeNote` is provided, highlights that note and deactivates others.
   * If `activeNote` is null/undefined, redraws any part of the score
   * not yet rendered (incremental drawing).
   * @param activeNote The note to highlight (optional).
   * @param scrollIntoView If true, scroll the view to the active note (optional).
   * @returns The x-position of the highlighted note, or -1.
   */
  public redraw(
    activeNote?: NoteInfo,
    scrollIntoView?: boolean
  ): number {
    let activeNotePosition = -1;
    const isCompact = this.config.pixelsPerTimeStep <= 0;

    // --- Highlight Handling ---
    if (activeNote) {
        const noteId = `${activeNote.start}-${activeNote.pitch}`;

        // Deactivate previously playing notes that are not the current one
        this.playingNotes.forEach((_note, id) => { // Changed 'note' to '_note' as it's unused
            if (id !== noteId) {
                const g = this.mainSVG.querySelector(`g[data-id="${id}"]`) as SVGGElement | null;
                if (g) {
                    resetElementHighlight(g, this.config.noteColor);
                }
                this.playingNotes.delete(id);
            }
        });

        // Activate the current note
        if (!this.playingNotes.has(noteId)) {
             const g = this.mainSVG.querySelector(`g[data-id="${noteId}"]`) as SVGGElement | null;
             if (g) {
                highlightElement(g, this.config.activeNoteColor);
                this.playingNotes.set(noteId, activeNote);

                 // Calculate position for scrolling
                 const noteRect = g.getBoundingClientRect();
                 const svgRect = this.mainSVG.getBoundingClientRect();
                 // Position relative to the *scrollable parent's* coordinate system
                  activeNotePosition = noteRect.left - svgRect.left + this.parentElement.scrollLeft;


                 // Handle scrolling
                 const isMeasureStart = g.hasAttribute('data-is-measure-start');
                 if (scrollIntoView && (this.config.scrollType !== ScrollType.BAR || isMeasureStart)) {
                     this.scrollIntoViewIfNeeded(activeNotePosition);
                 }
             }
        }
         // Signature blinking (only in proportional mode)
         if (!isCompact && this.signaturesBlinking) {
            // Logic to stop blinking if playback moves past signature area
            // Determine signature area width (e.g., from overlayG bounds)
             const overlayRect = this.overlayG.getBoundingClientRect();
             const signatureWidthPixels = overlayRect.width;
             // Convert note start time to pixels
              const noteTimePixels = this.jianpuModel.measuresInfo.quartersToTime(activeNote.start, activeNote.start) * this.config.pixelsPerTimeStep;
             if (noteTimePixels > signatureWidthPixels) {
                  this.signaturesBlinking = false;
                  setBlinkAnimation(this.overlayG, false);
             }
         }

    }
    // --- Incremental Redrawing ---
    else {
        this.jianpuModel.update(this.jianpuInfo, this.config.defaultKey); // Ensure model is up-to-date

        let currentX = this.width; // Start drawing from the end of previous content
        let contentWidth = this.width;
        let maxHeight = this.height > 0 ? this.height - this.yBaseline : this.config.noteHeight * 3; // Max extent below baseline
        let minHeight = 0; // Max extent above baseline (negative y)

        const linkedNoteMap: LinkedNoteMap = new Map(); // For ties across blocks

        this.jianpuModel.jianpuBlockMap.forEach((block, startTimeQ) => {
            // Check if block start time is >= last rendered quarter note time
            // Use a small tolerance for floating point comparisons
            if (startTimeQ >= this.lastRenderedQ - 1e-9) { // Draw new or overlapping blocks
                 if (isCompact) {
                     // In compact mode, currentX advances with each drawn element
                     currentX = contentWidth; // Position determined by previous element's width
                 } else {
                     // In proportional mode, x is determined by time
                     currentX = this.jianpuModel.measuresInfo.quartersToTime(startTimeQ, startTimeQ) * this.config.pixelsPerTimeStep;
                 }

                const blockWidth = this.drawJianpuBlock(block, currentX, linkedNoteMap);

                if (isCompact) {
                     contentWidth += blockWidth; // Accumulate width in compact mode
                } else {
                    // Proportional mode width is determined by the latest time
                     contentWidth = Math.max(contentWidth, currentX + blockWidth);
                }

                // Track vertical bounds - Use getBBox for SVG coordinate space bounds
                 const blockG = this.mainSVG.querySelector(`g[data-block-start="${block.start}"]`) as SVGGElement | null; // Use block.start for selector
                  if (blockG) {
                       try {
                           const blockBox = blockG.getBBox(); // Use getBBox
                           // Bounds are relative to the element's coordinate system
                           // which is already transformed by mainG's baseline offset.
                           const topY = blockBox.y;
                           const bottomY = blockBox.y + blockBox.height;
                           minHeight = Math.min(minHeight, topY);
                           maxHeight = Math.max(maxHeight, bottomY);
                       } catch (e) {
                           // Ignore getBBox error if element is not rendered (display:none)
                           // or has no graphical content yet.
                       }
                  }

                // Update last rendered Q *after* processing the block fully
                this.lastRenderedQ = startTimeQ + block.length; // Move marker to the end of the block
            }
        });

        // Update overall layout based on new content bounds
        this.height = Math.max(this.height, (maxHeight - minHeight) + this.config.noteHeight); // Add buffer
        this.updateLayout(contentWidth);
    }

    return activeNotePosition;
  }

  /**
   * Draws a single JianpuBlock (notes or rest) at the specified x-position.
   * @param block The JianpuBlock to draw.
   * @param x The horizontal starting position.
   * @param linkedNoteMap Map for handling ties.
   * @returns The calculated width of the drawn block.
   */
   private drawJianpuBlock(
       block: JianpuBlock,
       x: number,
       linkedNoteMap: LinkedNoteMap
   ): number {
    
       let blockWidth = 0;
       const isCompact = this.config.pixelsPerTimeStep <= 0;
       const isMeasureStart = block.isMeasureBeginning();
       const blockGroup = createSVGGroupChild(this.musicG, `block-${block.start}`);
       blockGroup.setAttribute('data-block-start', `${block.start}`); // For later lookup

       // --- 1. Draw Bar Line (if needed) ---
       // Bar lines are drawn *before* the block they precede.
       if (isMeasureStart && block.start > 1e-6) { // Don't draw bar at time 0
           const barX = x - (isCompact ? this.estimatedNoteWidth * 0.6 : 4); // Position slightly before block
           // Adjust bar height based on estimated content height or fixed value
           const barHeight = this.config.noteHeight * 2; // Example height
           const barY = 0; // Center bar vertically around baseline
           const bar = drawSVGPath(this.musicG, barPath, barX, barY, 1, barHeight / PATH_SCALE); // Scale bar path (height 100)
           setStroke(bar, this.config.noteColor, LINE_STROKE_WIDTH);
           if (isCompact) {
                blockWidth += LINE_STROKE_WIDTH; // Add bar width if compact
           }
       }


       // --- 2. Draw Signatures (if changed, in-line only) ---
       // Overlay handles the *current* signature. This draws changes *within* the score flow.
       const keyChanged = this.updateCurrentKey(block.start);
       const timeChanged = this.updateCurrentTimeSignature(block.start);
       let signatureWidth = 0;
       if ((keyChanged || timeChanged) && block.start > 1e-6) {
            // Draw the new signature(s) in the signaturesG (scrollable part)
            const sigX = x + blockWidth; // Position it after potential bar line
            signatureWidth = this.drawSignatures(this.signaturesG, sigX, keyChanged, timeChanged);
            if (isCompact) {
                 blockWidth += signatureWidth + this.estimatedNoteWidth * 0.2; // Add width and spacing
            }
       }


       // --- 3. Draw Notes or Rest ---
       const contentX = x + blockWidth; // Adjust starting X based on preceding elements
       let contentWidth = 0;
       if (block.notes.length > 0) {
           contentWidth = this.drawNotes(block, contentX, linkedNoteMap, blockGroup);
       } else if (block.length > 1e-6) { // Only draw rest if it has duration
           // It's a rest block
           contentWidth = this.drawRest(block, contentX, blockGroup);
       }


       // --- 4. Calculate Total Width ---
        if (isCompact) {
            // Total width is accumulated width of bar, signature, and content
            blockWidth += contentWidth;
            
            // Adjust spacing based on block duration for compact mode
            let gap = this.estimatedNoteWidth * this.config.noteSpacingFactor;
            // block.length is in quarter notes.
            // e.g., 64th note: 0.0625; 32nd note: 0.125; 16th note: 0.25; 8th note: 0.5; quarter note: 1.0
            if ( block.beatEnd) {
                gap *= 1.0; // Longer spacing for beat start
            } else if (block.length < 0.0625) { // 对于 64 分音符或更短的音符
                gap *= 0.05; // 极小的间距
            } else if (block.length < 0.125) { // 对于 32 分音符
                gap *= 0.1; // 非常小的间距
            } else if (block.length < 0.25) { // 对于 16 分音符
                gap *= 0.2; // 小间距
            } else if (block.length < 0.5) { // 对于 8 分音符
                gap *= 0.4;  // 半间距
            } else if (block.length < 1.0) { // 对于 4 分音符
                gap *= 0.5;  // 中等间距
            }
            
            // For quarter notes (length 1.0) or longer, the full gap is used.
            blockWidth += gap;
           

        } else {
            // Proportional mode: width is determined by the maximum extent of elements at this time
             blockWidth = Math.max(signatureWidth, contentWidth);
        }

        // --- 更新结束小节线判断
        const isFinalBlock = this.jianpuModel.isLastMeasureAtQ(block.start + block.length);
        if (isFinalBlock) {
            const barX = x + blockWidth;
            const barHeight = this.config.noteHeight * 2;
            const barY = 0;
            const bar = drawSVGPath(this.musicG, barPath, barX, barY, 1, barHeight / PATH_SCALE);
            setStroke(bar, this.config.noteColor, LINE_STROKE_WIDTH);
            if (isCompact) {
                blockWidth += LINE_STROKE_WIDTH;
            }
        }

       return blockWidth; // Return the width *occupied* by this block's drawing operations
   }

 /**
 * Draws the notes within a JianpuBlock.
 * @param block The block containing notes.
 * @param x The starting x position for drawing this block's content.
 * @param linkedNoteMap Map for handling ties.
 * @param blockGroup The parent SVG group for this block.
 * @returns The horizontal space occupied by the notes (excluding final padding).
 */
private drawNotes(
    block: JianpuBlock,
    x: number,
    linkedNoteMap: LinkedNoteMap,
    blockGroup: SVGGElement
): number {
    let currentX = x;
    let maxX = x; // Track the rightmost edge
    const noteSpacing = this.estimatedNoteWidth * 0.1; // Small spacing between elements
    const FONT_SIZE = `${this.numberFontSize}px`;
    const SMALL_FONT_SIZE = `${this.smallFontSize}px`;

    const { durationLines = 0, augmentationDots = 0, augmentationDash = false } = block;


    // Draw notes (potentially a chord)
    block.notes.forEach((note) => { // Removed index as it wasn't used
        const noteId = `${note.start}-${note.pitch}`;
        // Group for individual note allows highlighting and tie linking
        const noteG = createSVGGroupChild(blockGroup, noteId);
        if (block.isMeasureBeginning()) {
             noteG.setAttribute('data-is-measure-start', 'true'); // Mark for scrolling
        }

        let noteStartX = currentX; // Reset start X for each element relative to block start 'x'
        let noteEndX = noteStartX; // Track right edge of elements for this note

        // --- Accidental ---
        if (note.accidental !== 0) {
            const accText = ACCIDENTAL_TEXT[note.accidental];
            // Position accidental slightly before the number
            drawSVGText(noteG, accText, noteStartX + noteSpacing, 0, SMALL_FONT_SIZE, 'normal', 'end', 'text-top', this.config.noteColor);
            // We don't advance noteStartX here, accidental sits to the left
            // We do need its width to potentially adjust overall block spacing later if needed.
            //let accWidth = acc.getBBox().width;

        }

        let noteWidth = 0;
        // 如果 augmentationDash 为 true 则画 '-'，否则画音符数字
        if (augmentationDash) {
           // Let's assume AUGMENTATION_DASH_FACTOR determines the width relative to noteHeight
           // Make sure AUGMENTATION_DASH_FACTOR is defined and provides a sensible width multiplier (e.g., 0.5, 1.0)
           const dashWidth = this.config.noteHeight * AUGMENTATION_DASH_FACTOR; // Desired visual length

           // 2. Calculate the horizontal scale needed for the base path ('h 50')
           const pathOriginalWidth = 50; // Width defined in augmentationDashPath
           const dashScaleX = dashWidth / pathOriginalWidth;

           // 3. Draw the path element. Set vertical scale to 1 (it's irrelevant for stroke thickness).
           const dash = drawSVGPath(noteG, augmentationDashPath, noteStartX, 0, dashScaleX, 1);

           // 4. Apply stroke for visibility and thickness
           //    Use the calculated dashThickness for stroke-width
           setStroke(dash, this.config.noteColor, LINE_STROKE_WIDTH);

           // 5. Use the calculated dashWidth for layout purposes
           noteWidth = dashWidth; // Use the intended width, not getBBox which might not account for stroke

           noteEndX = noteStartX + noteWidth; // Update right edge

        } else {

            const numText = `${note.jianpuNumber}`;
            const num = drawSVGText(noteG, numText, noteStartX, 0, FONT_SIZE, 'normal', 'start', 'middle', this.config.noteColor);
            noteWidth = num.getBBox().width;
            noteEndX = noteStartX + noteWidth; // Number defines the main body width for now
          
        }


        // --- Octave Dots ---

        if (note.octaveDot !== 0 && augmentationDash === false) {
            const dotSize = this.config.noteHeight * DOT_SIZE_FACTOR;
            const dotScale = dotSize / (PATH_SCALE * 0.15);
            const dotX = noteStartX + noteWidth / 2;
            // 修改点间距计算，增加垂直间距
            const dotSpacing = dotSize * 2.8; // 增加点之间的间距
            const baseOffset = this.config.noteHeight * OCTAVE_DOT_OFFSET_FACTOR;
            
            for (let i = 0; i < Math.abs(note.octaveDot); i++) {
                // 使用绝对坐标而非相对坐标
                const y = (note.octaveDot > 0 ? -baseOffset : baseOffset*0.6) - (i * dotSpacing * (note.octaveDot > 0 ? 1 : -1) ); // Adjusted y calculation
                drawSVGPath(noteG, dotPath, dotX, y, dotScale, dotScale);
            }
        }


        // --- Duration Underlines ---
        if (durationLines > 0) {
            const lineYOffset = this.config.noteHeight * UNDERLINE_SPACING_FACTOR * 2.5;
            const lineSpacing = this.config.noteHeight * UNDERLINE_SPACING_FACTOR;
            const lineWidthScale = noteWidth / PATH_SCALE * (DURATION_LINE_SCALES.get(durationLines) ?? 1);
            
            for (let lineIndex = 0; lineIndex < durationLines; lineIndex++) {
                const yPosition = lineYOffset + lineIndex * lineSpacing;
                const durationLine = drawSVGPath(noteG, underlinePath, noteStartX, yPosition, lineWidthScale, 1);
                setStroke(durationLine, this.config.noteColor, LINE_STROKE_WIDTH);
            }
        }


        // --- Augmentation Dots ---
         let augmentationX = noteEndX + noteSpacing; // Position after the number

         if (augmentationDots > 0) { // Dots only if no dash
            const dotSize = this.config.noteHeight * DOT_SIZE_FACTOR;
            const dotScale = dotSize / (PATH_SCALE * 0.15);
             for (let i = 0; i < augmentationDots; i++) {
                 // Draw relative to noteG origin
                 drawSVGPath(noteG, dotPath, augmentationX, 0, dotScale, dotScale);
                 augmentationX += dotSize + noteSpacing;
             }
             noteEndX = augmentationX + noteSpacing;
         }


        // --- Ties ---

        const noteLogicalEndPositionX = noteEndX;
        if (note.tiedTo && !augmentationDash) {
            // 存储当前note信息，等待后续绘制
            linkedNoteMap.set(note, { g: noteG, xNoteRight: noteLogicalEndPositionX, yNoteBaseline: 0 });
        } else if (note.tiedFrom) {
            // 递归查找链接的第一个note
            let firstNote = note.tiedFrom;
            while (firstNote.tiedFrom) {
                firstNote = firstNote.tiedFrom;
            }
            
            const prevLink = linkedNoteMap.get(firstNote);
            if (prevLink) {
                const tieStartX = prevLink.xNoteRight * 1.0;
                //const tieEndX = noteStartX - noteSpacing;
                const tieEndX = augmentationDash ? 
                (noteStartX - this.estimatedNoteWidth * 2.2) :
                (noteStartX - noteSpacing);


                const tieWidth = tieEndX - tieStartX;


                const tieY = - this.config.noteHeight * 1.2;
                const tieScaleX = tieWidth / PATH_SCALE * 1.3;
                const tieScaleY = (this.config.noteHeight / PATH_SCALE) * 1.6;

                if (tieWidth > 1) {
                    // 从第一个note到当前note绘制tie
                    drawSVGPath(prevLink.g, tiePath,
                                tieStartX - (prevLink.g.getCTM()?.e ?? 0),
                                tieY, tieScaleX, tieScaleY);
                }
                // 清除整个链接链的缓存
                let current = firstNote;
                while (current && current !== note) {
                    linkedNoteMap.delete(current);
                    const nextNote = current.tiedTo;
                    if (nextNote) {
                        current = nextNote;
                    }
                }
            } else {
                console.warn("Missing linked SVG details for first tied note:", firstNote);
            }
        }



         maxX = Math.max(maxX, noteEndX); // Update the overall rightmost edge relative to block start 'x'

    }); // End forEach note

    return maxX - x; // Return the width of the content drawn
}


/**
 * Draws a rest symbol for a JianpuBlock.
 * @param block The rest block.
 * @param x The starting x position.
 * @param blockGroup The parent SVG group.
 * @returns The horizontal space occupied by the rest (excluding final padding).
 */
private drawRest(block: JianpuBlock, x: number, blockGroup: SVGGElement): number {
    const FONT_SIZE = `${this.numberFontSize}px`;
    const noteSpacing = this.estimatedNoteWidth * 0.1;

    const { durationLines = 0, augmentationDots = 0} = block;
    let currentX = x; // Position relative to block start
    let noteEndX = currentX; // Track right edge

    // --- Rest Symbol ('0') ---
    const restSymbol = '0';
    const restText = drawSVGText(blockGroup, restSymbol, currentX, 0, FONT_SIZE, 'normal', 'start', 'middle', this.config.noteColor);
    const restWidth = restText.getBBox().width;
    noteEndX = currentX + restWidth;

     // --- Duration Underlines ---
    if (durationLines > 0) {
        const lineYOffset = this.config.noteHeight * UNDERLINE_SPACING_FACTOR * 2.5;
        const lineSpacing = this.config.noteHeight * UNDERLINE_SPACING_FACTOR;
        const lineWidthScale = restWidth / PATH_SCALE * (DURATION_LINE_SCALES.get(durationLines) ?? 1);
        
        for (let lineIndex = 0; lineIndex < durationLines; lineIndex++) {
            const yPosition = lineYOffset + lineIndex * lineSpacing;
            const durationLine = drawSVGPath(blockGroup, underlinePath, currentX, yPosition, lineWidthScale, 1);
            setStroke(durationLine, this.config.noteColor, LINE_STROKE_WIDTH);
        }
    }

    // --- Augmentation Dots ---
    let augmentationX = noteEndX + noteSpacing; // Position after the number

    if (augmentationDots > 0) { // Dots only if no dash
        const dotSize = this.config.noteHeight * DOT_SIZE_FACTOR;
        const dotScale = dotSize / (PATH_SCALE * 0.15);
        for (let i = 0; i < augmentationDots; i++) {
            // Draw relative to noteG origin
            drawSVGPath(blockGroup, dotPath, augmentationX, 0, dotScale, dotScale);
            augmentationX += dotSize + noteSpacing;
        }
        noteEndX = augmentationX + noteSpacing;
    }

    return noteEndX - x; // Return the width of the content drawn
}


  /**
   * Draws Key and/or Time signatures.
   * @param container The SVG group to draw into (overlayG or signaturesG). **Must be SVGGElement.**
   * @param x The starting x position.
   * @param drawKey Draw the key signature (1=X).
   * @param drawTime Draw the time signature (X/Y).
   * @returns The width of the drawn signatures.
   */
   private drawSignatures(
       container: SVGGElement,
       x: number,
       drawKey: boolean,
       drawTime: boolean
   ): number {
       let currentX = x;
       const spacing = this.estimatedNoteWidth * 0.3; // Spacing between elements
       const timeFontSize = `${this.smallFontSize}px`;
       const keyFontSize = `${this.numberFontSize}px`; // Key sig slightly larger

       // --- Key Signature (e.g., 1=C) ---
       if (drawKey) {
           const keyName = PITCH_CLASS_NAMES[this.currentKey % 12] ?? 'C';
           const keyText = `1=${keyName}`;
           const keySig = drawSVGText(container, keyText, currentX, 0, keyFontSize, 'normal', 'start', 'middle', this.config.noteColor);
           currentX += keySig.getBBox().width + spacing * 2; // More space after key sig
       }

       // --- Time Signature (e.g., 4/4) ---
       if (drawTime) {
            const timeStr = `${this.currentTimeSignature.numerator}/${this.currentTimeSignature.denominator}`;
            const timeSig = drawSVGText(
                container, 
                timeStr, 
                currentX, 
                0,  // 保持与基线对齐
                timeFontSize, 
                'normal', 
                'start', 
                'middle',  // 垂直居中
                this.config.noteColor
            );
            currentX += timeSig.getBBox().width + spacing;
       }

       const totalWidth = currentX - x;

       // Update vertical bounds based on signature height
       // Use try-catch as getBBox can fail if element is not rendered
       try {
           const bounds = container.getBBox();
           const minY = bounds.y; // Relative to baseline
           const maxY = bounds.y + bounds.height;
           // Calculate required total height based on baseline and bounds
           const requiredHeight = Math.max(this.yBaseline + maxY, this.yBaseline - minY) + this.config.noteHeight * 0.5; // Add buffer
           this.height = Math.max(this.height, requiredHeight);
       } catch(e) {
           // Ignore error
       }


       // --- Blinking Logic (Overlay Only) ---
        if (container === this.overlayG && this.config.pixelsPerTimeStep > 0) {
             this.signaturesBlinking = true;
             setBlinkAnimation(this.overlayG, true);
        }


       return totalWidth;
   }

  /** Updates the current key if changed at the given time */
  private updateCurrentKey(timeQ: number): boolean {
      const newKey = this.jianpuModel.measuresInfo.keySignatureAtQ(timeQ, true); // Check for exact change
      if (newKey !== -1 && newKey !== this.currentKey) {
          this.currentKey = newKey;
          return true;
      }
      return false;
  }

  /** Updates the current time signature if changed at the given time */
  private updateCurrentTimeSignature(timeQ: number): boolean {
      const newTimeSig = this.jianpuModel.measuresInfo.timeSignatureAtQ(timeQ, true); // Check for exact change
      if (newTimeSig && (newTimeSig.numerator !== this.currentTimeSignature.numerator ||
                         newTimeSig.denominator !== this.currentTimeSignature.denominator))
      {
          this.currentTimeSignature = newTimeSig;
          return true;
      }
      return false;
  }

  /** Handles scroll events to update the fixed signature overlay */
  private handleScrollEvent = (_event: Event) => {
    this.lastKnownScrollLeft = this.parentElement.scrollLeft;
    if (!this.isScrolling) {
      window.requestAnimationFrame(() => {
        this.updateOverlaySignaturesForScroll(this.lastKnownScrollLeft);
        this.isScrolling = false;
      });
    }
    this.isScrolling = true;
  };

  /** Scrolls the container to bring the active note into view */
  private scrollIntoViewIfNeeded(activeNotePosition: number) {
      const containerWidth = this.parentElement.getBoundingClientRect().width;
      const currentScroll = this.parentElement.scrollLeft;
      let targetScroll = currentScroll;

      if (this.config.scrollType === ScrollType.PAGE) {
          const scrollMargin = 20; // Margin from edge
          if (activeNotePosition < currentScroll + scrollMargin) {
              // Note is off the left edge
              targetScroll = activeNotePosition - scrollMargin;
          } else if (activeNotePosition > currentScroll + containerWidth - scrollMargin) {
              // Note is off the right edge
              targetScroll = activeNotePosition - containerWidth + scrollMargin;
          }
      } else { // NOTE or BAR scrolling (center the note/bar start)
          const centerOffset = containerWidth * 0.5;
          targetScroll = activeNotePosition - centerOffset;
      }

      // Clamp scroll position to valid range
      targetScroll = Math.max(0, Math.min(targetScroll, this.parentElement.scrollWidth - containerWidth));

      if (Math.abs(targetScroll - currentScroll) > 1) { // Only scroll if needed
          this.parentElement.scrollTo({
              left: targetScroll,
              behavior: 'smooth' // Use smooth scrolling
          });
           // Manually update overlay after scroll starts, as scroll event might lag
           this.updateOverlaySignaturesForScroll(targetScroll);
      }
  }

  /** Helper to update overlay based on a target scroll position */
   private updateOverlaySignaturesForScroll(scrollLeft: number) {
        const scrolledTimeQ = this.pixelsToTime(scrollLeft);
        const keyAtScroll = this.jianpuModel.measuresInfo.keySignatureAtQ(scrolledTimeQ);
        const timeSigAtScroll = this.jianpuModel.measuresInfo.timeSignatureAtQ(scrolledTimeQ) ?? this.currentTimeSignature;

        let needsRedraw = false;
        if (keyAtScroll !== this.currentKey) {
            this.currentKey = keyAtScroll;
            needsRedraw = true;
        }
         if (timeSigAtScroll.numerator !== this.currentTimeSignature.numerator ||
             timeSigAtScroll.denominator !== this.currentTimeSignature.denominator) {
             this.currentTimeSignature = timeSigAtScroll;
             needsRedraw = true;
         }

        if (needsRedraw) {
            while (this.overlayG.lastChild) this.overlayG.removeChild(this.overlayG.lastChild);
            this.drawSignatures(this.overlayG, 0, true, true);
            // Blinking logic on scroll update
             if (scrollLeft < 10 && this.config.pixelsPerTimeStep > 0) {
                  setBlinkAnimation(this.overlayG, true); this.signaturesBlinking = true;
              } else if (this.config.pixelsPerTimeStep > 0) {
                  setBlinkAnimation(this.overlayG, false); this.signaturesBlinking = false;
              }
        }
   }


  /** Converts a pixel position to a time in quarter notes (proportional mode only) */
  private pixelsToTime(pixels: number): number {
      if (this.config.pixelsPerTimeStep <= 0) return 0; // Not applicable in compact mode
      // Use start time 0 for tempo context for general scroll position
      return this.jianpuModel.measuresInfo.timeToQuarters(pixels / this.config.pixelsPerTimeStep, 0);
  }

}