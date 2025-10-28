// Global variables
let scene, camera, renderer, controls;
let robotGroup, framesGroup, labelsGroup;
let dhParams = [];
let isPlaying = false;
let animationId = null;
let currentStep = 0;
let stepAnimations = [];

// Initialize the application
function init() {
    // Set up default DH parameters for a 2-link planar robot
    dhParams = [
        { type: 'revolute', a: 1, alpha: 0, d: 0, theta: 0 },
        { type: 'revolute', a: 1, alpha: 0, d: 0, theta: 0 }
    ];
    
    // Initialize Three.js scene
    initThreeJS();
    
    // Build the DH table
    buildDHTable();
    
    // Set up event listeners
    setupEventListeners();
    
    // Update the visualization
    updateVisualization();
    
    // Start the animation loop
    animate();
}

// Initialize Three.js
function initThreeJS() {
    // Get the container
    const container = document.getElementById('canvas-container');
    
    // Create scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a202c);
    
    // Create camera
    camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(3, 3, 5);
    camera.lookAt(0, 0, 0);
    
    // Create renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);
    
    // Add lights
    const ambientLight = new THREE.AmbientLight(0x404040);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 10, 7);
    scene.add(directionalLight);
    
    // Create groups for organization
    robotGroup = new THREE.Group();
    framesGroup = new THREE.Group();
    labelsGroup = new THREE.Group();
    
    scene.add(robotGroup);
    scene.add(framesGroup);
    scene.add(labelsGroup);
    
    // Add coordinate axes at origin
    addCoordinateAxes(0, 0, 0, 'Base');
    
    // Handle window resize
    window.addEventListener('resize', onWindowResize);
}

// Handle window resize
function onWindowResize() {
    const container = document.getElementById('canvas-container');
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
}

// Add coordinate axes at a position
function addCoordinateAxes(x, y, z, label) {
    const axesHelper = new THREE.AxesHelper(0.5);
    axesHelper.position.set(x, y, z);
    framesGroup.add(axesHelper);
    
    // Add labels for each axis
    if (document.getElementById('show-labels').checked) {
        // In a real implementation, we would add text labels here
        // This is simplified for the example
    }
}

// Build the DH table in the UI
function buildDHTable() {
    const tableBody = document.getElementById('dh-table-body');
    tableBody.innerHTML = '';
    
    dhParams.forEach((param, index) => {
        const row = document.createElement('tr');
        row.className = index % 2 === 0 ? 'bg-gray-700' : 'bg-gray-800';
        
        row.innerHTML = `
            <td class="px-2 py-1">${index + 1}</td>
            <td class="px-2 py-1">
                <select class="w-full bg-gray-600 border border-gray-500 rounded px-1 py-1 text-white joint-type" data-index="${index}">
                    <option value="revolute" ${param.type === 'revolute' ? 'selected' : ''}>Revolute</option>
                    <option value="prismatic" ${param.type === 'prismatic' ? 'selected' : ''}>Prismatic</option>
                </select>
            </td>
            <td class="px-2 py-1">
                <input type="number" class="w-full bg-gray-600 border border-gray-500 rounded px-1 py-1 text-white dh-param" data-index="${index}" data-param="a" value="${param.a}" step="0.1">
            </td>
            <td class="px-2 py-1">
                <input type="number" class="w-full bg-gray-600 border border-gray-500 rounded px-1 py-1 text-white dh-param" data-index="${index}" data-param="alpha" value="${param.alpha}" step="0.1">
            </td>
            <td class="px-2 py-1">
                <input type="number" class="w-full bg-gray-600 border border-gray-500 rounded px-1 py-1 text-white dh-param" data-index="${index}" data-param="d" value="${param.d}" step="0.1">
            </td>
            <td class="px-2 py-1">
                <input type="number" class="w-full bg-gray-600 border border-gray-500 rounded px-1 py-1 text-white dh-param" data-index="${index}" data-param="theta" value="${param.theta}" step="0.1">
            </td>
        `;
        
        tableBody.appendChild(row);
    });
    
    // Add event listeners to the new inputs
    document.querySelectorAll('.dh-param').forEach(input => {
        input.addEventListener('input', handleParamChange);
    });
    
    document.querySelectorAll('.joint-type').forEach(select => {
        select.addEventListener('change', handleJointTypeChange);
    });
}

