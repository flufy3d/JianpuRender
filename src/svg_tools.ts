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

 /** SVG NameSpace string */
 export const SVGNS = 'http://www.w3.org/2000/svg';

 /**
  * Draws a SVG path on a SVG container element
  * @param e The SVG container element
  * @param path The SVG path string ('d' attribute)
  * @param x Horizontal position relative to container origin
  * @param y Vertical position relative to container origin
  * @param scaleX Horizontal scale factor
  * @param scaleY Vertical scale factor
  * @param opacity Opacity (0 to 1)
  * @returns The drawn SVG path element
  */
 export function drawSVGPath(
   e: SVGElement, path: string, x: number, y: number,
   scaleX: number, scaleY: number, opacity = 1
 ): SVGPathElement  {
   const child = document.createElementNS(SVGNS, 'path');
   child.setAttributeNS(null, 'd', path);
   child.setAttributeNS(
     null, 'transform', `translate(${x}, ${y}) scale(${scaleX}, ${scaleY})`
   );
   if (opacity < 1) {
       child.setAttributeNS(null, 'opacity', `${opacity}`);
   }
   e.appendChild(child);
   return child;
 }
 
 /**
  * Draws SVG text on a SVG container element
  * @param e The SVG container element
  * @param text The text content
  * @param x Horizontal position (anchor depends on text-anchor)
  * @param y Vertical position (anchor depends on dominant-baseline)
  * @param fontSize Font size (e.g., '16px')
  * @param fontWeight Font weight ('normal', 'bold')
  * @param textAnchor Horizontal alignment ('start', 'middle', 'end')
  * @param dominantBaseline Vertical alignment ('middle', 'hanging', 'central', 'mathematical', 'text-bottom', 'text-top')
  * @param fill Text color
  * @param opacity Opacity (0 to 1)
  * @returns The drawn SVG text element
  */
 export function drawSVGText(
   e: SVGElement, text: string, x: number, y: number,
   fontSize: string, fontWeight = 'normal',
   textAnchor: 'start' | 'middle' | 'end' = 'middle',
   dominantBaseline: string = 'middle', // Use string for broader SVG values
   fill = 'currentColor', // Default to inheriting color
   opacity = 1
 ): SVGTextElement { // Return SVGTextElement specifically
   const child = document.createElementNS(SVGNS, 'text');
   child.setAttributeNS(null, 'font-family', 'sans-serif'); // Simple default
   child.setAttributeNS(null, 'font-size', fontSize);
   child.setAttributeNS(null, 'font-weight', fontWeight);
   child.setAttributeNS(null, 'x', `${x}`);
   child.setAttributeNS(null, 'y', `${y}`);
   child.setAttributeNS(null, 'text-anchor', textAnchor);
   child.setAttributeNS(null, 'dominant-baseline', dominantBaseline);
    if (fill !== 'currentColor') {
       child.setAttributeNS(null, 'fill', fill);
   }
    if (opacity < 1) {
       child.setAttributeNS(null, 'opacity', `${opacity}`);
   }
 
   const textNode = document.createTextNode(text);
   child.appendChild(textNode);
   e.appendChild(child);
   return child;
 }
 
 /**
  * Creates a SVG group ('g') element and appends it to a parent.
  * @param parent The parent SVG element
  * @param id Optional data-id attribute for identification
  * @returns The created SVG group element
  */
 export function createSVGGroupChild(parent: SVGElement, id?: string): SVGGElement { // Return SVGGElement
   const child = document.createElementNS(SVGNS, 'g');
   if (id) {
     child.setAttribute('data-id', id);
   }
   parent.appendChild(child);
   return child;
 }
 
/**
 * Sets a simple blinking (opacity fade in/out) animation on an element.
 * @param e The SVG element to animate
 * @param enable Enable or disable the animation
 * @param duration Animation duration (e.g., '2s')
 * @returns The modified SVG element
 */
export function setBlinkAnimation(
  e: SVGElement, enable = true, duration = '1s'
): SVGElement {
  // Try to find an existing <animate> child controlling opacity
  let animation = e.querySelector(
    'animate[attributeName="opacity"]'
  ) as SVGAnimateElement | null;

  if (enable) {
    if (!animation) {
      // Create a new <animate> if missing
      animation = document.createElementNS(SVGNS, 'animate');
      animation.setAttributeNS(null, 'attributeName', 'opacity');
      animation.setAttributeNS(null, 'values', '1;0.2;1');
      animation.setAttributeNS(null, 'keyTimes', '0;0.5;1');
      animation.setAttributeNS(null, 'dur', duration);
      animation.setAttributeNS(null, 'repeatCount', 'indefinite');
      e.appendChild(animation);
    } else {
      // Resume animation by resetting repeatCount and restarting
      // Use beginElement() instead of unpauseAnimations()
      animation.setAttributeNS(null, 'repeatCount', 'indefinite');
      animation.beginElement(); // Restart the SMIL animation
    }
  } else {
    if (animation) {
      // Stop the animation by ending it and preventing repeats
      // Use endElement() instead of pauseAnimations()
      animation.endElement();
      animation.setAttributeNS(null, 'repeatCount', '0');
      // Ensure the element stays fully visible
      e.style.opacity = '1';
    }
    // Also reset inline opacity in case animation element was removed
    e.style.opacity = '1';
  }

  return e;
}

 
 /**
  * Sets the fill color of an SVG element.
  * @param e The SVG element
  * @param color The CSS color string
  */
 export function setFill(e: SVGElement, color: string) {
   e.setAttributeNS(null, 'fill', color);
 }
 
 /**
  * Sets the stroke color and width of an SVG element.
  * @param e The SVG element
  * @param color The CSS color string
  * @param strokeWidth The stroke width in pixels
  */
 export function setStroke(e: SVGElement, color: string, strokeWidth: number) {
   e.setAttributeNS(null, 'stroke', color);
   e.setAttributeNS(null, 'stroke-width', `${strokeWidth}`);
 }
 
 /**
  * Highlights an element by changing its fill color.
  * Often used for active notes.
  * @param e The SVG element (typically a group containing note parts)
  * @param color The highlight color
  */
 export function highlightElement(e: SVGElement, color: string) {
  // Gather both the element itself (if it matches) and its descendants
  const toHighlight: SVGElement[] = [];

  // If the element itself is a <text> or <path>, include it
  if (e.matches('text, path')) {
    toHighlight.push(e);
  }

  // Also include any descendant <text> or <path>
  e.querySelectorAll<SVGElement>('text, path').forEach(el => {
    toHighlight.push(el);
  });

  // Apply the fill color
  toHighlight.forEach(child => {
    // Skip elements with fill="none"
    if (child.getAttribute('fill') !== 'none') {
      child.setAttribute('fill', color);
    }
  });

  return e;
}

 
 /**
  * Resets the highlight of an element, reverting to a default color.
  * @param e The SVG element (typically a group)
  * @param defaultColor The color to revert to
  */
 export function resetElementHighlight(e: SVGElement, defaultColor: string) {
      const children = e.querySelectorAll('text, path');
      children.forEach((child: SVGElement) => {
          if (child.getAttribute('fill') !== 'none') {
              child.setAttribute('fill', defaultColor);
          }
         // Reset stroke if it was highlighted
         // child.setAttribute('stroke', defaultColor);
      });
      // Reset group fill if it was set directly
     // e.setAttribute('fill', defaultColor);
 }