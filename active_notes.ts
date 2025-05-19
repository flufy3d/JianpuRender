import { testData } from '../test/basic_symbols_features';
import { JianpuSVGRender } from '../src/index';

// Initialize container
const demoContainer = document.getElementById('demo-container')!;
const playBtn = document.getElementById('play-btn')!;
const stopBtn = document.getElementById('stop-btn')!;
const testCaseSelect = document.getElementById('test-case-select') as HTMLSelectElement;

let testCase = testData[0]; // 默认使用第一个测试用例
let renderer: JianpuSVGRender;
let jianpuContainer: HTMLDivElement;

function initRenderer() {
    if (jianpuContainer) {
        demoContainer.removeChild(jianpuContainer);
    }
    
    // 停止当前播放并重置状态
    if (animationId) {
        clearTimeout(animationId);
        animationId = 0;
    }
    if (audioCtx) {
        audioCtx.close();
        audioCtx = null;
    }
    
    jianpuContainer = document.createElement('div');
    jianpuContainer.className = 'jianpu-container';
    demoContainer.appendChild(jianpuContainer);
    
    const selectedIndex = parseInt(testCaseSelect.value);
    testCase = testData[selectedIndex];
    
    renderer = new JianpuSVGRender(testCase.data, {
        activeNoteColor: 'red'
    }, jianpuContainer);
    
    currentNoteIndex = 0;
    // 添加下面这行重新获取当前测试用例的音符数据
    notes = testCase.data.notes;
}

testCaseSelect.addEventListener('change', initRenderer);

// 初始化渲染器
initRenderer();
let currentNoteIndex = 0;
let animationId: number;

let notes = testCase.data.notes;

function playNextNote() {
    // 直接使用已更新的notes变量
    if (currentNoteIndex >= notes.length) {
        clearTimeout(animationId);
        animationId = 0;
        renderer.redraw(); // 清除所有高亮
        currentNoteIndex = 0;
        return;
    }
    
    const note = notes[currentNoteIndex];
    renderer.redraw(note, true);
    
    // 根据音符时值计算持续时间（四分音符=500ms）
    const duration = (note.length || 1) * 500;
    
    // 播放对应音高的声音
    if (note.pitch) {
        playTone(note.pitch, duration * 0.9); // 提前结束声音
    }
    
    currentNoteIndex++;
    animationId = setTimeout(playNextNote, duration);
}

// 添加简单的音频播放函数
let audioCtx: AudioContext; // 将audioCtx移到全局作用域

function playTone(pitch: number, duration: number) {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    // 将MIDI音高转换为频率 (A4 = 69 = 440Hz)
    const frequency = 440 * Math.pow(2, (pitch - 69) / 12);
    
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    gainNode.gain.value = 0.1;
    
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    oscillator.start();
    gainNode.gain.exponentialRampToValueAtTime(
        0.01, 
        audioCtx.currentTime + duration / 1000
    );
    oscillator.stop(audioCtx.currentTime + duration / 1000);
}

playBtn.addEventListener('click', () => {
    if (!animationId) {
        playNextNote();
    }
});

stopBtn.addEventListener('click', () => {
    if (animationId) {
        clearTimeout(animationId);
        animationId = 0;
    }
    renderer.redraw(); // 清除所有高亮
    currentNoteIndex = 0;
    if (audioCtx) {
        audioCtx.close(); // 停止时关闭音频上下文
        audioCtx = null;  // 重置audioCtx
    }
});