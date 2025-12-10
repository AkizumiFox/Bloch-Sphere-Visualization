import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ===== Configuration =====
const config = {
    arrow: {
        length: 1.05,
        headLength: 0.15,
        headWidth: 0.08,
        shaftRadius: 0.025,
        color: 0xf0a030
    },
    sphere: {
        darkWireColor: 0x3d444d,
        darkWireOpacity: 0.4,
        lightWireColor: 0x9ca3af,
        lightWireOpacity: 0.35,
        ringColor: 0x58a6ff,
        ringOpacity: 0.25
    },
    // Label colors matching axis colors
    labels: {
        z: { dark: '#58a6ff', light: '#0550ae' },  // |0⟩, |1⟩ - blue (Z axis)
        x: { dark: '#f85149', light: '#cf222e' },  // |+⟩ - red (X axis)
        y: { dark: '#3fb950', light: '#1a7f37' }   // |+i⟩ - green (Y axis)
    }
};

// ===== Pi Multiples for formatting =====
const piMultiples = [
    { val: 0, latex: '0' },
    { val: Math.PI / 6, latex: '\\frac{\\pi}{6}' },
    { val: Math.PI / 4, latex: '\\frac{\\pi}{4}' },
    { val: Math.PI / 3, latex: '\\frac{\\pi}{3}' },
    { val: Math.PI / 2, latex: '\\frac{\\pi}{2}' },
    { val: 2 * Math.PI / 3, latex: '\\frac{2\\pi}{3}' },
    { val: 3 * Math.PI / 4, latex: '\\frac{3\\pi}{4}' },
    { val: 5 * Math.PI / 6, latex: '\\frac{5\\pi}{6}' },
    { val: Math.PI, latex: '\\pi' },
    { val: 7 * Math.PI / 6, latex: '\\frac{7\\pi}{6}' },
    { val: 5 * Math.PI / 4, latex: '\\frac{5\\pi}{4}' },
    { val: 4 * Math.PI / 3, latex: '\\frac{4\\pi}{3}' },
    { val: 3 * Math.PI / 2, latex: '\\frac{3\\pi}{2}' },
    { val: 5 * Math.PI / 3, latex: '\\frac{5\\pi}{3}' },
    { val: 7 * Math.PI / 4, latex: '\\frac{7\\pi}{4}' },
    { val: 11 * Math.PI / 6, latex: '\\frac{11\\pi}{6}' },
    { val: 2 * Math.PI, latex: '2\\pi' },
];

function formatForLatex(value) {
    for (const m of piMultiples) {
        if (Math.abs(value - m.val) < 0.0001) return m.latex;
    }
    return value.toFixed(2);
}

// Format value for input field (show pi notation)
function formatForInput(value) {
    const inputFormats = [
        { val: 0, str: '0' },
        { val: Math.PI / 6, str: 'pi/6' },
        { val: Math.PI / 4, str: 'pi/4' },
        { val: Math.PI / 3, str: 'pi/3' },
        { val: Math.PI / 2, str: 'pi/2' },
        { val: 2 * Math.PI / 3, str: '2*pi/3' },
        { val: 3 * Math.PI / 4, str: '3*pi/4' },
        { val: 5 * Math.PI / 6, str: '5*pi/6' },
        { val: Math.PI, str: 'pi' },
        { val: 7 * Math.PI / 6, str: '7*pi/6' },
        { val: 5 * Math.PI / 4, str: '5*pi/4' },
        { val: 4 * Math.PI / 3, str: '4*pi/3' },
        { val: 3 * Math.PI / 2, str: '3*pi/2' },
        { val: 5 * Math.PI / 3, str: '5*pi/3' },
        { val: 7 * Math.PI / 4, str: '7*pi/4' },
        { val: 11 * Math.PI / 6, str: '11*pi/6' },
        { val: 2 * Math.PI, str: '2*pi' },
    ];
    for (const m of inputFormats) {
        if (Math.abs(value - m.val) < 0.0001) return m.str;
    }
    return value.toFixed(3);
}