// Handle parameter changes
function handleParamChange(e) {
    const index = parseInt(e.target.dataset.index);
    const param = e.target.dataset.param;
    const value = parseFloat(e.target.value);
    
    dhParams[index][param] = value;
    updateVisualization();
}

// Handle joint type changes
function handleJointTypeChange(e) {
    const index = parseInt(e.target.dataset.index);
    dhParams[index].type = e.target.value;
    updateVisualization();
}

// Update the 3D visualization based on DH parameters
function updateVisualization() {
    // Clear previous visualization
    robotGroup.clear();
    framesGroup.clear();
    labelsGroup.clear();
    
    // Add base coordinate frame
    addCoordinateAxes(0, 0, 0, 'Base');
    
    let currentTransform = [
        [1, 0, 0, 0],
        [0, 1, 0, 0],
        [0, 0, 1, 0],
        [0, 0, 0, 1]
    ];
    
    // Apply each transformation in sequence
    for (let i = 0; i < dhParams.length; i++) {
        const param = dhParams[i];
        
        // Calculate transformation matrix for this joint
        const jointTransform = dhToTransform(param.a, param.alpha, param.d, param.theta);
        
        // Update current transform
        currentTransform = multiplyMatrices(currentTransform, jointTransform);
        
        // Extract position from transformation matrix
        const x = currentTransform[0][3];
        const y = currentTransform[1][3];
        const z = currentTransform[2][3];
        
        // Draw link
        if (i > 0) {
            const prevParam = dhParams[i-1];
            const prevTransform = getCumulativeTransform(i-1);
            const prevX = prevTransform[0][3];
            const prevY = prevTransform[1][3];
            const prevZ = prevTransform[2][3];
            
            drawLink(prevX, prevY, prevZ, x, y, z);
        }
        
        // Draw joint
        drawJoint(x, y, z, param.type);
        
        // Draw coordinate frame
        addCoordinateAxes(x, y, z, `Frame ${i+1}`);
        
        // Draw DH parameters visualization
        if (document.getElementById('show-common-normal').checked) {
            drawDHParametersVisualization(i, param, currentTransform);
        }
    }
    
    // Update end effector position and transformation matrix
    updateEndEffectorInfo(currentTransform);
}

// Draw a link between two points
function drawLink(x1, y1, z1, x2, y2, z2) {
    const geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(x1, y1, z1),
        new THREE.Vector3(x2, y2, z2)
    ]);
    
    const material = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 3 });
    const line = new THREE.Line(geometry, material);
    robotGroup.add(line);
    
    // Add cylinder for thicker appearance
    const direction = new THREE.Vector3().subVectors(
        new THREE.Vector3(x2, y2, z2),
        new THREE.Vector3(x1, y1, z1)
    );
    
    const length = direction.length();
    direction.normalize();
    
    const cylinderGeometry = new THREE.CylinderGeometry(0.05, 0.05, length, 8);
    cylinderGeometry.translate(0, length/2, 0);
    cylinderGeometry.rotateX(Math.PI/2);
    
    const cylinderMaterial = new THREE.MeshPhongMaterial({ color: 0x4a5568 });
    const cylinder = new THREE.Mesh(cylinderGeometry, cylinderMaterial);
    
    // Position and orient the cylinder
    cylinder.position.set(
        (x1 + x2) / 2,
        (y1 + y2) / 2,
        (z1 + z2) / 2
    );
    
    cylinder.lookAt(x2, y2, z2);
    robotGroup.add(cylinder);
}

