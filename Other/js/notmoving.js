    /* ─── SCENE SETUP ─── */
    const container = document.getElementById('canvas-container');
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x030308, 0.04);

    const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 200);
    camera.position.set(5, 3.5, 5);
    camera.lookAt(0, 0, 0);

    /* ─── LIGHTING ─── */
    const ambientLight = new THREE.AmbientLight(0x111122, 1.2);
    scene.add(ambientLight);

    const pointLight1 = new THREE.PointLight(0x7c9ef7, 3, 20);
    pointLight1.position.set(4, 6, 4);
    pointLight1.castShadow = true;
    scene.add(pointLight1);

    const pointLight2 = new THREE.PointLight(0xa78bfa, 2, 15);
    pointLight2.position.set(-5, 3, -3);
    scene.add(pointLight2);

    const pointLight3 = new THREE.PointLight(0xf87171, 1.5, 12);
    pointLight3.position.set(0, -4, 5);
    scene.add(pointLight3);

    /* ─── GRID FLOOR ─── */
    const gridHelper = new THREE.GridHelper(30, 30, 0x1a1a2e, 0x111120);
    gridHelper.position.y = -3;
    scene.add(gridHelper);

    /* ─── CUBE ─── */
    const geo = new THREE.BoxGeometry(2, 2, 2);

    // Glassmorphic-style dark material with edges
    const mat = new THREE.MeshPhysicalMaterial({
        color: 0x0a0a1a,
        metalness: 0.1,
        roughness: 0.15,
        transmission: 0.6,
        thickness: 1.5,
        transparent: true,
        opacity: 0.85,
        envMapIntensity: 1,
        clearcoat: 1,
        clearcoatRoughness: 0.1,
    });

    const cube = new THREE.Mesh(geo, mat);
    cube.castShadow = true;
    cube.receiveShadow = true;
    scene.add(cube);

    // Wireframe edges
    const edgesGeo = new THREE.EdgesGeometry(geo);
    const edgesMat = new THREE.LineBasicMaterial({ color: 0x7c9ef7, linewidth: 2 });
    const edges = new THREE.LineSegments(edgesGeo, edgesMat);
    cube.add(edges);

    // Inner glow cube (slightly smaller)
    const innerGeo = new THREE.BoxGeometry(1.8, 1.8, 1.8);
    const innerMat = new THREE.MeshBasicMaterial({
        color: 0x7c9ef7,
        transparent: true,
        opacity: 0.04,
    });
    const innerCube = new THREE.Mesh(innerGeo, innerMat);
    cube.add(innerCube);

    /* ─── ORBIT PARTICLES ─── */
    const particleCount = 120;
    const particleGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const radii = [];
    const angles = [];
    const speeds = [];
    const yOffsets = [];

    for (let i = 0; i < particleCount; i++) {
        const r = 3.5 + Math.random() * 4;
        const a = Math.random() * Math.PI * 2;
        const y = (Math.random() - 0.5) * 5;
        radii.push(r);
        angles.push(a);
        speeds.push(0.001 + Math.random() * 0.003);
        yOffsets.push(y);
        positions[i * 3]     = Math.cos(a) * r;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = Math.sin(a) * r;
    }

    particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const particleMat = new THREE.PointsMaterial({
        color: 0x7c9ef7, size: 0.06, transparent: true, opacity: 0.6,
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);

    /* ─── STATE ─── */
    let mode = 'a';
    let camAngle = 0;
    let camTargetAngle = 0;
    let flash = false;

    // Mode A: camera orbits, cube still
    // Mode B: cube rotates, camera still at fixed position
    const CAM_RADIUS = 7.5;
    const CAM_HEIGHT = 3.5;
    const CAM_SPEED  = 0.006;
    const CUBE_SPIN  = 0.012;

    /* ─── LABELS ─── */
    const labelTitle = document.getElementById('label-title');
    const labelSub   = document.getElementById('label-sub');
    const topLabel   = document.getElementById('top-label');
    const annCubeText = document.getElementById('ann-cube-text');
    const btnA = document.getElementById('btn-a');
    const btnB = document.getElementById('btn-b');
    const flashEl = document.getElementById('flash');

    function setMode(m) {
        if (mode === m) return;
        mode = m;

        // Flash
        flashEl.style.opacity = '1';
        setTimeout(() => flashEl.style.opacity = '0', 150);

        if (mode === 'a') {
            labelTitle.textContent = 'THIS OBJECT IS NOT MOVING';
            labelSub.textContent   = 'The camera is orbiting around it. Totally different.';
            topLabel.className     = 'meme-label mode-a';
            annCubeText.textContent = '📦 The Cube (stationary, trust me)';
            edgesMat.color.set(0x7c9ef7);
            particleMat.color.set(0x7c9ef7);
            pointLight1.color.set(0x7c9ef7);
            btnA.className = 'mode-btn active-a';
            btnB.className = 'mode-btn';
            // Reset cube rotation
        } else {
            labelTitle.textContent = 'THIS OBJECT IS MOVING';
            labelSub.textContent   = 'Camera is fixed. Object definitely rotating. Clearly.';
            topLabel.className     = 'meme-label mode-b';
            annCubeText.textContent = '📦 The Cube (totally moving now)';
            edgesMat.color.set(0xa78bfa);
            particleMat.color.set(0xa78bfa);
            pointLight1.color.set(0xa78bfa);
            btnA.className = 'mode-btn';
            btnB.className = 'mode-btn active-b';
        }
    }

    /* ─── ANIMATE ─── */
    let t = 0;

    function animate() {
        requestAnimationFrame(animate);
        t += 0.016;

        // Particle orbit
        const pos = particleGeo.attributes.position.array;
        for (let i = 0; i < particleCount; i++) {
            angles[i] += speeds[i] * (mode === 'b' ? 0.3 : 1);
            pos[i * 3]     = Math.cos(angles[i]) * radii[i];
            pos[i * 3 + 1] = yOffsets[i] + Math.sin(t * 0.3 + i) * 0.1;
            pos[i * 3 + 2] = Math.sin(angles[i]) * radii[i];
        }
        particleGeo.attributes.position.needsUpdate = true;

        if (mode === 'a') {
            // Camera orbits, cube stays
            camAngle += CAM_SPEED;
            camera.position.x = Math.cos(camAngle) * CAM_RADIUS;
            camera.position.z = Math.sin(camAngle) * CAM_RADIUS;
            camera.position.y = CAM_HEIGHT + Math.sin(t * 0.2) * 0.4;
            camera.lookAt(0, 0, 0);

            // Cube breathes slightly but does NOT rotate
            cube.rotation.x = 0;
            cube.rotation.y = 0;
            cube.scale.setScalar(1 + Math.sin(t * 0.8) * 0.012);

        } else {
            // Camera locked, cube spins
            camera.position.set(5, 3.5, 5);
            camera.lookAt(0, 0, 0);

            cube.rotation.y += CUBE_SPIN;
            cube.rotation.x += CUBE_SPIN * 0.4;
            cube.scale.setScalar(1 + Math.sin(t * 0.8) * 0.012);
        }

        // Lights breathe
        pointLight1.intensity = 2.5 + Math.sin(t * 1.2) * 0.5;
        pointLight2.intensity = 1.8 + Math.cos(t * 0.9) * 0.4;

        renderer.render(scene, camera);
    }

    animate();

    /* ─── RESIZE ─── */
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    /* ─── TOUCH / CLICK MODE TOGGLE ─── */
    let tapCount = 0;
    renderer.domElement.addEventListener('click', () => {
        setMode(mode === 'a' ? 'b' : 'a');
    });

    // Back button: return to wherever this tool was opened from, if possible
    const backBtn = document.getElementById('backBtn');
    if (backBtn) {
        backBtn.addEventListener('click', (e) => {
            e.preventDefault();
            document.body.classList.add('page-leaving');
            setTimeout(() => {
                if (window.history.length > 1) {
                    window.history.back();
                } else {
                    window.location.href = backBtn.getAttribute('href');
                }
            }, 220);
        });
    }
    // Guard against a stuck fade if the browser restores this page from cache
    window.addEventListener('pageshow', () => {
        document.body.classList.remove('page-leaving');
    });
