const workshop = {
    shaman: {
        sandbox3d: {
            canvas: document.getElementById("renderCanvas"),
            engine: null,
            scene: null,
            cameraFree: null,
            cullingFrameCount: 0,
            cullingRate: 10,

            MirrorSystem: {
                probe: null,
                init: function (scene) {
                    this.probe = new BABYLON.ReflectionProbe("sb3dGlobalMirrorProbe", 512, scene);
                    this.probe.refreshRate = BABYLON.RenderTargetTexture.REFRESHRATE_RENDER_ONEVERYTWOFRAMES;
                    this.probe.position = new BABYLON.Vector3(0, 25, 0);
                },
                addToRenderList: function (mesh) {
                    if (this.probe && mesh && mesh.name && !mesh.name.startsWith("mirror_")) {
                        if (!this.probe.renderList.includes(mesh)) {
                            this.probe.renderList.push(mesh);
                        }
                    }
                },
                removeFromRenderList: function (mesh) {
                    if (this.probe && mesh) {
                        const idx = this.probe.renderList.indexOf(mesh);
                        if (idx > -1) {
                            this.probe.renderList.splice(idx, 1);
                        }
                    }
                }
            },

            init: async function () {

                const useWebGPU = localStorage.getItem('sb3d_use_webgpu') === 'true';

                if (useWebGPU) {
                    let webGpuFailed = false;

                    if (navigator.gpu) {
                        try {
                            const adapter = await navigator.gpu.requestAdapter();
                            if (!adapter) throw new Error("Adapter is null");

                            this.engine = new BABYLON.WebGPUEngine(this.canvas);
                            await this.engine.initAsync();

                            this.engine.onContextLostObservable.add(() => {
                                if (confirm("Session Error\n\nAn unknown error has occured while using WebGPU.\nA switch back to WebGL2 may help.\n\nClick OK to switch\nClick CANCEL to resume")) {
                                    localStorage.setItem('sb3d_use_webgpu', 'false');
                                    window.location.reload();
                                }
                            });
                        } catch (e) {
                            webGpuFailed = true;
                        }
                    } else {
                        webGpuFailed = true;
                    }

                    if (webGpuFailed) {
                        const fallback = confirm("Session Error\n\nWebGPU isn't supported or failed to initialized for this device.\n\nClick OK to switch back to WebGL2\nClick CANCEL to resume");

                        if (fallback) {
                            localStorage.setItem('sb3d_use_webgpu', 'false');
                            updateWebGPUButtonState();
                            this.engine = new BABYLON.Engine(this.canvas, true);
                        } else {
                            return;
                        }
                    }
                } else {
                    this.engine = new BABYLON.Engine(this.canvas, true);
                }

                if (this.engine) {
                    this.scene = this.createScene();
                    sceneRef = this.scene;
                    workshop.shaman.sandbox3d.TemporalAudio.init(this.scene);

                    if (this.engine.isWebGPU || this.engine instanceof BABYLON.WebGPUEngine) {
                        const uploadBtn = document.getElementById('btn-upload');
                        if (uploadBtn) {
                            uploadBtn.style.opacity = '0.4';
                            uploadBtn.style.cursor = 'not-allowed';
                            uploadBtn.innerHTML = `<span class="shape-icon icon-upload"></span> Locked (WebGL2 Only)`;
                        }
                    }

                    this.scene.executeWhenReady(() => {
                        const hideLoader = () => {
                            const loader = document.getElementById('loading-screen');
                            if (loader) {
                                loader.style.opacity = '0';
                                loader.style.pointerEvents = 'none';
                                setTimeout(() => {
                                    loader.remove();
                                    setTimeout(() => {
                                        if (window.sb3dIntroReveal) window.sb3dIntroReveal();
                                    }, 1000);
                                }, 800);
                            }
                        };

                        hideLoader();
                    });

                    const fpsDiv = document.getElementById("fps-render");
                    const physDiv = document.getElementById("fps-phys");

                    let _lastFrameTimeStamp = performance.now();
                    let _lastDisplayUpdate = 0;

                    this.engine.runRenderLoop(() => {
                        const now = performance.now();
                        const currentFps = this.engine.getFps();
                        this.checkPerformanceSafeguard(currentFps);

                        this.cullingFrameCount++;
                        if (this.cullingFrameCount > this.cullingRate) {
                            this.cullingFrameCount = 0;
                            this.handleDistanceCulling();
                            this.handleFrustumCulling();
                            this.handlePhysicsSleeping();
                        }

                        const currentFPS = this.engine.getFps();

                        const _now = performance.now();
                        if (_now - _lastDisplayUpdate >= 1000) {
                            _lastDisplayUpdate = _now;

                            if (fpsDiv) {
                                fpsDiv.innerText = "FPS: " + currentFPS.toFixed(0);
                            }

                            if (physDiv) {
                                const _cpuMs = (_now - _lastFrameTimeStamp).toFixed(1);
                                const _draws = this.scene.getActiveMeshes().length;
                                physDiv.innerText = `CPU: ${_cpuMs}ms | DC: ${_draws}`;
                            }
                        }

                        _lastFrameTimeStamp = performance.now();

                        if (targetFPS === 0) {
                            this.handleKillZone();
                            this.handleInput();
                            this.scene.render();
                            return;
                        }

                        const delta = now - lastFrameTime;
                        const interval = 1000 / targetFPS;

                        if (delta >= interval) {
                            lastFrameTime = now - (delta % interval);
                            this.handleKillZone();
                            this.handleInput();
                            this.scene.render();
                        }
                    });

                    window.addEventListener("resize", () => { this.engine.resize(); });
                }
            },

            checkPerformanceSafeguard: function (fps) {
                if (!performanceSafeguardActive || isSafeguardInCooldown) return;

                if (fps < 5) {
                    lowFpsCounter++;

                    if (lowFpsCounter > 3) {
                        isSafeguardInCooldown = true;
                        const restart = confirm("Session Paused\n\nLow FPS detected, session is paused to save your system.\n\nClick OK to restart your sandbox and clear the scene.\nClick CANCEL to resume your sandbox, prompt will reappear after 60 seconds.");

                        if (restart) {
                            console.warn("[SB3D] Safeguard: Clicked OK. Reloading (5s guard just in case)...");
                            setTimeout(() => {
                                isSafeguardInCooldown = false;
                            }, 5000);
                            window.location.reload();
                        } else {
                            lowFpsCounter = 0;
                            console.warn("[SB3D] Safeguard: Clicked CANCEL. Starting 60s cooldown...");

                            setTimeout(() => {
                                isSafeguardInCooldown = false;
                                console.log("[SB3D] Safeguard: Cooldown finished. Monitoring active.");
                            }, 60000);
                        }
                    }
                } else {
                    lowFpsCounter = 0;
                }
            },

            createScene: function () {
                const scene = new BABYLON.Scene(this.engine);

                scene.enablePhysics(new BABYLON.Vector3(0, -9.81, 0), new BABYLON.CannonJSPlugin());

                this.cameraFree = new BABYLON.UniversalCamera("CameraFree", new BABYLON.Vector3(0, 4, -40), scene);
                this.cameraFree.setTarget(new BABYLON.Vector3(0, 4, 0));
                this.cameraFree.fov = 1.2;
                this.cullingDistance = 500;

                this.cameraFree.keysUp = [];
                this.cameraFree.keysDown = [];
                this.cameraFree.keysLeft = [];
                this.cameraFree.keysRight = [];

                const light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene);
                light.intensity = 1.2;
                light.diffuse = new BABYLON.Color3(1, 1, 1);
                light.groundColor = new BABYLON.Color3(0.5, 0.5, 0.5);
                const dirLight = new BABYLON.DirectionalLight("dirLight", new BABYLON.Vector3(0, -1, 0), scene);
                dirLight.intensity = 1.2;
                dirLight.diffuse = new BABYLON.Color3(1, 1, 1);
                dayNightLightRef = light;
                dayNightDirRef = dirLight;
                scene.clearColor = new BABYLON.Color4(0.55, 0.7, 0.85, 1.0);

                const groundThickness = 10000;
                const groundYBottom = -groundThickness;
                const groundYTop = 0;

                const ground = BABYLON.MeshBuilder.CreateBox("ground", {
                    width: 500,
                    height: groundThickness,
                    depth: 500
                }, scene);
                ground.position.y = groundYBottom + groundThickness / 2;

                const groundMat = new BABYLON.StandardMaterial("groundMat", scene);
                groundMat.diffuseColor = new BABYLON.Color3(0.15, 0.15, 0.2);
                groundMat.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1);
                ground.material = groundMat;

                ground.physicsImpostor = new BABYLON.PhysicsImpostor(
                    ground,
                    BABYLON.PhysicsImpostor.BoxImpostor,
                    { mass: 0, restitution: 0.5, friction: 0.5 },
                    scene
                );

                const voidPlatform = BABYLON.MeshBuilder.CreateDisc("voidPlatform", { radius: 2000, tessellation: 64 }, scene);
                voidPlatform.position = new BABYLON.Vector3(0, -7000, 0);
                voidPlatform.rotation.x = Math.PI / 2;
                const voidMat = new BABYLON.StandardMaterial("voidMat", scene);
                voidMat.diffuseColor = new BABYLON.Color3(0, 0, 0);
                voidMat.specularColor = new BABYLON.Color3(0, 0, 0);
                voidMat.emissiveColor = new BABYLON.Color3(0.05, 0.05, 0.05);
                voidPlatform.material = voidMat;
                voidPlatform.isPickable = false;
                voidPlatform.alwaysSelectAsActiveMesh = false;
                voidPlatform.checkCollisions = false;

                const ramp = BABYLON.MeshBuilder.CreateBox("ramp", { width: 100, height: 1, depth: 30 }, scene);
                ramp.position = new BABYLON.Vector3(150, 18, 0);
                ramp.rotation.z = Math.PI / 8;
                const rampMat = new BABYLON.StandardMaterial("rampMat", scene);
                rampMat.diffuseColor = new BABYLON.Color3(0.25, 0.25, 0.3);
                ramp.material = rampMat;
                ramp.physicsImpostor = new BABYLON.PhysicsImpostor(ramp, BABYLON.PhysicsImpostor.BoxImpostor, { mass: 0, restitution: 0.2, friction: 0.4 }, scene);

                this.createPillars(scene);
                this.createBackgroundDecorations(scene);
                this.createBackgroundPillars(scene);
                this.createStairs(scene);
                this.setupInteraction(scene);
                startNightPulseSystem(scene);
                this.MirrorSystem.init(scene);
                this.MirrorSystem.addToRenderList(ground);
                this.MirrorSystem.addToRenderList(ramp);

                if (localStorage.getItem('sb3d_bgPillars') === '0') {
                    scene.meshes.filter(m => m.name.startsWith("bgPillar_")).forEach(m => m.setEnabled(false));
                    const btn = document.getElementById('btn-bg-pillars');
                    if (btn) btn.innerHTML = `<span class="shape-icon" style="background:#555; border-radius:2px;"></span> BG Pillars are OFF`;
                }
                if (localStorage.getItem('sb3d_bgDecors') === '0') {
                    scene.meshes.filter(m => m.name.startsWith("bg_") || m.name.startsWith("platform_")).forEach(m => m.setEnabled(false));
                    const btn = document.getElementById('btn-bg-decors');
                    if (btn) btn.innerHTML = `<span class="shape-icon" style="background:#555; border-radius:50%;"></span> BG Decors are OFF`;
                }

                this.WaterSimulation.init(scene);
                setTimeout(() => {
                    toggleSun(true);
                    if (isDayNightEnabled) {
                        const slider = document.getElementById('opt-tod');
                        if (slider) setTimeOfDay(slider.value);
                    }
                }, 100);

                const pBody = BABYLON.MeshBuilder.CreateBox("sb3dPlayerBody", {
                    width: playerRadius * 2,
                    height: playerHeight,
                    depth: playerRadius * 2
                }, scene);
                pBody.isVisible = false;
                pBody.isPickable = false;
                pBody.position = new BABYLON.Vector3(0, playerHeight / 2 + 0.5, -40);
                pBody.physicsImpostor = new BABYLON.PhysicsImpostor(
                    pBody,
                    BABYLON.PhysicsImpostor.BoxImpostor,
                    { mass: playerMass, friction: 0.0, restitution: 0.0 },
                    scene
                );
                const _pb = pBody.physicsImpostor.physicsBody;
                if (_pb) {
                    if (_pb.linearDamping !== undefined) _pb.linearDamping = 0.02;
                    if (_pb.angularDamping !== undefined) _pb.angularDamping = 1.0;
                }
                this.playerBody = pBody;

                const _sb3d = this;
                scene.onAfterRenderObservable.add(() => {
                    if (!isFreeFlyMode && _sb3d.playerBody && !_sb3d.playerBody.isDisposed()) {
                        const c = _sb3d.cameraFree;
                        c.position.x = _sb3d.playerBody.position.x;
                        c.position.y = _sb3d.playerBody.position.y + playerHeight / 2;
                        c.position.z = _sb3d.playerBody.position.z;
                    }
                });

                return scene;
            },

            resetCameraTarget: function() { },

            handleKillZone: function() {
                const killY = -100;
                for(let i = spawnedMeshes.length - 1; i >= 0; i--) {
                    const mesh = spawnedMeshes[i];
                    if(mesh && !mesh.isDisposed()) {
                        if (mesh.position.y < killY) {
                            if (mesh === viewTargetMesh) toggleViewMode();
                            if (mesh === heldMesh) {
                                heldMesh = null;
                                const _gb = document.getElementById('btn-grab');
                                if (_gb) { _gb.textContent = 'GRAB'; _gb.classList.remove('grabbing'); }
                                const _cur = document.getElementById('center-cursor');
                                if (_cur) _cur.classList.remove('grabbing');
                            }
                            mesh.dispose();
                            spawnedMeshes.splice(i, 1);
                        }
                    }
                }
            },

            handleDistanceCulling: function () {
                if (!this.cameraFree) return;

                const camPos = this.cameraFree.position;
                const viewLimit = this.cullingDistance || 500;
                const viewLimitSq = viewLimit * viewLimit;

                for (let i = 0; i < spawnedMeshes.length; i++) {
                    const mesh = spawnedMeshes[i];
                    if (!mesh || mesh.isDisposed()) continue;

                    const distSq = mesh.position.subtract(camPos).lengthSquared();

                    if (distSq > viewLimitSq) {
                        if (mesh.isEnabled()) {
                            mesh.setEnabled(false);
                            if (mesh.physicsImpostor) mesh.physicsImpostor.sleep();
                        }
                    } else {
                        if (!mesh.isEnabled()) {
                            mesh.setEnabled(true);
                            if (mesh.physicsImpostor) mesh.physicsImpostor.wakeUp();
                        }
                    }
                }
            },

            handleFrustumCulling: function () {
                if (!this.cameraFree || !isFrustumCullingEnabled) return;

                const scene = this.scene;
                const camPos = this.cameraFree.position;
                const transform = this.cameraFree.getViewMatrix().multiply(this.cameraFree.getProjectionMatrix());
                const frustumPlanes = BABYLON.Frustum.GetPlanes(transform);

                if (!this._occluderList || this._occluderList.length === 0 ||
                    !this._occluderList[0] || this._occluderList[0].isDisposed() ||
                    this._occluderList[0].getScene() !== scene) {
                    this._occluderList = scene.meshes.filter(m =>
                        m && !m.isDisposed() && m.isEnabled() && m.isVisible &&
                        (
                            m.name === 'ground' ||
                            m.name === 'ramp' ||
                            m.name === 'poolFloor' ||
                            m.name === 'pillar' ||
                            m.name.startsWith('stair_step_') ||
                            m.name.startsWith('wall') ||
                            m.name.startsWith('bgPillar_')
                        )
                    );
                }

                const occluders = this._occluderList;

                for (let i = 0; i < spawnedMeshes.length; i++) {
                    const mesh = spawnedMeshes[i];
                    if (!mesh || mesh.isDisposed() || !mesh.isEnabled()) continue;

                    mesh.computeWorldMatrix(true);
                    const boundingInfo = mesh.getBoundingInfo();
                    const inFrustum = boundingInfo.isInFrustum(frustumPlanes);

                    let resolvedVisible = inFrustum;

                    if (inFrustum && occluders.length > 0) {
                        const center = boundingInfo.boundingSphere.centerWorld;
                        const delta = center.subtract(camPos);
                        const dist = delta.length();

                        if (dist > 15) {
                            const ray = new BABYLON.Ray(camPos, delta.normalizeToNew(), dist - 0.5);
                            const hit = scene.pickWithRay(ray, m => occluders.indexOf(m) !== -1);
                            if (hit && hit.hit && hit.pickedMesh) {
                                resolvedVisible = false;
                            }
                        }
                    }

                    const isCustom = mesh.name.includes("customInstance") || mesh.name.includes("customHitbox");
                    const finalVisible = resolvedVisible;

                    mesh.isVisible = isCustom ? false : finalVisible;

                    const children = mesh.getChildMeshes();
                    for (let j = 0; j < children.length; j++) {
                        children[j].isVisible = finalVisible;
                    }
                }
            },

            handlePhysicsSleeping: function () {
                if (!isPhysicsSleepingEnabled) return;
                const now = performance.now();
                const sleepRadius = 0.05;

                for (let i = 0; i < spawnedMeshes.length; i++) {
                    const mesh = spawnedMeshes[i];
                    if (!mesh || mesh.isDisposed() || !mesh.physicsImpostor) continue;

                    if (mesh.metadata && mesh.metadata.originalMass === 0) continue;

                    if (!mesh.metadata) mesh.metadata = {};

                    if (!mesh.metadata.anchorPosition) {
                        mesh.metadata.anchorPosition = mesh.position.clone();
                        mesh.metadata.lastMovedTime = now;
                        mesh.metadata.isSleeping = false;
                        continue;
                    }

                    const distFromAnchor = BABYLON.Vector3.Distance(mesh.position, mesh.metadata.anchorPosition);

                    if (distFromAnchor > sleepRadius) {
                        mesh.metadata.anchorPosition.copyFrom(mesh.position);
                        mesh.metadata.lastMovedTime = now;

                        if (mesh.metadata.isSleeping) {
                            mesh.physicsImpostor.wakeUp();
                            mesh.metadata.isSleeping = false;
                        }
                    } else {
                        if (!mesh.metadata.isSleeping && (now - mesh.metadata.lastMovedTime > 10000)) {
                            mesh.physicsImpostor.sleep();
                            mesh.metadata.isSleeping = true;
                        }
                    }
                }
            },

            handleInput: function () {
                if (!this.cameraFree) return;

                const cam = this.cameraFree;
                const scene = this.scene;

                if (isFreeFlyMode) {
                    const moveSpeed = 0.5;
                    if (moveState.up) cam.position.addInPlace(cam.getDirection(BABYLON.Vector3.Forward()).scale(moveSpeed));
                    if (moveState.down) cam.position.addInPlace(cam.getDirection(BABYLON.Vector3.Backward()).scale(moveSpeed));
                    if (moveState.left) cam.position.addInPlace(cam.getDirection(BABYLON.Vector3.Left()).scale(moveSpeed));
                    if (moveState.right) cam.position.addInPlace(cam.getDirection(BABYLON.Vector3.Right()).scale(moveSpeed));
                    return;
                }

                const body = this.playerBody;
                if (!body || body.isDisposed() || !body.physicsImpostor) return;

                const moveSpeed = 19.0;

                const forward = cam.getDirection(BABYLON.Vector3.Forward());
                forward.y = 0; forward.normalize();
                const right = cam.getDirection(BABYLON.Vector3.Right());
                right.y = 0; right.normalize();

                const moveDir = new BABYLON.Vector3(0, 0, 0);
                if (moveState.up) moveDir.addInPlace(forward);
                if (moveState.down) moveDir.addInPlace(forward.scale(-1));
                if (moveState.left) moveDir.addInPlace(right.scale(-1));
                if (moveState.right) moveDir.addInPlace(right);

                const curVel = body.physicsImpostor.getLinearVelocity();

                const feetY = body.position.y - playerHeight / 2;
                const groundRay = new BABYLON.Ray(
                    new BABYLON.Vector3(body.position.x, feetY + 0.15, body.position.z),
                    new BABYLON.Vector3(0, -1, 0),
                    0.35
                );
                const groundHit = scene.pickWithRay(groundRay, (m) => {
                    if (!m || !m.isEnabled() || !m.isPickable) return false;
                    if (m === body) return false;
                    if (m === heldMesh) return false;
                    if (m.name === 'waterVolume' || m.name === 'voidPlatform' || m.name === 'sunMesh') return false;
                    return true;
                });
                playerGrounded = !!(groundHit && groundHit.hit);

                if (!playerGrounded) {
                    const sunkRay = new BABYLON.Ray(
                        new BABYLON.Vector3(body.position.x, body.position.y + playerHeight, body.position.z),
                        new BABYLON.Vector3(0, -1, 0),
                        playerHeight * 3
                    );
                    const sunkHit = scene.pickWithRay(sunkRay, (m) => {
                        if (!m || !m.isEnabled() || !m.isPickable) return false;
                        if (m === body) return false;
                        if (m === heldMesh) return false;
                        if (m.name === 'waterVolume' || m.name === 'voidPlatform' || m.name === 'sunMesh') return false;
                        return true;
                    });
                    if (sunkHit && sunkHit.hit && sunkHit.pickedPoint) {
                        const surfaceY = sunkHit.pickedPoint.y;
                        if (surfaceY > feetY + 0.05) {
                            body.position.y = surfaceY + playerHeight / 2 + 0.15;
                            body.physicsImpostor.setLinearVelocity(BABYLON.Vector3.Zero());
                            body.physicsImpostor.setAngularVelocity(BABYLON.Vector3.Zero());
                            playerGrounded = true;
                        }
                    }
                }

                const hasInput = moveDir.lengthSquared() > 0.0001;

                let targetVX = 0;
                let targetVZ = 0;
                if (hasInput) {
                    moveDir.normalize();
                    targetVX = moveDir.x * moveSpeed;
                    targetVZ = moveDir.z * moveSpeed;
                }

                let targetVY = curVel.y;

                if (jumpRequested) {
                    if (playerGrounded) {
                        targetVY = 8;
                        jumpCooldownFrames = 20;
                    }
                    jumpRequested = false;
                } else if (playerGrounded && targetVY > 0 && jumpCooldownFrames <= 0) {
                    targetVY = 0;
                }

                if (jumpCooldownFrames > 0) jumpCooldownFrames--;

                body.physicsImpostor.wakeUp();
                body.physicsImpostor.setLinearVelocity(
                    new BABYLON.Vector3(targetVX, targetVY, targetVZ)
                );
                body.physicsImpostor.setAngularVelocity(BABYLON.Vector3.Zero());

                if (body.position.y < -50) {
                    body.position = new BABYLON.Vector3(0, playerHeight / 2 + 0.5, -40);
                    body.physicsImpostor.setLinearVelocity(BABYLON.Vector3.Zero());
                    body.physicsImpostor.setAngularVelocity(BABYLON.Vector3.Zero());
                }
            },

            createPillars: function (scene) {
                const mat = new BABYLON.StandardMaterial("pillarMat", scene);
                mat.diffuseColor = new BABYLON.Color3(0.3, 0.3, 0.35);

                for (let i = 0; i < 25; i++) {
                    const pillar = BABYLON.MeshBuilder.CreateBox("pillar", { width: 4, height: 15, depth: 4 }, scene);

                    let posX = Math.random() * 500 - 250;
                    let posZ = Math.random() * 500 - 250;

                    pillar.position = new BABYLON.Vector3(posX, 7.5, posZ);

                    const pMat = new BABYLON.StandardMaterial("pMat", scene);
                    pMat.diffuseColor = new BABYLON.Color3(0.4, 0.4, 0.4);
                    pillar.material = pMat;

                    pillar.physicsImpostor = new BABYLON.PhysicsImpostor(pillar, BABYLON.PhysicsImpostor.BoxImpostor, {
                        mass: 0,
                        restitution: 0.1,
                        friction: 0.5
                    }, scene);
                }
            },

            createBackgroundDecorations: function (scene) {
                const colors = [
                    new BABYLON.Color3(0.2, 0.3, 0.5),
                    new BABYLON.Color3(0.5, 0.2, 0.3),
                    new BABYLON.Color3(0.3, 0.5, 0.2),
                    new BABYLON.Color3(0.6, 0.4, 0.1),
                    new BABYLON.Color3(0.4, 0.2, 0.6),
                    new BABYLON.Color3(0.1, 0.6, 0.6),
                    new BABYLON.Color3(0.7, 0.3, 0.3)
                ];

                const shapes = ['box', 'sphere', 'cylinder', 'torus'];
                const count = 80;

                for (let i = 0; i < count; i++) {
                    const shapeType = shapes[Math.floor(Math.random() * shapes.length)];

                    const angle = Math.random() * Math.PI * 2;
                    const radius = 350 + Math.random() * 450;
                    const x = Math.cos(angle) * radius;
                    const z = Math.sin(angle) * radius;
                    const y = -30 + Math.random() * 180;

                    let scaleX = 1 + Math.random() * 4;
                    let scaleY = 1 + Math.random() * 6;
                    let scaleZ = 1 + Math.random() * 4;
                    if (shapeType === 'sphere') scaleX = scaleY = scaleZ = 1 + Math.random() * 3;
                    if (shapeType === 'torus') scaleX = scaleY = scaleZ = 1 + Math.random() * 2;

                    let mesh;
                    switch (shapeType) {
                        case 'box':
                            mesh = BABYLON.MeshBuilder.CreateBox(`bg_${i}`, { width: 1, height: 1, depth: 1 }, scene);
                            break;
                        case 'sphere':
                            mesh = BABYLON.MeshBuilder.CreateSphere(`bg_${i}`, { diameter: 1 }, scene);
                            break;
                        case 'cylinder':
                            mesh = BABYLON.MeshBuilder.CreateCylinder(`bg_${i}`, { height: 1, diameter: 0.8 }, scene);
                            break;
                        case 'torus':
                            mesh = BABYLON.MeshBuilder.CreateTorus(`bg_${i}`, { diameter: 1, thickness: 0.2 }, scene);
                            break;
                    }

                    mesh.scaling = new BABYLON.Vector3(scaleX, scaleY, scaleZ);
                    mesh.position = new BABYLON.Vector3(x, y, z);

                    const color = colors[Math.floor(Math.random() * colors.length)];
                    const mat = new BABYLON.StandardMaterial(`bgMat_${i}`, scene);
                    mat.diffuseColor = color;
                    mat.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1);
                    mat.emissiveColor = color.scale(0.3);
                    mesh.material = mat;

                    mesh.isPickable = false;
                    mesh.alwaysSelectAsActiveMesh = false;

                    if (Math.random() > 0.7) {
                        const rotSpeed = (Math.random() - 0.5) * 0.01;
                        scene.registerBeforeRender(() => {
                            if (!mesh || mesh.isDisposed()) return;
                            mesh.rotate(BABYLON.Axis.Y, rotSpeed, BABYLON.Space.WORLD);
                            if (shapeType === 'torus') {
                                mesh.rotate(BABYLON.Axis.X, rotSpeed * 0.5, BABYLON.Space.LOCAL);
                            }
                        });
                    }
                }

                const platformCount = 20;
                for (let i = 0; i < platformCount; i++) {
                    const angle = Math.random() * Math.PI * 2;
                    const radius = 400 + Math.random() * 300;
                    const x = Math.cos(angle) * radius;
                    const z = Math.sin(angle) * radius;
                    const y = 20 + Math.random() * 100;

                    const platform = BABYLON.MeshBuilder.CreateDisc(`platform_${i}`, { radius: 3 + Math.random() * 5, tessellation: 16 }, scene);
                    platform.position = new BABYLON.Vector3(x, y, z);
                    platform.rotation.x = Math.PI / 2;
                    const platMat = new BABYLON.StandardMaterial(`platMat_${i}`, scene);
                    platMat.diffuseColor = new BABYLON.Color3(0.2, 0.2, 0.4);
                    platMat.emissiveColor = new BABYLON.Color3(0.1, 0.1, 0.3);
                    platMat.alpha = 0.6;
                    platform.material = platMat;
                    platform.isPickable = false;
                    platform.alwaysSelectAsActiveMesh = false;
                }
            },

            createBackgroundPillars: function (scene) {
                const pillarCount = 80;
                const bgPillarMat = new BABYLON.StandardMaterial("bgPillarMat", scene);
                bgPillarMat.diffuseColor = new BABYLON.Color3(0.12, 0.12, 0.15);
                bgPillarMat.specularColor = new BABYLON.Color3(0.02, 0.02, 0.02);

                for (let i = 0; i < pillarCount; i++) {
                    const topHeight = 100 + Math.random() * 500;
                    const height = 10000 + topHeight;
                    const size = 15 + Math.random() * 30;

                    const pillar = BABYLON.MeshBuilder.CreateBox("bgPillar_" + i, { width: size, height: height, depth: size }, scene);

                    const angle = Math.random() * Math.PI * 2;
                    const radius = 500 + Math.random() * 1000;

                    const posX = Math.cos(angle) * radius;
                    const posZ = Math.sin(angle) * radius;

                    pillar.position = new BABYLON.Vector3(posX, -10000 + (height / 2), posZ);
                    pillar.material = bgPillarMat;

                    pillar.isPickable = false;
                    pillar.alwaysSelectAsActiveMesh = false;
                    pillar.checkCollisions = false;
                }
            },

            createStairs: function (scene) {
                const stepCount = 12;
                const stepWidth = 60;
                const stepHeight = 3;
                const stepDepth = 5;
                const originX = 150;
                const originZ = 150;

                const stairMat = new BABYLON.StandardMaterial("stairMat", scene);
                stairMat.diffuseColor = new BABYLON.Color3(0.22, 0.22, 0.28);
                stairMat.specularColor = new BABYLON.Color3(0.05, 0.05, 0.05);

                for (let i = 0; i < stepCount; i++) {
                    const step = BABYLON.MeshBuilder.CreateBox("stair_step_" + i, {
                        width: stepWidth,
                        height: stepHeight,
                        depth: stepDepth
                    }, scene);

                    step.position = new BABYLON.Vector3(
                        originX,
                        (stepHeight * 0.5) + (i * stepHeight),
                        originZ + (i * stepDepth)
                    );

                    step.material = stairMat;

                    step.physicsImpostor = new BABYLON.PhysicsImpostor(
                        step,
                        BABYLON.PhysicsImpostor.BoxImpostor,
                        { mass: 0, restitution: 0.1, friction: 0.8 },
                        scene
                    );

                    step.isPickable = true;
                    this.MirrorSystem.addToRenderList(step);
                }
            },

            createSpiralStairs: function (scene) {
                const totalSteps = 160;
                const totalHeight = 270;
                const stepHeight = totalHeight / totalSteps;
                const innerRadius = 6;
                const outerRadius = 28;
                const treadLength = outerRadius - innerRadius;
                const midRadius = innerRadius + treadLength * 0.5;
                const angleStep = (Math.PI * 2) / 14;
                const treadWidth = (2 * Math.PI * midRadius / 14) * 1.15;

                const centerX = 60;
                const centerZ = 180;

                const coreMat = new BABYLON.StandardMaterial("spiralCoreMat", scene);
                coreMat.diffuseColor = new BABYLON.Color3(0.18, 0.18, 0.23);
                coreMat.specularColor = new BABYLON.Color3(0.05, 0.05, 0.05);

                const coreColumn = BABYLON.MeshBuilder.CreateCylinder("spiral_stair_core", {
                    height: totalHeight + 6,
                    diameter: innerRadius * 2,
                    tessellation: 24
                }, scene);
                coreColumn.position = new BABYLON.Vector3(centerX, (totalHeight + 6) * 0.5, centerZ);
                coreColumn.material = coreMat;
                coreColumn.physicsImpostor = new BABYLON.PhysicsImpostor(
                    coreColumn,
                    BABYLON.PhysicsImpostor.CylinderImpostor,
                    { mass: 0, restitution: 0.1, friction: 0.8 },
                    scene
                );
                coreColumn.isPickable = true;
                this.MirrorSystem.addToRenderList(coreColumn);

                const spiralMat = new BABYLON.StandardMaterial("spiralStairMat", scene);
                spiralMat.diffuseColor = new BABYLON.Color3(0.28, 0.26, 0.34);
                spiralMat.specularColor = new BABYLON.Color3(0.08, 0.08, 0.08);

                for (let i = 0; i < totalSteps; i++) {
                    const angle = i * angleStep;
                    const stepY = (stepHeight * 0.5) + (i * stepHeight);
                    const stepX = centerX + Math.cos(angle) * midRadius;
                    const stepZ = centerZ + Math.sin(angle) * midRadius;

                    const step = BABYLON.MeshBuilder.CreateBox("spiral_stair_step_" + i, {
                        width: treadLength,
                        height: stepHeight,
                        depth: treadWidth
                    }, scene);

                    step.position = new BABYLON.Vector3(stepX, stepY, stepZ);
                    step.rotation.y = -angle;
                    step.material = spiralMat;

                    step.physicsImpostor = new BABYLON.PhysicsImpostor(
                        step,
                        BABYLON.PhysicsImpostor.BoxImpostor,
                        { mass: 0, restitution: 0.1, friction: 0.8 },
                        scene
                    );

                    step.isPickable = true;
                    this.MirrorSystem.addToRenderList(step);
                }
            },

            getCenterPick: function () {
                if (!this.scene || !this.cameraFree) return null;
                const ray = this.cameraFree.getForwardRay();
                return this.scene.pickWithRay(ray, (m) => m && m.isPickable && m.isEnabled());
            },

            setupInteraction: function (scene) {
                scene.onBeforeRenderObservable.add(() => {
                    if (heldMesh && !heldMesh.isDisposed()) {
                        const cam = this.cameraFree;
                        const targetPos = cam.position.add(cam.getDirection(BABYLON.Vector3.Forward()).scale(holdDistance));
                        heldMesh.position = BABYLON.Vector3.Lerp(heldMesh.position, targetPos, 0.15);
                        if (heldMesh.physicsImpostor) {
                            heldMesh.physicsImpostor.setLinearVelocity(BABYLON.Vector3.Zero());
                            heldMesh.physicsImpostor.setAngularVelocity(BABYLON.Vector3.Zero());
                            heldMesh.physicsImpostor.forceUpdate();
                        }
                    }

                    for (let i = 0; i < spawnedMeshes.length; i++) {
                        const m = spawnedMeshes[i];
                        if (!m || m.isDisposed() || !m.metadata || !m.physicsImpostor) continue;
                        if (m.metadata.pendingReleaseWake) {
                            m.metadata.pendingReleaseWake = false;
                            m.physicsImpostor.setLinearVelocity(BABYLON.Vector3.Zero());
                            m.physicsImpostor.setAngularVelocity(BABYLON.Vector3.Zero());
                            m.physicsImpostor.wakeUp();
                            m.physicsImpostor.setLinearVelocity(BABYLON.Vector3.Zero());
                            m.physicsImpostor.setAngularVelocity(BABYLON.Vector3.Zero());
                        }

                        if (m.metadata.releaseGraceFrames > 0) {
                            m.metadata.releaseGraceFrames--;
                            const vel = m.physicsImpostor.getLinearVelocity();
                            if (vel) {
                                const sq = vel.x * vel.x + vel.y * vel.y + vel.z * vel.z;
                                if (sq > 1) {
                                    const s = Math.sqrt(sq);
                                    const k = 1 / s;
                                    m.physicsImpostor.setLinearVelocity(new BABYLON.Vector3(vel.x * k, vel.y * k, vel.z * k));
                                }
                            }
                            m.physicsImpostor.setAngularVelocity(BABYLON.Vector3.Zero());
                        }
                    }
                });

                scene.onPointerObservable.add((pointerInfo) => {
                    if (pointerInfo.type !== BABYLON.PointerEventTypes.POINTERTAP) return;
                    if (heldMesh && !heldMesh.isDisposed()) return;

                    const pickInfo = this.getCenterPick();
                    if (!pickInfo || !pickInfo.hit || !pickInfo.pickedMesh) return;

                    let mesh = pickInfo.pickedMesh;
                    if (mesh.parent && (mesh.parent.name.includes("customHitbox") || mesh.parent.name.includes("customInstance"))) {
                        mesh = mesh.parent;
                    }

                    if (selectedShape === 'eraser') {
                        const isStaticMap =
                            mesh.name === "ground" ||
                            mesh.name === "ramp" ||
                            mesh.name === "pillar" ||
                            mesh.name === "poolFloor" ||
                            mesh.name === "wallN" ||
                            mesh.name === "wallS" ||
                            mesh.name === "wallE" ||
                            mesh.name === "wallW" ||
                            mesh.name.startsWith("stair_step_");
                        if (isStaticMap) return;
                        if (mesh === heldMesh) {
                            heldMesh = null;
                            const _gb = document.getElementById('btn-grab');
                            if (_gb) { _gb.textContent = 'GRAB'; _gb.classList.remove('grabbing'); }
                            const _cur = document.getElementById('center-cursor');
                            if (_cur) _cur.classList.remove('grabbing');
                            updateGrabbedControls();
                        }
                        mesh.dispose();
                        const index = spawnedMeshes.indexOf(mesh);
                        if (index > -1) spawnedMeshes.splice(index, 1);
                        return;
                    }

                    if (mesh.name === "drainButton" || mesh.name === "drainButtonBase") return;

                    if (selectedShape === 'structure') {
                        this.spawnStructure(pickInfo, scene);
                        return;
                    }

                    this.spawnObject(selectedShape, pickInfo, scene);
                });

                window.addEventListener("contextmenu", e => e.preventDefault());
            },

            spawnObject: function (type, pickInfo, scene) {
                const normal = pickInfo.getNormal(true);
                if (!normal) return;

                let mesh;
                let mat;
                const isGlass = type.startsWith('glass_');
                const isMirror = type.startsWith('mirror_');
                const isCustom = type.startsWith('custom_');
                let baseType = type;
                if (isGlass) baseType = type.replace('glass_', '');
                if (isMirror) baseType = type.replace('mirror_', '');
                if (isCustom) baseType = 'custom';

                const pickerVal = document.getElementById('color-picker').value;
                const baseColor = BABYLON.Color3.FromHexString(pickerVal);

                if (isGlass) {
                    mat = new BABYLON.PBRMaterial("glassMat" + Date.now(), scene);
                    mat.metallic = 0.0;
                    mat.roughness = 0.05;
                    mat.alpha = 0.45;
                    mat.subSurface.isRefractionEnabled = true;
                    mat.subSurface.indexOfRefraction = 1.5;
                    mat.albedoColor = baseColor;
                } else if (isMirror) {
                    mat = new BABYLON.PBRMaterial("mirrorMat" + Date.now(), scene);
                    mat.metallic = 1.0;
                    mat.roughness = 1.0 - currentReflectivity;
                    mat.albedoColor = baseColor;
                    if (workshop.shaman.sandbox3d.MirrorSystem.probe) {
                        mat.reflectionTexture = workshop.shaman.sandbox3d.MirrorSystem.probe.cubeTexture;
                    }
                } else {
                    mat = new BABYLON.StandardMaterial("objMat" + Date.now(), scene);
                    mat.diffuseColor = baseColor;
                }

                const scale = currentSize;
                let spawnPos;
                if (isBuildMode) {
                    const gridSize = scale;
                    const nudged = pickInfo.pickedPoint.add(normal.scale(0.01));
                    spawnPos = new BABYLON.Vector3(
                        Math.floor(nudged.x / gridSize) * gridSize + gridSize / 2,
                        Math.floor(nudged.y / gridSize) * gridSize + gridSize / 2,
                        Math.floor(nudged.z / gridSize) * gridSize + gridSize / 2
                    );
                } else {
                    const pivotOffset = scale * 0.5 + 0.01;
                    spawnPos = pickInfo.pickedPoint.add(normal.scale(pivotOffset));
                }

                const customIdx = type.startsWith('custom_') ? parseInt(type.split('_')[1]) : -1;
                const customSlot = customIdx >= 0 ? customModelTemplates[customIdx] : null;
                if (customSlot) {
                    mesh = customSlot.mesh.instantiateHierarchy(null, { doNotInstantiate: true });
                    mesh.name = "customInstance_" + Date.now();
                    mesh.alwaysSelectAsActiveMesh = false;
                    mesh.getChildMeshes().forEach(c => c.alwaysSelectAsActiveMesh = false);
                    mesh.setEnabled(true);
                    mesh.scaling = new BABYLON.Vector3(scale, scale, scale);
                    if (isBuildMode) {
                        mesh.position = spawnPos.clone();
                    } else {
                        const customOffset = (customSlot.dimensions.height * scale) / 2;
                        mesh.position = pickInfo.pickedPoint.add(normal.scale(customOffset));
                    }
                }
                else if (baseType === 'box') {
                    mesh = BABYLON.MeshBuilder.CreateBox(isGlass ? "glass_box" : (isMirror ? "mirror_box" : "box"), { size: scale }, scene);
                    mesh.position.copyFrom(spawnPos);
                }
                else if (baseType === 'sphere') {
                    mesh = BABYLON.MeshBuilder.CreateSphere(isGlass ? "glass_sphere" : (isMirror ? "mirror_sphere" : "sphere"), { diameter: scale }, scene);
                    mesh.position.copyFrom(spawnPos);
                }
                else if (baseType === 'cylinder') {
                    mesh = BABYLON.MeshBuilder.CreateCylinder(isGlass ? "glass_cyl" : "cyl", { height: scale, diameter: scale / 2 }, scene);
                    mesh.position.copyFrom(spawnPos);

                    if (isBuildMode) {
                        const ax = Math.abs(normal.x);
                        const ay = Math.abs(normal.y);
                        const az = Math.abs(normal.z);

                        if (ay >= ax && ay >= az) {
                            mesh.rotation.x = 0;
                            mesh.rotation.y = 0;
                            mesh.rotation.z = 0;
                        } else if (ax >= az) {
                            mesh.rotation.x = 0;
                            mesh.rotation.y = 0;
                            mesh.rotation.z = Math.PI / 2;
                        } else {
                            mesh.rotation.x = Math.PI / 2;
                            mesh.rotation.y = 0;
                            mesh.rotation.z = 0;
                        }
                    }
                }
                else if (baseType === 'triangle') {
                    mesh = BABYLON.MeshBuilder.CreateCylinder(isGlass ? "glass_tri" : "tri", { height: scale, diameter: scale, tessellation: 3 }, scene);
                    mesh.position.copyFrom(spawnPos);
                }
                else if (baseType === 'bomb' || baseType === 'frag_bomb' || baseType === 'fire_bomb' || baseType === 'ice_bomb') {
                    mesh = BABYLON.MeshBuilder.CreateSphere(baseType, { diameter: scale }, scene);
                    mesh.position.copyFrom(spawnPos);
                    mat.diffuseColor = new BABYLON.Color3(0.1, 0.1, 0.1);

                    if (baseType === 'frag_bomb') mat.emissiveColor = new BABYLON.Color3(0.3, 0.1, 0);
                    else if (baseType === 'fire_bomb') mat.emissiveColor = new BABYLON.Color3(0.8, 0.3, 0.1);
                    else if (baseType === 'ice_bomb') mat.emissiveColor = new BABYLON.Color3(0.1, 0.6, 0.9);
                    else mat.emissiveColor = new BABYLON.Color3(0.1, 0, 0);
                }
                else if (baseType === 'flashbang') {
                    mesh = BABYLON.MeshBuilder.CreateCylinder("flashbang", { height: scale * 1.5, diameter: scale * 0.5 }, scene);
                    mesh.position.copyFrom(spawnPos);
                    mat.diffuseColor = new BABYLON.Color3(0.8, 0.8, 0.8);
                    mat.emissiveColor = new BABYLON.Color3(0.2, 0.2, 0);
                }
                else if (baseType === 'pyramid') {
                    mesh = BABYLON.MeshBuilder.CreateCylinder("pyramid", {
                        height: scale,
                        diameterTop: 0,
                        diameterBottom: scale,
                        tessellation: 4
                    }, scene);
                    mesh.position.copyFrom(spawnPos);
                }
                else if (baseType === 'torus') {
                    mesh = BABYLON.MeshBuilder.CreateTorus("torus", {
                        diameter: scale,
                        thickness: scale * 0.3,
                        tessellation: 24
                    }, scene);
                    mesh.position.copyFrom(spawnPos);
                }
                else if (baseType === 'ice_mat') {
                    mesh = BABYLON.MeshBuilder.CreateBox("ice_mat", { size: scale }, scene);
                    mesh.position.copyFrom(spawnPos);
                    mat = new BABYLON.PBRMaterial("iceMat" + Date.now(), scene);
                    mat.metallic = 0.0;
                    mat.roughness = 0.02;
                    mat.alpha = 0.75;
                    mat.subSurface.isRefractionEnabled = true;
                    mat.subSurface.indexOfRefraction = 1.31;
                    mat.albedoColor = new BABYLON.Color3(0.6, 0.9, 1.0);
                    mat.emissiveColor = new BABYLON.Color3(0.05, 0.2, 0.3);
                    mesh.metadata = mesh.metadata || {};
                    mesh.metadata.isIceMat = true;
                }
                else if (baseType === 'rubber_mat') {
                    mesh = BABYLON.MeshBuilder.CreateSphere("rubber_mat", { diameter: scale }, scene);
                    mesh.position.copyFrom(spawnPos);
                    mat = new BABYLON.StandardMaterial("rubberMat" + Date.now(), scene);
                    mat.diffuseColor = new BABYLON.Color3(0.15, 0.15, 0.15);
                    mat.specularColor = new BABYLON.Color3(0, 0, 0);
                    mesh.metadata = mesh.metadata || {};
                    mesh.metadata.isRubberMat = true;
                }

                if (mesh) {
                    if (baseType !== 'custom') mesh.material = mat;

                    let massVal = isBuildMode ? 0 : currentMass;

                    if (isBuildMode) {
                        mesh.metadata = mesh.metadata || {};
                        mesh.metadata.isBuildObj = true;
                        mesh.metadata.buildGrid = scale;
                    }

                    if (baseType === 'custom' && customSlot) {
                        mesh.physicsImpostor = new BABYLON.PhysicsImpostor(mesh, BABYLON.PhysicsImpostor.BoxImpostor, { mass: isBuildMode ? 0 : 5 * scale, restitution: 0.1, friction: 0.5 }, scene);
                    }
                    else if (baseType === 'box') {
                        mesh.physicsImpostor = new BABYLON.PhysicsImpostor(mesh, BABYLON.PhysicsImpostor.BoxImpostor, { mass: massVal, restitution: 0.1, friction: 0.8 }, scene);
                    } else if (baseType === 'sphere' || baseType.includes('bomb')) {
                        mesh.physicsImpostor = new BABYLON.PhysicsImpostor(mesh, BABYLON.PhysicsImpostor.SphereImpostor, { mass: massVal, restitution: 0.4, friction: 0.5 }, scene);
                    } else if (baseType === 'cylinder' || baseType === 'triangle') {
                        mesh.physicsImpostor = new BABYLON.PhysicsImpostor(mesh, BABYLON.PhysicsImpostor.CylinderImpostor, { mass: massVal, restitution: 0.1, friction: 0.8 }, scene);
                    }
                    else if (baseType === 'flashbang') {
                        mesh.physicsImpostor = new BABYLON.PhysicsImpostor(mesh, BABYLON.PhysicsImpostor.CylinderImpostor, { mass: massVal, restitution: 0.3, friction: 0.5 }, scene);
                        this.armBomb(mesh, scene, false, true);
                    }
                    else if (baseType === 'pyramid') {
                        mesh.physicsImpostor = new BABYLON.PhysicsImpostor(
                            mesh, BABYLON.PhysicsImpostor.CylinderImpostor,
                            { mass: massVal, restitution: 0.15, friction: 0.75 }, scene
                        );
                    }
                    else if (baseType === 'torus') {
                        mesh.physicsImpostor = new BABYLON.PhysicsImpostor(
                            mesh, BABYLON.PhysicsImpostor.SphereImpostor,
                            { mass: massVal, restitution: 0.5, friction: 0.3 }, scene
                        );
                    }
                    else if (baseType === 'ice_mat') {
                        mesh.physicsImpostor = new BABYLON.PhysicsImpostor(
                            mesh, BABYLON.PhysicsImpostor.BoxImpostor,
                            { mass: massVal, restitution: 0.6, friction: 0.01 }, scene
                        );
                    }
                    else if (baseType === 'rubber_mat') {
                        mesh.physicsImpostor = new BABYLON.PhysicsImpostor(
                            mesh, BABYLON.PhysicsImpostor.SphereImpostor,
                            { mass: massVal * 0.4, restitution: 0.92, friction: 0.6 }, scene
                        );
                    }

                    if (baseType.includes('bomb')) {
                        mesh.metadata = mesh.metadata || {};
                        mesh.metadata.bombMass = currentMass;
                        mesh.metadata.bombSize = currentSize;
                        mesh.metadata.bombType = baseType;
                        this.armBomb(mesh, scene, baseType === 'frag_bomb');
                    }

                    spawnParticleBurst(mesh.position, scene);
                    spawnedMeshes.push(mesh);
                    if (!isMirror && !isGlass) {
                        workshop.shaman.sandbox3d.MirrorSystem.addToRenderList(mesh);
                    }
                }
            },

            spawnStructure: function (pickInfo, scene) {
                const normal = pickInfo.getNormal(true);
                if (!normal) return;

                let dimX = parseInt(document.getElementById('struct-x').value) || 1;
                let dimY = parseInt(document.getElementById('struct-y').value) || 1;
                let dimZ = parseInt(document.getElementById('struct-z').value) || 1;

                if (dimX > 10) dimX = 10;
                if (dimY > 10) dimY = 10;
                if (dimZ > 10) dimZ = 10;

                const shapeType = document.getElementById('struct-shape').value;
                const scale = currentSize;

                const gap = scale * 1.02;
                const startPos = pickInfo.pickedPoint.add(normal.scale(scale / 2));

                for (let x = 0; x < dimX; x++) {
                    for (let y = 0; y < dimY; y++) {
                        for (let z = 0; z < dimZ; z++) {
                            const offsetX = (x - dimX / 2) * gap;
                            const offsetY = y * gap;    
                            const offsetZ = (z - dimZ / 2) * gap;
                            const spawnPos = startPos.add(new BABYLON.Vector3(offsetX, offsetY, offsetZ));

                            this.createSingleBlock(shapeType, spawnPos, scale, scene);
                        }
                    }
                }
            },

            createSingleBlock: function (type, position, scale, scene) {
                let mesh;
                let mat;
                const isGlass = type.startsWith('glass_');
                const isMirror = type.startsWith('mirror_');
                let baseType = type;
                if (isGlass) baseType = type.replace('glass_', '');
                if (isMirror) baseType = type.replace('mirror_', '');

                const pickerVal = document.getElementById('color-picker').value;
                const baseColor = BABYLON.Color3.FromHexString(pickerVal);

                if (isGlass) {
                    mat = new BABYLON.PBRMaterial("structGlassMat" + Date.now() + Math.random(), scene);
                    mat.metallic = 0.0;
                    mat.roughness = 0.05;
                    mat.alpha = 0.45;
                    mat.subSurface.isRefractionEnabled = true;
                    mat.subSurface.indexOfRefraction = 1.5;
                    mat.albedoColor = baseColor;
                } else if (isMirror) {
                    mat = new BABYLON.PBRMaterial("structMirrorMat" + Date.now() + Math.random(), scene);
                    mat.metallic = 1.0;
                    mat.roughness = 1.0 - currentReflectivity;
                    mat.albedoColor = baseColor;
                    if (workshop.shaman.sandbox3d.MirrorSystem.probe) {
                        mat.reflectionTexture = workshop.shaman.sandbox3d.MirrorSystem.probe.cubeTexture;
                    }
                } else {
                    mat = new BABYLON.StandardMaterial("structMat" + Date.now() + Math.random(), scene);
                    mat.diffuseColor = baseColor;
                }

                if (baseType === 'box') mesh = BABYLON.MeshBuilder.CreateBox(isGlass ? "s_glass_box" : (isMirror ? "s_mirror_box" : "s_box"), { size: scale }, scene);
                else if (baseType === 'sphere') mesh = BABYLON.MeshBuilder.CreateSphere(isGlass ? "s_glass_sphere" : (isMirror ? "s_mirror_sphere" : "s_sphere"), { diameter: scale }, scene);
                else if (baseType === 'cylinder') mesh = BABYLON.MeshBuilder.CreateCylinder(isGlass ? "s_glass_cyl" : (isMirror ? "s_mirror_cyl" : "s_cyl"), { height: scale, diameter: scale / 2 }, scene);
                else if (baseType === 'triangle') mesh = BABYLON.MeshBuilder.CreateCylinder(isGlass ? "s_glass_tri" : (isMirror ? "s_mirror_tri" : "s_tri"), { height: scale, diameter: scale, tessellation: 3 }, scene);
                if (baseType === 'pyramid') impostorType = BABYLON.PhysicsImpostor.CylinderImpostor;
                if (baseType === 'torus') impostorType = BABYLON.PhysicsImpostor.SphereImpostor;
                if (baseType === 'ice_mat') impostorType = BABYLON.PhysicsImpostor.BoxImpostor;
                if (baseType === 'rubber_mat') impostorType = BABYLON.PhysicsImpostor.SphereImpostor;

                if (mesh) {
                    mesh.position = position;
                    mesh.material = mat;

                    let impostorType = BABYLON.PhysicsImpostor.BoxImpostor;
                    if (baseType === 'sphere') impostorType = BABYLON.PhysicsImpostor.SphereImpostor;
                    if (baseType === 'cylinder' || baseType === 'triangle') impostorType = BABYLON.PhysicsImpostor.CylinderImpostor;
                    else if (baseType === 'pyramid') mesh = BABYLON.MeshBuilder.CreateCylinder(
                        "s_pyramid", { height: scale, diameterTop: 0, diameterBottom: scale, tessellation: 4 }, scene
                    );
                    else if (baseType === 'torus') mesh = BABYLON.MeshBuilder.CreateTorus(
                        "s_torus", { diameter: scale, thickness: scale * 0.3, tessellation: 24 }, scene
                    );
                    else if (baseType === 'ice_mat') mesh = BABYLON.MeshBuilder.CreateBox("s_ice", { size: scale }, scene);
                    else if (baseType === 'rubber_mat') mesh = BABYLON.MeshBuilder.CreateSphere("s_rubber", { diameter: scale }, scene);

                    const physParams = { mass: currentMass, restitution: 0.1, friction: 0.8 };
                    if (baseType === 'ice_mat') { physParams.restitution = 0.6; physParams.friction = 0.01; }
                    if (baseType === 'rubber_mat') { physParams.restitution = 0.92; physParams.friction = 0.6; physParams.mass = currentMass * 0.4; }

                    mesh.physicsImpostor = new BABYLON.PhysicsImpostor(mesh, impostorType, physParams, scene);

                    spawnParticleBurst(mesh.position, scene);
                    spawnedMeshes.push(mesh);

                    if (!isMirror && !isGlass) {
                        workshop.shaman.sandbox3d.MirrorSystem.addToRenderList(mesh);
                    }
                }
            },

            armBomb: function (bombMesh, scene, isFragment, isFlash = false) {
                let flashCount = 0;
                const bType = bombMesh.metadata?.bombType || 'bomb';
                const flashInterval = setInterval(() => {
                    if (!bombMesh || bombMesh.isDisposed()) { clearInterval(flashInterval); return; }

                    let colorOn = new BABYLON.Color3(1, 0, 0);
                    if (isFragment) colorOn = new BABYLON.Color3(1, 0.5, 0);
                    if (isFlash) colorOn = new BABYLON.Color3(1, 1, 1);
                    if (bType === 'fire_bomb') colorOn = new BABYLON.Color3(1, 0.3, 0);
                    if (bType === 'ice_bomb') colorOn = new BABYLON.Color3(0.1, 0.8, 1);

                    if (flashCount % 2 === 0) bombMesh.material.emissiveColor = colorOn;
                    else bombMesh.material.emissiveColor = new BABYLON.Color3(0.1, 0.1, 0.1);
                    flashCount++;
                }, isFlash ? 200 : 500);

                setTimeout(() => {
                    clearInterval(flashInterval);
                    if (bombMesh && !bombMesh.isDisposed()) {
                        if (isFlash) this.triggerFlashbang(bombMesh.position, scene);
                        else this.explode(bombMesh.position, scene, isFragment, bombMesh.metadata?.bombSize ?? bombMesh.scaling.x, true, bombMesh.metadata?.bombMass ?? 1, bType);

                        bombMesh.dispose();
                    }
                }, isFlash ? 2500 : 4000);
            },

            explode: function (center, scene, isFragment, scaleMultiplier, playSound = true, massMultiplier = 1, bombType = 'bomb') {
                if (playSound) {
                    const snd = document.getElementById('explosion-snd');
                    if (snd) {
                        snd.currentTime = 0;
                        snd.volume = Math.min(explosionVolume, 1.0);
                        snd.play().catch(e => console.log("Audio blocked: Interaction required."));
                    }
                }
                triggerScreenShake(scaleMultiplier * (massMultiplier / 5));
                triggerHaptic(scaleMultiplier); 

                const explosion = BABYLON.MeshBuilder.CreateSphere("explosion", { diameter: 1 * scaleMultiplier }, scene);
                explosion.position = center;
                const expMat = new BABYLON.StandardMaterial("expMat", scene);

                expMat.diffuseColor = isFragment ? new BABYLON.Color3(1, 0.8, 0) : new BABYLON.Color3(1, 0.5, 0);
                expMat.emissiveColor = new BABYLON.Color3(1, 0.2, 0);

                if (bombType === 'fire_bomb') {
                    expMat.diffuseColor = new BABYLON.Color3(1, 0.3, 0);
                    expMat.emissiveColor = new BABYLON.Color3(1, 0.1, 0);
                } else if (bombType === 'ice_bomb') {
                    expMat.diffuseColor = new BABYLON.Color3(0.2, 0.8, 1);
                    expMat.emissiveColor = new BABYLON.Color3(0.1, 0.5, 1);
                }

                expMat.alpha = 0.8;
                explosion.material = expMat;

                let scale = 1;
                const anim = scene.onBeforeRenderObservable.add(() => {
                    scale += 0.8;
                    explosion.scaling = new BABYLON.Vector3(scale, scale, scale);
                    expMat.alpha -= 0.05;
                    if (expMat.alpha <= 0) {
                        scene.onBeforeRenderObservable.remove(anim);
                        explosion.dispose();
                    }
                });

                const blastRadius = 25 * scaleMultiplier;
                const blastForce = 60 * (massMultiplier / 5);

                spawnedMeshes.forEach(mesh => {
                    if (mesh && !mesh.isDisposed() && mesh.physicsImpostor) {
                        if (mesh === this.playerBody || mesh.name === 'sb3dPlayerBody') return;
                        const isFrozen = mesh.metadata && mesh.metadata.originalMass !== undefined;

                        if (isFrozen && bombType !== 'fire_bomb') return;

                        const dir = mesh.getAbsolutePosition().subtract(center);
                        const dist = dir.length();

                        if (dist < blastRadius) {
                            if (bombType === 'ice_bomb') {
                                freezeMesh(mesh, true);
                            } else {
                                if (bombType === 'fire_bomb' && isFrozen) {
                                    thawMesh(mesh);
                                }

                                dir.normalize();
                                const forceMagnitude = blastForce * (1 - dist / blastRadius);
                                const contactPoint = mesh.getAbsolutePosition();
                                const impulse = dir.scale(forceMagnitude);
                                mesh.physicsImpostor.applyImpulse(impulse, contactPoint);

                                if (bombType === 'fire_bomb') {
                                    if (mesh.metadata && mesh.metadata.isIceMat && !mesh.metadata.iceMelted) {
                                        mesh.metadata.iceMelted = true;

                                        const icePos = mesh.position.clone();

                                        const boundingInfo = mesh.getBoundingInfo();
                                        const extents = boundingInfo.boundingBox.extendSize;
                                        const scaleX = mesh.scaling.x * extents.x;
                                        const scaleY = mesh.scaling.y * extents.y;
                                        const scaleZ = mesh.scaling.z * extents.z;

                                        const volumeFactor = Math.max(0.2, scaleX * scaleY * scaleZ * 8);

                                        mesh.dispose();
                                        const index = spawnedMeshes.indexOf(mesh);
                                        if (index !== -1) spawnedMeshes.splice(index, 1);

                                        const maxParticles = Math.floor(150 * volumeFactor);
                                        const steamPS = new BABYLON.ParticleSystem("steamBurst", maxParticles, scene);
                                        steamPS.particleTexture = new BABYLON.Texture("https://assets.babylonjs.com/textures/flare.png", scene);
                                        steamPS.emitter = icePos;

                                        steamPS.minEmitBox = new BABYLON.Vector3(-scaleX, -scaleY, -scaleZ);
                                        steamPS.maxEmitBox = new BABYLON.Vector3(scaleX, scaleY, scaleZ);

                                        steamPS.color1 = new BABYLON.Color4(1.0, 1.0, 1.0, 0.4);
                                        steamPS.color2 = new BABYLON.Color4(0.9, 0.9, 0.95, 0.2);
                                        steamPS.colorDead = new BABYLON.Color4(1.0, 1.0, 1.0, 0.0);

                                        steamPS.minSize = 0.4 * Math.pow(volumeFactor, 0.33);
                                        steamPS.maxSize = 1.2 * Math.pow(volumeFactor, 0.33);

                                        steamPS.minLifeTime = 0.6;
                                        steamPS.maxLifeTime = 1.5;
                                        steamPS.emitRate = Math.floor(300 * volumeFactor);
                                        steamPS.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;

                                        steamPS.gravity = new BABYLON.Vector3(0, 2.0, 0);

                                        steamPS.direction1 = new BABYLON.Vector3(-1.0 * scaleX, 0.5, -1.0 * scaleZ);
                                        steamPS.direction2 = new BABYLON.Vector3(1.0 * scaleX, 2.5 * scaleY, 1.0 * scaleZ);

                                        steamPS.minAngularSpeed = -Math.PI / 4;
                                        steamPS.maxAngularSpeed = Math.PI / 4;

                                        steamPS.addSizeGradient(0, 0.2);
                                        steamPS.addSizeGradient(0.2, 1.0);
                                        steamPS.addSizeGradient(1.0, 1.8);

                                        steamPS.start();
                                        setTimeout(() => steamPS.stop(), 1200);
                                        setTimeout(() => steamPS.dispose(), 2700);

                                        return;
                                    }

                                    if (!mesh.metadata || !mesh.metadata.isIceMat) {
                                        if (!mesh.metadata) mesh.metadata = {};
                                        if (!mesh.metadata.onFire) {
                                            mesh.metadata.onFire = true;
                                            workshop.shaman.sandbox3d.applyFireEffect(mesh, scene);
                                        }
                                    }
                                }
                            }
                        }
                    }
                });

                if (isFragment) this.spawnFragments(center, scene);
            },

            applyFireEffect: function (mesh, scene) {
                if (!isSpawnParticlesEnabled || !scene || !mesh || mesh.isDisposed()) return;

                if (!mesh.metadata) mesh.metadata = {};
                mesh.metadata.isBurnt = false;
                mesh.metadata.washStartTime = null;

                if (mesh.material) {
                    if (!mesh.metadata.originalFireColor) {
                        if (mesh.material instanceof BABYLON.PBRMaterial) {
                            mesh.metadata.originalFireColor = mesh.material.albedoColor ? mesh.material.albedoColor.clone() : new BABYLON.Color3(1, 1, 1);
                        } else {
                            mesh.metadata.originalFireColor = mesh.material.diffuseColor ? mesh.material.diffuseColor.clone() : new BABYLON.Color3(1, 1, 1);
                        }
                        mesh.metadata.originalFireEmissive = mesh.material.emissiveColor ? mesh.material.emissiveColor.clone() : new BABYLON.Color3(0, 0, 0);
                    }

                    if (mesh.material instanceof BABYLON.PBRMaterial) {
                        mesh.material.albedoColor = new BABYLON.Color3(1.0, 0.4, 0.0);
                        mesh.material.emissiveColor = new BABYLON.Color3(0.8, 0.3, 0.0);
                    } else {
                        mesh.material.diffuseColor = new BABYLON.Color3(1.0, 0.4, 0.0);
                        mesh.material.emissiveColor = new BABYLON.Color3(0.8, 0.3, 0.0);
                    }
                }

                const ps = new BABYLON.ParticleSystem("fireFX", 60, scene);
                ps.particleTexture = new BABYLON.Texture("https://assets.babylonjs.com/textures/flare.png", scene);
                ps.emitter = mesh;
                ps.minEmitBox = new BABYLON.Vector3(-0.3, -0.3, -0.3);
                ps.maxEmitBox = new BABYLON.Vector3(0.3, 0.3, 0.3);
                ps.color1 = new BABYLON.Color4(1, 0.5, 0, 1.0);
                ps.color2 = new BABYLON.Color4(1, 0.1, 0, 1.0);
                ps.colorDead = new BABYLON.Color4(0, 0, 0, 0);
                ps.minSize = 0.15;
                ps.maxSize = 0.6;
                ps.minLifeTime = 0.3;
                ps.maxLifeTime = 0.8;
                ps.emitRate = 45;
                ps.blendMode = BABYLON.ParticleSystem.BLENDMODE_ONEONE;
                ps.gravity = new BABYLON.Vector3(0, 4, 0);
                ps.direction1 = new BABYLON.Vector3(-0.5, 1, -0.5);
                ps.direction2 = new BABYLON.Vector3(0.5, 2, 0.5);
                ps.minAngularSpeed = 0;
                ps.maxAngularSpeed = Math.PI;
                ps.start();

                mesh.metadata.firePS = ps;

                mesh.metadata.fireTimeout = setTimeout(() => {
                    ps.stop();
                    setTimeout(() => ps.dispose(), 1000);

                    if (mesh && !mesh.isDisposed()) {
                        if (mesh.metadata) {
                            mesh.metadata.onFire = false;
                            mesh.metadata.isBurnt = true;
                        }

                        if (mesh.material) {
                            if (mesh.material instanceof BABYLON.PBRMaterial) {
                                mesh.material.albedoColor = new BABYLON.Color3(0.05, 0.05, 0.05);
                                mesh.material.emissiveColor = new BABYLON.Color3(0, 0, 0);
                            } else {
                                mesh.material.diffuseColor = new BABYLON.Color3(0.05, 0.05, 0.05);
                                mesh.material.emissiveColor = new BABYLON.Color3(0, 0, 0);
                            }
                        }
                    }
                }, 8000);
            },

            triggerFlashbang: function (center, scene) {
                this.explode(center, scene, false, 0.2, false);

                const layer = document.getElementById('flash-layer');
                const video = document.getElementById('flash-meme-vid');
                if (!layer || !video) return;

                layer.style.transition = 'none';
                layer.style.backgroundColor = 'transparent';
                layer.style.opacity = '1';

                if (isFlashbangVideoEnabled) {
                    video.currentTime = 0;
                    video.muted = false;
                    video.volume = 1.0;
                    video.style.display = 'block';
                }

                video.play().catch(e => {
                    console.error("Audio/Video blocked! Ensure pointer is locked or screen clicked.", e);
                });

                setTimeout(() => {
                    layer.style.transition = 'opacity 1.5s ease-out';
                    layer.style.opacity = '0';
                }, 3700);

                setTimeout(() => {
                    video.pause();
                    video.style.display = 'none';
                }, 5250);
            },

            spawnFragments: function(center, scene) {
                const numFrags = 20;
                for(let i=0; i<numFrags; i++) {
                    const frag = BABYLON.MeshBuilder.CreateBox("frag", {size: 0.5}, scene);
                    frag.position = center.clone();
                    frag.position.y += (Math.random() - 0.5) * 0.2;
                    frag.position.x += (Math.random() - 0.5) * 0.1;
                    frag.position.z += (Math.random() - 0.5) * 0.1;
                    const fMat = new BABYLON.StandardMaterial("fMat", scene);
                    fMat.diffuseColor = new BABYLON.Color3(0.2, 0.2, 0.2);
                    fMat.emissiveColor = new BABYLON.Color3(0.8, 0.3, 0); 
                    frag.material = fMat;
                    frag.physicsImpostor = new BABYLON.PhysicsImpostor(frag, BABYLON.PhysicsImpostor.BoxImpostor, { mass: 0.5, restitution: 0.1 }, scene);
                    const exDir = new BABYLON.Vector3(
                        Math.random() - 0.5,
                        Math.random() - 0.5,
                        Math.random() - 0.5
                    ).normalize();
                    frag.physicsImpostor.applyImpulse(exDir.scale(12), frag.getAbsolutePosition());
                    spawnedMeshes.push(frag);
                }
            },

            WaterSimulation: {
                poolBounds: null,
                waterLevel: 0,
                fluidDensity: 1.2,
                dragFactor: 0.15,
                waterMesh: null,
                isPoolEmpty: false,
                isAnimating: false,
                originalWaterY: 0,
                originalWaterDepth: 20,

                init: function (scene) {
                    const poolSize = 80;
                    const poolDepth = 20;
                    const wallThickness = 4;
                    const poolX = 150;
                    const poolZ = -150;
                    const groundY = 1;

                    const wallMat = new BABYLON.StandardMaterial("poolWallMat", scene);
                    wallMat.diffuseColor = new BABYLON.Color3(0.5, 0.5, 0.55);

                    const createWall = (name, w, h, d, px, pz) => {
                        const wall = BABYLON.MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene);
                        wall.position = new BABYLON.Vector3(px, groundY + h / 2 - 2, pz);
                        wall.material = wallMat;
                        wall.physicsImpostor = new BABYLON.PhysicsImpostor(wall, BABYLON.PhysicsImpostor.BoxImpostor, { mass: 0, restitution: 0.2, friction: 0.5 }, scene);
                        return wall;
                    };

                    createWall("wallN", poolSize + wallThickness * 2, poolDepth + 4, wallThickness, poolX, poolZ + poolSize / 2 + wallThickness / 2);
                    createWall("wallS", poolSize + wallThickness * 2, poolDepth + 4, wallThickness, poolX, poolZ - poolSize / 2 - wallThickness / 2);
                    createWall("wallE", wallThickness, poolDepth + 4, poolSize, poolX + poolSize / 2 + wallThickness / 2, poolZ);
                    createWall("wallW", wallThickness, poolDepth + 4, poolSize, poolX - poolSize / 2 - wallThickness / 2, poolZ);

                    const floor = BABYLON.MeshBuilder.CreateBox("poolFloor", { width: poolSize, height: wallThickness, depth: poolSize }, scene);
                    floor.position = new BABYLON.Vector3(poolX, groundY - 2, poolZ);
                    floor.material = wallMat;
                    floor.physicsImpostor = new BABYLON.PhysicsImpostor(floor, BABYLON.PhysicsImpostor.BoxImpostor, { mass: 0, restitution: 0.2, friction: 0.5 }, scene);

                    const water = BABYLON.MeshBuilder.CreateBox("waterVolume", { width: poolSize, height: poolDepth, depth: poolSize }, scene);
                    water.position = new BABYLON.Vector3(poolX, groundY + poolDepth / 2 - 2, poolZ);

                    const waterMat = new BABYLON.PBRMaterial("waterMat", scene);
                    waterMat.albedoColor = new BABYLON.Color3(0.1, 0.6, 0.9);
                    waterMat.alpha = 0.5;
                    waterMat.roughness = 0.05;
                    waterMat.metallic = 0.1;
                    water.material = waterMat;

                    water.isPickable = false;
                    water.checkCollisions = false;

                    this.waterMesh = water;
                    this.originalWaterY = water.position.y;
                    this.originalWaterDepth = poolDepth;

                    this.waterLevel = water.position.y + poolDepth / 2;
                    this.poolBounds = {
                        minX: poolX - poolSize / 2,
                        maxX: poolX + poolSize / 2,
                        minZ: poolZ - poolSize / 2,
                        maxZ: poolZ + poolSize / 2,
                        bottomY: floor.position.y + wallThickness / 2
                    };

                    this.createDrainButton(scene, poolX, poolZ, poolSize, poolDepth);

                    scene.onBeforeRenderObservable.add(() => this.applyBuoyancy());
                },

                createDrainButton: function (scene, poolX, poolZ, poolSize, poolDepth) {
                    const buttonBase = BABYLON.MeshBuilder.CreateBox("drainButtonBase", { width: 4, height: 6, depth: 4 }, scene);
                    buttonBase.position = new BABYLON.Vector3(poolX + poolSize / 2 + 6, 4, poolZ);
                    const baseMat = new BABYLON.StandardMaterial("baseMat", scene);
                    baseMat.diffuseColor = new BABYLON.Color3(0.2, 0.2, 0.2);
                    buttonBase.material = baseMat;

                    const button = BABYLON.MeshBuilder.CreateCylinder("drainButton", { diameter: 3, height: 1 }, scene);
                    button.position = new BABYLON.Vector3(poolX + poolSize / 2 + 6, 7.5, poolZ);
                    const btnMat = new BABYLON.StandardMaterial("btnMat", scene);
                    btnMat.diffuseColor = new BABYLON.Color3(0.8, 0.1, 0.1);
                    button.material = btnMat;

                    button.actionManager = new BABYLON.ActionManager(scene);
                    button.actionManager.registerAction(
                        new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPickTrigger, () => {
                            this.toggleDrain(scene, button, btnMat);
                        })
                    );
                },

                toggleDrain: function (scene, buttonMesh, buttonMat) {
                    if (this.isAnimating) return;
                    this.isAnimating = true;

                    const pressAnim = new BABYLON.Animation("btnPress", "position.y", 30, BABYLON.Animation.ANIMATIONTYPE_FLOAT, BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT);
                    const currentY = buttonMesh.position.y;
                    pressAnim.setKeys([
                        { frame: 0, value: currentY },
                        { frame: 10, value: currentY - 0.5 },
                        { frame: 20, value: currentY }
                    ]);
                    buttonMesh.animations = [pressAnim];
                    scene.beginAnimation(buttonMesh, 0, 20, false);

                    const targetScaleY = this.isPoolEmpty ? 1.0 : 0.001;
                    const targetPosY = this.isPoolEmpty ? this.originalWaterY : this.originalWaterY - (this.originalWaterDepth / 2);
                    const targetLevel = this.isPoolEmpty ? this.originalWaterY + (this.originalWaterDepth / 2) : this.poolBounds.bottomY - 1;

                    buttonMat.diffuseColor = this.isPoolEmpty ? new BABYLON.Color3(0.8, 0.1, 0.1) : new BABYLON.Color3(0.1, 0.8, 0.1);

                    const frameCount = 120;
                    const scaleAnim = new BABYLON.Animation("waterScale", "scaling.y", 60, BABYLON.Animation.ANIMATIONTYPE_FLOAT, BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT);
                    scaleAnim.setKeys([
                        { frame: 0, value: this.waterMesh.scaling.y },
                        { frame: frameCount, value: targetScaleY }
                    ]);

                    const posAnim = new BABYLON.Animation("waterPos", "position.y", 60, BABYLON.Animation.ANIMATIONTYPE_FLOAT, BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT);
                    posAnim.setKeys([
                        { frame: 0, value: this.waterMesh.position.y },
                        { frame: frameCount, value: targetPosY }
                    ]);

                    const levelAnim = new BABYLON.Animation("waterLevelAnim", "waterLevel", 60, BABYLON.Animation.ANIMATIONTYPE_FLOAT, BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT);
                    levelAnim.setKeys([
                        { frame: 0, value: this.waterLevel },
                        { frame: frameCount, value: targetLevel }
                    ]);

                    this.waterMesh.animations = [scaleAnim, posAnim];

                    scene.beginDirectAnimation(this, [levelAnim], 0, frameCount, false);
                    scene.beginAnimation(this.waterMesh, 0, frameCount, false, 1.0, () => {
                        this.isPoolEmpty = !this.isPoolEmpty;
                        this.isAnimating = false;
                        this.waterLevel = targetLevel;
                    });
                },

                applyBuoyancy: function () {
                    if (!spawnedMeshes) return;

                    const b = this.poolBounds;

                    for (let i = 0; i < spawnedMeshes.length; i++) {
                        const mesh = spawnedMeshes[i];
                        if (!mesh || mesh.isDisposed() || !mesh.physicsImpostor) continue;
                        if (mesh.physicsImpostor.mass === 0) continue;

                        const pos = mesh.position;

                        if (pos.x > b.minX && pos.x < b.maxX && pos.z > b.minZ && pos.z < b.maxZ && pos.y < this.waterLevel && pos.y > b.bottomY) {
                            if (mesh.metadata && mesh.metadata.onFire) {
                                mesh.metadata.onFire = false;
                                if (mesh.metadata.fireTimeout) clearTimeout(mesh.metadata.fireTimeout);
                                if (mesh.metadata.firePS) {
                                    mesh.metadata.firePS.stop();
                                    setTimeout(() => mesh.metadata.firePS.dispose(), 1000);
                                }
                                if (mesh.material && mesh.metadata.originalFireColor) {
                                    if (mesh.material instanceof BABYLON.PBRMaterial) {
                                        mesh.material.albedoColor = mesh.metadata.originalFireColor;
                                    } else {
                                        mesh.material.diffuseColor = mesh.metadata.originalFireColor;
                                    }
                                    if (mesh.metadata.originalFireEmissive) {
                                        mesh.material.emissiveColor = mesh.metadata.originalFireEmissive;
                                    }
                                }
                            }

                            if (mesh.metadata && mesh.metadata.isBurnt) {
                                if (!mesh.metadata.washStartTime) {
                                    mesh.metadata.washStartTime = performance.now();
                                } else if (performance.now() - mesh.metadata.washStartTime >= 10000) {
                                    if (mesh.material && mesh.metadata.originalFireColor) {
                                        if (mesh.material instanceof BABYLON.PBRMaterial) {
                                            mesh.material.albedoColor = mesh.metadata.originalFireColor;
                                        } else {
                                            mesh.material.diffuseColor = mesh.metadata.originalFireColor;
                                        }
                                        if (mesh.metadata.originalFireEmissive) {
                                            mesh.material.emissiveColor = mesh.metadata.originalFireEmissive;
                                        }
                                    }
                                    mesh.metadata.isBurnt = false;
                                    mesh.metadata.washStartTime = null;
                                }
                            }

                            const depth = this.waterLevel - pos.y;
                            const volume = mesh.scaling.x * mesh.scaling.y * mesh.scaling.z;
                            const mass = mesh.physicsImpostor.mass;
                            const density = mass / volume;

                            const buoyancy = (this.fluidDensity / density) * 9.81 * mass;

                            const upwardForce = buoyancy * Math.min(depth * 0.8, 2.0);

                            const vel = mesh.physicsImpostor.getLinearVelocity();
                            const dragY = -vel.y * this.dragFactor * volume;

                            const totalForceY = upwardForce + dragY;

                            mesh.physicsImpostor.applyForce(
                                new BABYLON.Vector3(0, totalForceY, 0),
                                mesh.getAbsolutePosition()
                            );

                            const dragX = -vel.x * (this.dragFactor * 0.4);
                            const dragZ = -vel.z * (this.dragFactor * 0.4);
                            mesh.physicsImpostor.applyForce(
                                new BABYLON.Vector3(dragX, 0, dragZ),
                                mesh.getAbsolutePosition()
                            );
                        } else {
                            if (mesh.metadata && mesh.metadata.washStartTime) {
                                mesh.metadata.washStartTime = null;
                            }
                        }
                    }
                }
            }
        }
    }
};

