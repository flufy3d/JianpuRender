import { testData } from '../test/basic_symbols_features';
import { JianpuSVGRender } from '../src/index';
import { highlightElement, resetElementHighlight } from '../src/svg_tools';

// Initialize container
const demoContainer = document.getElementById('demo-container')!;

// Render all test cases
testData.forEach((testCase, index) => {
  // Create case container
  const caseDiv = document.createElement('div');
  caseDiv.className = 'test-case';
  caseDiv.innerHTML = `
    <h3>${index + 1}. ${testCase.title}</h3>
    <p>${testCase.description}</p>
    <div class="jianpu-container" id="case-${index}"></div>
    <hr>
  `;
  demoContainer.appendChild(caseDiv);

  // Render notation; clicking a note flashes it orange for 600 ms
  const jianpuContainer = document.getElementById(`case-${index}`)! as HTMLDivElement;
  new JianpuSVGRender(testCase.data, {
    showBarNumbers: true,
    showTempoMarking: true,
    onNoteClick: (_note, el) => {
      highlightElement(el, 'orange');
      setTimeout(() => resetElementHighlight(el, 'black'), 600);
    },
  }, jianpuContainer);
});