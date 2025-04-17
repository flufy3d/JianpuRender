import { 
    drawSVGPath, 
    drawSVGText, 
    createSVGGroupChild, 
    setFade,
    setFill,
    setStroke,
    highlightElement
} from '../src/svg_tools';
import * as svgPaths from '../src/svg_paths';

// 创建测试容器
const demoContainer = document.getElementById('demo-container')!;

// 创建SVG画布
const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
svg.setAttribute('width', '100%');
svg.setAttribute('height', '100%');
svg.setAttribute('viewBox', '0 0 500 300');

// 创建测试用例容器
const testDiv = document.createElement('div');
testDiv.className = 'test-case';
testDiv.innerHTML = `
    <div class="svg-container"></div>
    <div class="controls">
        <button id="test-path">测试路径绘制</button>
        <button id="test-text">测试文本绘制</button>
        <button id="test-group">测试分组</button>
        <button id="test-fade">测试淡入淡出</button>
        <button id="test-fill">测试填充</button>
        <button id="test-stroke">测试描边</button>
        <button id="test-highlight">测试高亮</button>
    </div>
`;
demoContainer.appendChild(testDiv);

// 获取SVG容器和按钮
const svgContainer = testDiv.querySelector('.svg-container')!;
svgContainer.appendChild(svg);

// 测试函数
function testPathDrawing() {
    svg.innerHTML = '';
    
    // 绘制各种路径
    drawSVGPath(svg, svgPaths.MyPath, 50, 150, 0.3, 0.3);

}

function testTextDrawing() {
    svg.innerHTML = '';
    
    // 绘制不同文本
    drawSVGText(svg, '普通文本', 50, 50, '20px');
    drawSVGText(svg, '粗体文本', 50, 100, '20px', true);
    drawSVGText(svg, '缩放文本', 50, 150, '20px', false, 1.5, 1.5);
    
    // 设置不同样式
    setFill(svg.children[0] as SVGElement, 'black');
    setStroke(svg.children[1] as SVGElement, 1, 'red');
    highlightElement(svg.children[2] as SVGElement, 'blue');
}

function testGroup() {
    svg.innerHTML = '';
    
    // 创建分组
    const group1 = createSVGGroupChild(svg, 'group1');
    const group2 = createSVGGroupChild(svg, 'group2');
    
    // 在不同分组中绘制元素
    drawSVGPath(group1, svgPaths.staffLinePath, 50, 50, 1, 1);
    drawSVGPath(group2, svgPaths.extraLinePath, 50, 100, 1, 1);
    
    // 设置分组样式
    highlightElement(group1, 'purple');
    setStroke(group2, 2, 'orange');
}

function testFade() {
    svg.innerHTML = '';
    
    // 绘制元素并设置淡入淡出
    const path = drawSVGPath(svg, svgPaths.CLEF_PATHS[71], 200, 150, 0.3, 0.3);
    
    setFade(path, true);

}

function testFill() {
    svg.innerHTML = '';
    
    // 绘制元素并设置填充
    const path = drawSVGPath(svg, svgPaths.CLEF_PATHS[71], 200, 150, 0.3, 0.3);
    const text = drawSVGText(svg, '填充测试', 50, 100, '20px');
    
    setFill(path, 'red');
    setFill(text, 'blue');
}

function testStroke() {
    svg.innerHTML = '';
    
    // 绘制元素并设置描边
    const path = drawSVGPath(svg, svgPaths.staffLinePath, 50, 50, 1, 1);
    const text = drawSVGText(svg, '描边测试', 50, 100, '20px');
    
    setStroke(path, 5, 'green');
    setStroke(text, 2, 'purple');
}

function testHighlight() {
    svg.innerHTML = '';
    
    // 绘制元素并设置高亮
    const path = drawSVGPath(svg, svgPaths.staffLinePath, 50, 50, 1, 1);
    const text = drawSVGText(svg, '高亮测试', 50, 100, '20px');
    
    highlightElement(path, 'orange');
    highlightElement(text, 'pink');
}

// 添加按钮事件
document.getElementById('test-path')!.addEventListener('click', testPathDrawing);
document.getElementById('test-text')!.addEventListener('click', testTextDrawing);
document.getElementById('test-group')!.addEventListener('click', testGroup);
document.getElementById('test-fade')!.addEventListener('click', testFade);
document.getElementById('test-fill')!.addEventListener('click', testFill);
document.getElementById('test-stroke')!.addEventListener('click', testStroke);
document.getElementById('test-highlight')!.addEventListener('click', testHighlight);

// 初始显示路径测试
testPathDrawing();