workshop.shaman.sandbox3d.TemporalAudio = {
    enabled: false,
    timer: null,
    volume: 0.5,
    activeSound: null,
    sceneRef: null,

    audioCtx: null,
    gainNode: null,
    sourceNodes: new Map(),

    library: {
        neutral: ["snd_neu1", "snd_neu2", "snd_neu3"],
        evening: ["snd_eve1", "snd_eve2", "snd_eve3"],
        midnight: ["snd_mid1", "snd_mid2", "snd_mid3", "snd_mid4"]
    },

    init: function (scene) {
        this.sceneRef = scene;
        console.log("[Ambience] System initialized. Ready to toggle.");
    },

    toggle: function () {
        this.enabled = !this.enabled;

        if (this.enabled && !this.audioCtx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.audioCtx = new AudioContext();

            this.gainNode = this.audioCtx.createGain();
            this.gainNode.gain.value = this.volume;
            this.gainNode.connect(this.audioCtx.destination);
            console.log("[Ambience] Web Audio Context created & routed.");
        }

        if (this.enabled && this.audioCtx && this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }

        if (this.timer) {
            console.log("[Ambience] Clearing pending schedule...");
            clearTimeout(this.timer);
            this.timer = null;
        }

        if (this.enabled) {
            console.log("[Ambience] System ACTIVATED. Triggering initial sound...");
            this.playMoment();
            return true;
        } else {
            console.log("[Ambience] System DEACTIVATED.");
            if (this.activeSound) {
                this.activeSound.pause();
                this.activeSound.currentTime = 0;
                this.activeSound = null;
            }
            return false;
        }
    },

    scheduleNext: function () {
        if (!this.enabled) return;

        const hour = new Date().getHours();

        let minTime = 180000;
        let maxTime = 300000;

        if (hour >= 0 && hour < 6) {
            minTime = 60000;
            maxTime = 120000;
        }

        const delay = Math.floor(Math.random() * (maxTime - minTime + 1) + minTime);
        const delaySeconds = (delay / 1000).toFixed(1);

        console.log(`[Ambience] Cycle complete. Sleeping for ${delaySeconds} seconds...`);

        this.timer = setTimeout(() => {
            console.log("[Ambience] Waking up. It is time.");
            this.playMoment();
        }, delay);
    },

    triggerJumpscare: function () {
        const layer = document.getElementById('flash-layer');
        const video = document.getElementById('flash-meme-vid');
        if (!layer || !video) return;

        layer.style.transition = 'none';
        layer.style.backgroundColor = 'transparent';
        layer.style.opacity = '1';

        if (isFlashbangVideoEnabled) {
            video.currentTime = 0;
            video.muted = false;
            video.volume = 1.0;
            video.style.display = 'block';
        }

        video.play().catch(e => {
            console.error("Jumpscare blocked! User must interact with document first.", e);
        });

        setTimeout(() => {
            layer.style.transition = 'opacity 1.5s ease-out';
            layer.style.opacity = '0';
        }, 3700);

        setTimeout(() => {
            video.pause();
            video.style.display = 'none';
            this.scheduleNext();
        }, 5250);
    },

    playMoment: function () {
        if (!this.enabled) return;

        const hour = new Date().getHours();
        let mode = 'neutral';

        if (hour >= 17 && hour <= 23) mode = 'evening';
        else if (hour >= 0 && hour < 6) mode = 'midnight';

        console.log(`[Ambience] Time Check | Hour: ${hour} | Mode: ${mode.toUpperCase()}`);

        if (Math.random() < 0.3) {
            triggerMidnightGlitch();
        }

        if (mode === 'midnight') {
            if (Math.random() < 0.10) {
                console.log("[Ambience] MIDNIGHT EVENT TRIGGERED");
                this.triggerJumpscare();
                return;
            }
        }

        const clips = this.library[mode];

        if (!clips || clips.length === 0) {
            this.scheduleNext();
            return;
        }

        const randomClipId = clips[Math.floor(Math.random() * clips.length)];
        this.spawnFlatAudio(randomClipId);
    },

    spawnFlatAudio: function (elementId) {
        const audioEl = document.getElementById(elementId);

        if (!audioEl) {
            this.scheduleNext();
            return;
        }

        this.activeSound = audioEl;
        audioEl.currentTime = 0;

        if (this.audioCtx && this.gainNode) {
            audioEl.volume = 1.0;

            if (!this.sourceNodes.has(elementId)) {
                const source = this.audioCtx.createMediaElementSource(audioEl);
                source.connect(this.gainNode);
                this.sourceNodes.set(elementId, source);
            }
        } else {
            audioEl.volume = Math.min(this.volume, 1.0);
        }

        const playPromise = audioEl.play();

        if (playPromise !== undefined) {
            playPromise.then(() => {
                audioEl.onended = () => {
                    this.scheduleNext();
                };
            }).catch(error => {
                console.warn("[Ambience] Playback failed:", error);
                this.scheduleNext();
            });
        }
    }
};

updateSpawnParticlesButton();
updateWebGPUButtonState();
renderHotbar();
workshop.shaman.sandbox3d.init();
setInterval(() => { updateGrabHint(); updateFreezeButton(); }, 150);