// Parse expression like "pi/2", "3*pi/4", etc.
function parseExpression(expr) {
    if (typeof expr === 'number') return expr;
    let cleaned = expr.toString().trim().toLowerCase();
    if (cleaned === '') return 0;
    
    // Replace pi with Math.PI
    cleaned = cleaned.replace(/\bpi\b/g, 'Math.PI');
    
    // Validate: only allow numbers, Math.PI, operators, parentheses, spaces
    const withoutMathPI = cleaned.replace(/Math\.PI/g, '1');
    if (!/^[\d\s+\-*/().]+$/.test(withoutMathPI)) return NaN;
    
    try {
        const result = new Function('return ' + cleaned)();
        return typeof result === 'number' && isFinite(result) ? result : NaN;
    } catch (e) {
        return NaN;
    }
}

// ===== State =====
let isDarkTheme = true;
let scene, camera, renderer, controls;
let sphereMesh, arrowGroup, labelSprites = [];
let mathJaxTimeout = null;

// ===== DOM Elements =====
const container = document.getElementById('canvas-container');
const uiContainer = document.getElementById('ui-container');
const themeToggle = document.getElementById('theme-toggle');
const collapseBtn = document.getElementById('collapse-btn');
const infoBtn = document.getElementById('info-btn');
const modalOverlay = document.getElementById('modal-overlay');
const sliderTheta = document.getElementById('slider-theta');
const sliderPhi = document.getElementById('slider-phi');
const inputTheta = document.getElementById('input-theta');
const inputPhi = document.getElementById('input-phi');

// ===== Scene Setup =====
function initScene() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0d1117);

    camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 100);
    camera.position.set(2.8, 2.0, 2.8);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enablePan = false;
    controls.minDistance = 2;
    controls.maxDistance = 8;
}

// ===== Bloch Sphere Components =====
function createSphere() {
    const geo = new THREE.SphereGeometry(1, 48, 48);
    const mat = new THREE.MeshBasicMaterial({
        color: config.sphere.darkWireColor,
        wireframe: true,
        transparent: true,
        opacity: config.sphere.darkWireOpacity
    });
    sphereMesh = new THREE.Mesh(geo, mat);
    scene.add(sphereMesh);
}

function createRings() {
    const ringGeo = new THREE.TorusGeometry(1, 0.008, 16, 100);
    const ringMat = new THREE.MeshBasicMaterial({ 
        color: config.sphere.ringColor, 
        transparent: true, 
        opacity: config.sphere.ringOpacity 
    });
    
    const equator = new THREE.Mesh(ringGeo, ringMat);
    equator.rotation.x = Math.PI / 2;
    scene.add(equator);
    
    const meridian = new THREE.Mesh(ringGeo, ringMat.clone());
    scene.add(meridian);
}

function createAxes() {
    const createAxis = (dir, color) => {
        const points = [new THREE.Vector3(0, 0, 0), dir.clone().multiplyScalar(1.3)];
        const geo = new THREE.BufferGeometry().setFromPoints(points);
        const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.6 });
        return new THREE.Line(geo, mat);
    };
    
    scene.add(createAxis(new THREE.Vector3(1, 0, 0), 0xf85149)); // X - red
    scene.add(createAxis(new THREE.Vector3(0, 1, 0), 0x58a6ff)); // Y - blue (Z quantum)
    scene.add(createAxis(new THREE.Vector3(0, 0, 1), 0x3fb950)); // Z - green (Y quantum)
}

function createStateArrow() {
    arrowGroup = new THREE.Group();
    
    const shaftGeo = new THREE.CylinderGeometry(
        config.arrow.shaftRadius, 
        config.arrow.shaftRadius, 
        config.arrow.length - config.arrow.headLength, 
        16
    );
    const shaftMat = new THREE.MeshBasicMaterial({ color: config.arrow.color });
    const shaft = new THREE.Mesh(shaftGeo, shaftMat);
    shaft.position.y = (config.arrow.length - config.arrow.headLength) / 2;
    arrowGroup.add(shaft);
    
    const headGeo = new THREE.ConeGeometry(config.arrow.headWidth, config.arrow.headLength, 16);
    const headMat = new THREE.MeshBasicMaterial({ color: config.arrow.color });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = config.arrow.length - config.arrow.headLength / 2;
    arrowGroup.add(head);
    
    const tipGeo = new THREE.SphereGeometry(0.06, 16, 16);
    const tipMat = new THREE.MeshBasicMaterial({ color: config.arrow.color });
    const tip = new THREE.Mesh(tipGeo, tipMat);
    tip.position.y = config.arrow.length;
    arrowGroup.add(tip);
    
    scene.add(arrowGroup);
}

