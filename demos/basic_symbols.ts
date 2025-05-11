import { testData } from '../test/basic_symbols_features';
import { JianpuSVGRender } from '../src/index';

// Initialize container
const demoContainer = document.getElementById('demo-container')!;

// Render all test cases
testData.forEach((testCase, index) => {
  if (index !== 6) {
    return;
  }
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

  // Render notation
  const jianpuContainer = document.getElementById(`case-${index}`)! as HTMLDivElement;
  new JianpuSVGRender(testCase.data, {}, jianpuContainer);
});