// Draw a joint at a position
function drawJoint(x, y, z, type) {
    const geometry = new THREE.SphereGeometry(0.1, 16, 16);
    const color = type === 'revolute' ? 0x3182ce : 0xe53e3e;
    const material = new THREE.MeshPhongMaterial({ color: color });
    const sphere = new THREE.Mesh(geometry, material);
    sphere.position.set(x, y, z);
    robotGroup.add(sphere);
}

// Draw visualization of DH parameters
function drawDHParametersVisualization(index, param, transform) {
    // This would draw the visual representation of a, α, d, θ parameters
    // For simplicity, I not implementing the full visualization here
    // In a complete implementation, we would draw:
    // - Orange arrow for a (link length)
    // - Purple arc for α (link twist)
    // - Teal arrow for d (joint offset)
    // - Blue arc for θ (joint angle)
}

// Calculate DH transformation matrix
function dhToTransform(a, alpha, d, theta) {
    const cosTheta = Math.cos(theta);
    const sinTheta = Math.sin(theta);
    const cosAlpha = Math.cos(alpha);
    const sinAlpha = Math.sin(alpha);
    
    return [
        [cosTheta, -sinTheta * cosAlpha, sinTheta * sinAlpha, a * cosTheta],
        [sinTheta, cosTheta * cosAlpha, -cosTheta * sinAlpha, a * sinTheta],
        [0, sinAlpha, cosAlpha, d],
        [0, 0, 0, 1]
    ];
}

// Multiply two 4x4 matrices
function multiplyMatrices(a, b) {
    const result = [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]];
    
    for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
            for (let k = 0; k < 4; k++) {
                result[i][j] += a[i][k] * b[k][j];
            }
        }
    }
    
    return result;
}

// Get cumulative transform up to a specific joint
function getCumulativeTransform(jointIndex) {
    let transform = [
        [1, 0, 0, 0],
        [0, 1, 0, 0],
        [0, 0, 1, 0],
        [0, 0, 0, 1]
    ];
    
    for (let i = 0; i <= jointIndex; i++) {
        const param = dhParams[i];
        const jointTransform = dhToTransform(param.a, param.alpha, param.d, param.theta);
        transform = multiplyMatrices(transform, jointTransform);
    }
    
    return transform;
}

// Update end effector information
function updateEndEffectorInfo(transform) {
    const x = transform[0][3].toFixed(2);
    const y = transform[1][3].toFixed(2);
    const z = transform[2][3].toFixed(2);
    
    document.getElementById('end-effector-pos').textContent = `(${x}, ${y}, ${z})`;
    
    // Calculate orientation (simplified)
    const roll = Math.atan2(transform[2][1], transform[2][2]).toFixed(2);
    const pitch = Math.atan2(-transform[2][0], Math.sqrt(transform[2][1]**2 + transform[2][2]**2)).toFixed(2);
    const yaw = Math.atan2(transform[1][0], transform[0][0]).toFixed(2);
    
    document.getElementById('end-effector-rot').textContent = `(${roll}, ${pitch}, ${yaw})`;
    
    // Update transformation matrix display
    const matrixElement = document.getElementById('transform-matrix');
    matrixElement.innerHTML = '';
    
    for (let i = 0; i < 4; i++) {
        const row = document.createElement('div');
        row.className = 'flex justify-between';
        
        for (let j = 0; j < 4; j++) {
            const value = document.createElement('span');
            value.textContent = transform[i][j].toFixed(3);
            row.appendChild(value);
        }
        
        matrixElement.appendChild(row);
    }
}