function createLabel(text, position, colorKey) {
    const colors = config.labels[colorKey];
    const color = isDarkTheme ? colors.dark : colors.light;
    
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.font = 'Bold 32px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.fillText(text, 64, 42);
    
    const texture = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.position.copy(position);
    sprite.scale.set(0.5, 0.25, 1);
    sprite.userData = { text, colorKey };
    
    scene.add(sprite);
    labelSprites.push(sprite);
    return sprite;
}

function createLabels() {
    // Z axis labels (blue) - |0⟩ and |1⟩
    createLabel('|0⟩', new THREE.Vector3(0, 1.25, 0), 'z');
    createLabel('|1⟩', new THREE.Vector3(0, -1.25, 0), 'z');
    // X axis label (red) - |+⟩
    createLabel('|+⟩', new THREE.Vector3(1.25, 0, 0), 'x');
    // Y axis label (green) - |+i⟩
    createLabel('|i⟩', new THREE.Vector3(0, 0, 1.25), 'y');
}

function updateLabels() {
    labelSprites.forEach(sprite => {
        const colors = config.labels[sprite.userData.colorKey];
        const color = isDarkTheme ? colors.dark : colors.light;
        
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        ctx.font = 'Bold 32px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.fillStyle = color;
        ctx.textAlign = 'center';
        ctx.fillText(sprite.userData.text, 64, 42);
        
        sprite.material.map.dispose();
        sprite.material.map = new THREE.CanvasTexture(canvas);
        sprite.material.needsUpdate = true;
    });
}

// ===== State Update Logic =====
function updateArrowDirection(theta, phi) {
    const qX = Math.sin(theta) * Math.cos(phi);
    const qY = Math.sin(theta) * Math.sin(phi);
    const qZ = Math.cos(theta);
    
    const dir = new THREE.Vector3(qX, qZ, qY).normalize();
    
    arrowGroup.quaternion.identity();
    const up = new THREE.Vector3(0, 1, 0);
    const quaternion = new THREE.Quaternion().setFromUnitVectors(up, dir);
    arrowGroup.quaternion.copy(quaternion);
    
    return { qX, qY, qZ };
}

function updateMathJax(theta, phi, coords) {
    if (mathJaxTimeout) clearTimeout(mathJaxTimeout);
    
    mathJaxTimeout = setTimeout(() => {
        const thetaHalfLatex = formatForLatex(theta / 2);
        const phiLatex = formatForLatex(phi);
        
        // State vector: cos(θ/2)|0⟩ + e^{iφ}sin(θ/2)|1⟩
        const stateLatex = `\\cos\\left(${thetaHalfLatex}\\right)\\ket{0} + e^{i \\cdot ${phiLatex}}\\sin\\left(${thetaHalfLatex}\\right)\\ket{1}`;
        
        // Coordinates
        const coordsLatex = `(${coords.qX.toFixed(2)},\\, ${coords.qY.toFixed(2)},\\, ${coords.qZ.toFixed(2)})`;
        
        const stateEl = document.getElementById('readout-state');
        const coordsEl = document.getElementById('readout-coords');
        
        stateEl.innerHTML = `\\(${stateLatex}\\)`;
        coordsEl.innerHTML = `\\(${coordsLatex}\\)`;
        
        if (window.MathJax && window.MathJax.typesetPromise) {
            window.MathJax.typesetPromise([stateEl, coordsEl]).catch(console.log);
        }
    }, 50);
}

function updateReadouts(theta, phi, coords) {
    updateMathJax(theta, phi, coords);
}

function updateActiveButton(theta, phi) {
    document.querySelectorAll('.state-btn').forEach(btn => btn.classList.remove('active'));
    const eps = 0.05;
    
    if (Math.abs(theta) < eps) {
        document.getElementById('btn-0')?.classList.add('active');
    } else if (Math.abs(theta - Math.PI) < eps) {
        document.getElementById('btn-1')?.classList.add('active');
    } else if (Math.abs(theta - Math.PI/2) < eps) {
        if (Math.abs(phi) < eps || Math.abs(phi - 2*Math.PI) < eps) {
            document.getElementById('btn-plus')?.classList.add('active');
        } else if (Math.abs(phi - Math.PI) < eps) {
            document.getElementById('btn-minus')?.classList.add('active');
        } else if (Math.abs(phi - Math.PI/2) < eps) {
            document.getElementById('btn-i')?.classList.add('active');
        } else if (Math.abs(phi - 3*Math.PI/2) < eps) {
            document.getElementById('btn-mi')?.classList.add('active');
        }
    }
}