// Set up event listeners
function setupEventListeners() {
    // Preset selection
    document.getElementById('preset-select').addEventListener('change', handlePresetChange);
    
    // Add/remove joints
    document.getElementById('add-joint').addEventListener('click', addJoint);
    document.getElementById('remove-joint').addEventListener('click', removeJoint);
    
    // Display options
    document.getElementById('show-frames').addEventListener('change', updateVisualization);
    document.getElementById('show-labels').addEventListener('change', updateVisualization);
    document.getElementById('show-robot').addEventListener('change', updateVisualization);
    document.getElementById('show-common-normal').addEventListener('change', updateVisualization);
    
    // Animation controls
    document.getElementById('play-btn').addEventListener('click', playAnimation);
    document.getElementById('pause-btn').addEventListener('click', pauseAnimation);
    document.getElementById('reset-btn').addEventListener('click', resetAnimation);
    document.getElementById('speed-slider').addEventListener('input', updateAnimationSpeed);
    document.getElementById('explainer-mode').addEventListener('change', handleExplainerModeChange);
    
    // Export options
    document.getElementById('export-csv').addEventListener('click', exportCSV);
    document.getElementById('share-url').addEventListener('click', shareURL);
    
    // View toggles
    document.getElementById('toggle-2d').addEventListener('click', toggle2DView);
    document.getElementById('toggle-3d').addEventListener('click', toggle3DView);
    
    // Tab navigation
    document.querySelectorAll('.tab-button').forEach(button => {
        button.addEventListener('click', handleTabClick);
    });
    
    // Quiz functionality
    document.getElementById('check-quiz').addEventListener('click', checkQuiz);
    document.getElementById('reset-quiz').addEventListener('click', resetQuiz);
    
    // Code copy
    document.getElementById('copy-code').addEventListener('click', copyCode);
    
    // Step navigation
    document.getElementById('prev-step').addEventListener('click', prevStep);
    document.getElementById('next-step').addEventListener('click', nextStep);
    
    // Drag and drop for quiz
    setupDragAndDrop();
}

// Handle preset selection
function handlePresetChange(e) {
    const preset = e.target.value;
    
    switch(preset) {
        case '2link':
            dhParams = [
                { type: 'revolute', a: 1, alpha: 0, d: 0, theta: 0.5 },
                { type: 'revolute', a: 1, alpha: 0, d: 0, theta: 0.5 }
            ];
            break;
        case '3r':
            dhParams = [
                { type: 'revolute', a: 0, alpha: -Math.PI/2, d: 0.5, theta: 0 },
                { type: 'revolute', a: 1, alpha: 0, d: 0, theta: 0 },
                { type: 'revolute', a: 1, alpha: 0, d: 0, theta: 0 }
            ];
            break;
        case 'scara':
            dhParams = [
                { type: 'revolute', a: 1, alpha: 0, d: 0.5, theta: 0 },
                { type: 'revolute', a: 1, alpha: Math.PI, d: 0, theta: 0 },
                { type: 'prismatic', a: 0, alpha: 0, d: 0, theta: 0 }
            ];
            break;
        case '6dof':
            dhParams = [
                { type: 'revolute', a: 0, alpha: -Math.PI/2, d: 0.3, theta: 0 },
                { type: 'revolute', a: 0.5, alpha: 0, d: 0, theta: 0 },
                { type: 'revolute', a: 0.5, alpha: -Math.PI/2, d: 0, theta: 0 },
                { type: 'revolute', a: 0, alpha: Math.PI/2, d: 0.5, theta: 0 },
                { type: 'revolute', a: 0, alpha: -Math.PI/2, d: 0, theta: 0 },
                { type: 'revolute', a: 0, alpha: 0, d: 0.2, theta: 0 }
            ];
            break;
        default:
            // Keep current parameters for custom
            return;
    }
    
    buildDHTable();
    updateVisualization();
}

// Add a joint to the robot
function addJoint() {
    dhParams.push({ type: 'revolute', a: 1, alpha: 0, d: 0, theta: 0 });
    buildDHTable();
    updateVisualization();
}

// Remove a joint from the robot
function removeJoint() {
    if (dhParams.length > 1) {
        dhParams.pop();
        buildDHTable();
        updateVisualization();
    }
}

// Play animation
function playAnimation() {
    isPlaying = true;
}

// Pause animation
function pauseAnimation() {
    isPlaying = false;
}

// Reset animation
function resetAnimation() {
    isPlaying = false;
    currentStep = 0;
    updateVisualization();
}

// Update animation speed
function updateAnimationSpeed(e) {
    // This would control animation speed in a complete implementation
}

// Handle explainer mode change
function handleExplainerModeChange(e) {
    const mode = e.target.value;
    
    if (mode === 'stepwise') {
        document.getElementById('step-instruction').classList.remove('hidden');
        startStepByStepGuide();
    } 
    else {
        document.getElementById('step-instruction').classList.add('hidden');
    }
}

// Start step-by-step guide
function startStepByStepGuide() {
    currentStep = 0;
    updateStepInstruction();
}

// Update step instruction
function updateStepInstruction() {
    const steps = [
        "Step 1: Identify and label all joint axes (z_i)",
        "Step 2: Establish the base frame (z_0 along first joint axis)",
        "Step 3: For each consecutive joint, locate the origin where the common normal intersects z_i",
        "Step 4: Establish x_i along the common normal",
        "Step 5: Establish y_i to complete the right-handed coordinate system",
        "Step 6: For the end effector, set the origin and orientation as needed",
        "Step 7: Calculate the DH parameters for each link"
    ];
    
    if (currentStep < steps.length) {
        document.getElementById('step-text').textContent = steps[currentStep];
    }
}

// Go to previous step
function prevStep() {
    if (currentStep > 0) {
        currentStep--;
        updateStepInstruction();
    }
}

// Go to next step
function nextStep() {
    const steps = [
        "Step 1: Identify and label all joint axes (z_i)",
        "Step 2: Establish the base frame (z_0 along first joint axis)",
        "Step 3: For each consecutive joint, locate the origin where the common normal intersects z_i",
        "Step 4: Establish x_i along the common normal",
        "Step 5: Establish y_i to complete the right-handed coordinate system",
        "Step 6: For the end effector, set the origin and orientation as needed",
        "Step 7: Calculate the DH parameters for each link"
    ];
    
    if (currentStep < steps.length - 1) {
        currentStep++;
        updateStepInstruction();
    }
}

// Export to CSV
function exportCSV() {
    const csv = Papa.unparse({
        fields: ['Joint', 'Type', 'a', 'α', 'd', 'θ'],
        data: dhParams.map((param, index) => [
            index + 1,
            param.type,
            param.a,
            param.alpha,
            param.d,
            param.theta
        ])
    });
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'dh_parameters.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Share as URL
function shareURL() {
    const params = encodeURIComponent(JSON.stringify(dhParams));
    const url = `${window.location.origin}${window.location.pathname}?dh=${params}`;
    
    // Copy to clipboard
    navigator.clipboard.writeText(url).then(() => {
        alert('URL copied to clipboard!');
    });
}

// Toggle 2D view
function toggle2DView() {
    // This would switch to a 2D view in a complete implementation
    alert('2D view would be implemented here');
}

// Toggle 3D view
function toggle3DView() {
    // Already in 3D view
}

// Handle tab clicks
function handleTabClick(e) {
    const tabId = e.target.dataset.tab;
    
    // Update active tab button
    document.querySelectorAll('.tab-button').forEach(button => {
        button.classList.remove('active');
    });
    e.target.classList.add('active');
    
    // Show selected tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
        content.classList.add('hidden');
    });
    document.getElementById(tabId).classList.add('active');
    document.getElementById(tabId).classList.remove('hidden');
}