function updateVisuals(theta, phi) {
    const coords = updateArrowDirection(theta, phi);
    updateReadouts(theta, phi, coords);
    updateActiveButton(theta, phi);
}

// Global function for button clicks
window.updateState = function(theta, phi) {
    sliderTheta.value = theta;
    sliderPhi.value = phi;
    inputTheta.value = formatForInput(theta);
    inputPhi.value = formatForInput(phi);
    inputTheta.classList.remove('error');
    inputPhi.classList.remove('error');
    updateVisuals(theta, phi);
};

// ===== Theme Toggle =====
function updateTheme() {
    if (isDarkTheme) {
        document.documentElement.removeAttribute('data-theme');
        scene.background = new THREE.Color(0x0d1117);
        sphereMesh.material.color.setHex(config.sphere.darkWireColor);
        sphereMesh.material.opacity = config.sphere.darkWireOpacity;
    } else {
        document.documentElement.setAttribute('data-theme', 'light');
        scene.background = new THREE.Color(0xf6f8fa);
        sphereMesh.material.color.setHex(config.sphere.lightWireColor);
        sphereMesh.material.opacity = config.sphere.lightWireOpacity;
    }
    updateLabels();
}

// ===== Event Listeners =====
function setupEventListeners() {
    themeToggle.addEventListener('click', () => {
        isDarkTheme = !isDarkTheme;
        updateTheme();
    });
    
    collapseBtn.addEventListener('click', () => {
        uiContainer.classList.toggle('collapsed');
        setTimeout(handleResize, 350);
    });
    
    infoBtn.addEventListener('click', () => {
        modalOverlay.classList.add('active');
    });
    
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) {
            modalOverlay.classList.remove('active');
        }
    });
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            modalOverlay.classList.remove('active');
        }
    });
    
    // Slider events
    sliderTheta.addEventListener('input', (e) => {
        const theta = parseFloat(e.target.value);
        const phi = parseFloat(sliderPhi.value);
        inputTheta.value = formatForInput(theta);
        inputTheta.classList.remove('error');
        updateVisuals(theta, phi);
    });
    
    sliderPhi.addEventListener('input', (e) => {
        const theta = parseFloat(sliderTheta.value);
        const phi = parseFloat(e.target.value);
        inputPhi.value = formatForInput(phi);
        inputPhi.classList.remove('error');
        updateVisuals(theta, phi);
    });
    
    // Input field events
    function handleThetaInput() {
        const parsed = parseExpression(inputTheta.value);
        if (isNaN(parsed)) {
            inputTheta.classList.add('error');
            return;
        }
        inputTheta.classList.remove('error');
        const theta = Math.max(0, Math.min(Math.PI, parsed));
        sliderTheta.value = theta;
        updateVisuals(theta, parseFloat(sliderPhi.value));
    }
    
    function handlePhiInput() {
        const parsed = parseExpression(inputPhi.value);
        if (isNaN(parsed)) {
            inputPhi.classList.add('error');
            return;
        }
        inputPhi.classList.remove('error');
        const phi = Math.max(0, Math.min(2 * Math.PI, parsed));
        sliderPhi.value = phi;
        updateVisuals(parseFloat(sliderTheta.value), phi);
    }
    
    inputTheta.addEventListener('input', handleThetaInput);
    inputPhi.addEventListener('input', handlePhiInput);
    
    // Submit on Enter key
    inputTheta.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            handleThetaInput();
            inputTheta.blur();
        }
    });
    
    inputPhi.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            handlePhiInput();
            inputPhi.blur();
        }
    });
    
    window.addEventListener('resize', handleResize);
    new ResizeObserver(handleResize).observe(container);
}

function handleResize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (w === 0 || h === 0) return;
    
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
}

// ===== Animation Loop =====
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

// ===== Initialize =====
function init() {
    initScene();
    createSphere();
    createRings();
    createAxes();
    createStateArrow();
    createLabels();
    setupEventListeners();
    
    // Initial state |0⟩
    updateVisuals(0, 0);
    document.getElementById('btn-0')?.classList.add('active');
    
    animate();
}

init();