// Set up drag and drop for quiz
function setupDragAndDrop() {
    const draggables = document.querySelectorAll('[draggable="true"]');
    const dropZones = document.querySelectorAll('.drop-zone');
    
    draggables.forEach(draggable => {
        draggable.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', e.target.dataset.param);
            e.target.classList.add('opacity-50');
        });
        
        draggable.addEventListener('dragend', (e) => {
            e.target.classList.remove('opacity-50');
        });
    });
    
    dropZones.forEach(zone => {
        zone.addEventListener('dragover', (e) => {
            e.preventDefault();
            zone.classList.add('bg-gray-600');
        });
        
        zone.addEventListener('dragleave', () => {
            zone.classList.remove('bg-gray-600');
        });
        
        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            zone.classList.remove('bg-gray-600');
            
            const param = e.dataTransfer.getData('text/plain');
            zone.dataset.dropped = param;
            
            // Visual feedback
            const originalColor = getParamColor(param);
            zone.style.borderLeft = `4px solid ${originalColor}`;
        });
    });
}

// Get color for a parameter
function getParamColor(param) {
    switch(param) {
        case 'a': return '#ed8936'; // orange
        case 'alpha': return '#9f7aea'; // purple
        case 'd': return '#38b2ac'; // teal
        case 'theta': return '#4299e1'; // blue
        default: return '#718096'; // gray
    }
}

// Check quiz answers
function checkQuiz() {
    const dropZones = document.querySelectorAll('.drop-zone');
    let correct = 0;
    let total = dropZones.length;
    
    dropZones.forEach(zone => {
        const correctAnswer = zone.dataset.correct;
        const userAnswer = zone.dataset.dropped;
        
        if (correctAnswer === userAnswer) {
            correct++;
            zone.style.backgroundColor = '#2d3748'; // Reset background
            zone.style.borderLeft = `4px solid #48bb78`; // Green for correct
        } 
        else {
            zone.style.backgroundColor = '#742a2a'; // Red background for incorrect
            zone.style.borderLeft = `4px solid #e53e3e`; // Red border for incorrect
        }
    });
    
    const feedback = document.getElementById('quiz-feedback');
    feedback.classList.remove('hidden');
    
    if (correct === total) {
        feedback.textContent = 'Perfect! All answers are correct.';
        feedback.className = 'bg-green-900 text-green-200';
    } 
    else {
        feedback.textContent = `You got ${correct} out of ${total} correct. Try again!`;
        feedback.className = 'bg-yellow-900 text-yellow-200';
    }
}

// Reset quiz
function resetQuiz() {
    const dropZones = document.querySelectorAll('.drop-zone');
    const draggables = document.querySelectorAll('[draggable="true"]');
    const feedback = document.getElementById('quiz-feedback');
    
    dropZones.forEach(zone => {
        delete zone.dataset.dropped;
        zone.style.backgroundColor = '';
        zone.style.borderLeft = '';
    });
    
    draggables.forEach(draggable => {
        draggable.style.opacity = '';
    });
    
    feedback.classList.add('hidden');
}

// Copy code to clipboard
function copyCode() {
    const codeBlock = document.getElementById('code-block');
    const textArea = document.createElement('textarea');
    textArea.value = codeBlock.textContent;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    
    // Visual feedback
    const button = document.getElementById('copy-code');
    const originalText = button.textContent;
    button.textContent = 'Copied!';
    button.classList.remove('bg-blue-600');
    button.classList.add('bg-green-600');
    
    setTimeout(() => {
        button.textContent = originalText;
        button.classList.remove('bg-green-600');
        button.classList.add('bg-blue-600');
    }, 2000);
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    
    if (isPlaying) {
        // Animate the robot
        // This would update joint angles in a complete implementation
        dhParams.forEach((param, index) => {
            if (param.type === 'revolute') {
                param.theta += 0.01;
            } 
            else if (param.type === 'prismatic') {
                param.d += 0.01;
            }
        });
        
        buildDHTable();
        updateVisualization();
    }
    
    renderer.render(scene, camera);
}

// Initialize the application when the page loads
window.addEventListener('DOMContentLoaded', init);