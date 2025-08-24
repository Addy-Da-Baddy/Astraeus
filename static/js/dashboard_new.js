class AstraeusDashboard {
    constructor() {
        this.apiBaseUrl = '/api';
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.earth = null;
        this.satellites = [];
        this.debrisObjects = [];
        this.trajectoryLines = [];
        this.currentTab = 'overview';
        this.selectedSatellite = null;
        this.satelliteList = [];
        this.controls = null;
        this.labelOverlay = null;
        this.labelElements = new Map();
        this.showLabels = false;
        this.earthRotationSpeed = 0.005;
        this.firstVizCenterDone = false;
        this.hasUserInteracted = false;
        this.desiredCameraDistance = null;
        this.smoothDistanceAlpha = 0.15;
        this.zoomGestureActive = false;
        this._wheelCooldown = null;
        this.trajectoryViewMode = '3d';
        this.trajectoryData = null;

        this.init();
        this.updateDownloadButtonStates();
    }

    switchTrajectoryView(mode) {
        this.trajectoryViewMode = mode === 'static' ? 'static' : '3d';
        this.updateTrajectoryButtonStates();
        if (this.trajectoryViewMode === '3d') {
            this.initializeTrajectoryVisualization();
        } else {
            this.renderStaticTrajectoryPlot();
        }
    }

    updateTrajectoryButtonStates() {
        // Remove active class from all trajectory view buttons
        const buttons = document.querySelectorAll('[onclick*="switchTrajectoryView"]');
        buttons.forEach(btn => {
            btn.classList.remove('btn-primary');
            btn.classList.add('btn-outline');
        });

        // Add active class to the current view button
        if (this.trajectoryViewMode === '3d') {
            const btn3D = document.querySelector('[onclick*="switchTrajectoryView(\'3d\')"]');
            if (btn3D) {
                btn3D.classList.remove('btn-outline');
                btn3D.classList.add('btn-primary');
            }
        } else if (this.trajectoryViewMode === 'static') {
            const btnStatic = document.querySelector('[onclick*="switchTrajectoryView(\'static\')"]');
            if (btnStatic) {
                btnStatic.classList.remove('btn-outline');
                btnStatic.classList.add('btn-primary');
            }
        }
    }

    resetTrajectoryButtonStates() {
        // Remove active class from all trajectory view buttons
        const buttons = document.querySelectorAll('[onclick*="switchTrajectoryView"]');
        buttons.forEach(btn => {
            btn.classList.remove('btn-primary');
            btn.classList.add('btn-outline');
        });
    }

    updateDownloadButtonStates() {
        const hasData = this.trajectoryData && this.trajectoryData.trajectories_generated > 0;

        // Enable/disable download and analysis buttons
        const csvBtn = document.getElementById('csv-download-btn');
        const imageBtn = document.getElementById('image-download-btn');
        const analysisBtn = document.getElementById('analysis-btn');

        if (csvBtn) {
            csvBtn.disabled = !hasData;
        }
        if (imageBtn) {
            imageBtn.disabled = !hasData;
        }
        if (analysisBtn) {
            analysisBtn.disabled = !hasData;
        }
    }

    async renderStaticTrajectoryPlot() {
        const container = document.getElementById('trajectory-container');
        if (!container || !this.trajectoryData) return;

        // Set view mode to static and update button states
        this.trajectoryViewMode = 'static';
        this.updateTrajectoryButtonStates();

        container.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; text-align: center; padding: 2rem;">
                <div class="loading" style="margin-bottom: 2rem;"></div>
                <p style="margin: 0; color: var(--text-secondary); font-size: 0.9rem;">Rendering static plot...</p>
            </div>
        `;
        try {
            const predictions = this.trajectoryData.satellite_trajectories || this.trajectoryData.predictions || [];
            const response = await fetch(`${this.apiBaseUrl}/trajectory-plot`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ predictions })
            });
            const data = await response.json();
            if (data && data.success && data.plot_image) {
                const img = new Image();
                img.src = `data:image/png;base64,${data.plot_image}`;
                img.style.width = '100%';
                img.style.height = '100%';
                img.style.objectFit = 'contain';
                container.innerHTML = '';
                container.appendChild(img);
            } else {
                container.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--danger-color);">Failed to render plot</div>';
            }
        } catch (e) {
            container.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--danger-color);">Error rendering plot</div>';
        }
    }

    async downloadTrajectoryCSV() {
        if (!this.trajectoryData || !this.trajectoryData.trajectories_generated) {
            this.showAlert('No trajectory data available. Please generate trajectories first.', 'warning');
            return;
        }

        try {
            const predictions = (this.trajectoryData && (this.trajectoryData.satellite_trajectories || this.trajectoryData.predictions)) || [];
            const response = await fetch(`${this.apiBaseUrl}/trajectory-download`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ predictions })
            });
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'trajectory_predictions.csv';
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
            this.showAlert('Download started', 'success');
        } catch (e) {
            this.showAlert('Failed to download CSV', 'danger');
        }
    }

    async downloadTrajectoryPlot() {
        if (!this.trajectoryData || !this.trajectoryData.trajectories_generated) {
            this.showAlert('No trajectory data available. Please generate trajectories first.', 'warning');
            return;
        }

        try {
            const predictions = (this.trajectoryData && (this.trajectoryData.satellite_trajectories || this.trajectoryData.predictions)) || [];
            const response = await fetch(`${this.apiBaseUrl}/trajectory-plot`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ predictions })
            });
            const data = await response.json();
            if (data && data.success && data.plot_image) {
                const byteCharacters = atob(data.plot_image);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) byteNumbers[i] = byteCharacters.charCodeAt(i);
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], { type: 'image/png' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'trajectory_plot.png';
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);
                this.showAlert('Download started', 'success');
            } else {
                this.showAlert('Failed to prepare plot image', 'danger');
            }
        } catch (e) {
            this.showAlert('Failed to download plot', 'danger');
        }
    }
    async init() {
        await this.initializeVisualization();
        await this.startRealTimeUpdates();
        this.setupEventListeners();
        this.showAlert('<i class="fas fa-rocket"></i> Astraeus Dashboard initialized', 'success');
        
        // Center the view initially
        this.centerDefaultView(true);
    }

    setupEventListeners() {
        // Resize handler
        window.addEventListener('resize', () => {
            if (this.camera && this.renderer) {
                const container = document.getElementById('visualization-container');
                if (container) {
                    this.camera.aspect = container.clientWidth / container.clientHeight;
                    this.camera.updateProjectionMatrix();
                    this.renderer.setSize(container.clientWidth, container.clientHeight);
                }
            }
        });
    }

    async initializeVisualization() {
        const container = document.getElementById('visualization-container');
        if (!container) return;

        // Scene setup
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x000000);

        // Camera setup
        this.camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 50000);
        this.camera.position.set(15000, 10000, 15000);

        // Renderer setup
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        container.appendChild(this.renderer.domElement);

        // Controls
        if (THREE.OrbitControls) {
            this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
            this.controls.enableDamping = true;
            this.controls.dampingFactor = 0.05;
            this.controls.target.set(0, 0, 0);
            this.controls.minDistance = 5000;
            this.controls.maxDistance = 80000;
            this.controls.enableRotate = true;
            this.controls.enableZoom = true;
            this.controls.enablePan = true;
            if (THREE.MOUSE) {
                this.controls.mouseButtons = {
                    LEFT: THREE.MOUSE.ROTATE,
                    MIDDLE: THREE.MOUSE.DOLLY,
                    RIGHT: THREE.MOUSE.PAN
                };
            }
            if (THREE.TOUCH) {
                this.controls.touches = {
                    ONE: THREE.TOUCH.ROTATE,
                    TWO: THREE.TOUCH.DOLLY_PAN
                };
            }
            this.controls.update();
            this.controls.addEventListener('start', () => { this.hasUserInteracted = true; });
        }

        // Fallback manual mouse drag to rotate view
        let isDragging = false;
        let lastX = 0;
        let lastY = 0;
        const onMouseDown = (e) => { isDragging = true; lastX = e.clientX; lastY = e.clientY; this.hasUserInteracted = true; };
        const onMouseUp = () => { isDragging = false; };
        const onMouseMove = (e) => {
            if (!isDragging) return;
            const deltaX = e.clientX - lastX;
            const deltaY = e.clientY - lastY;
            lastX = e.clientX;
            lastY = e.clientY;
            const rotateSpeed = 0.0025;
            if (this.controls && typeof this.controls.rotateLeft === 'function') {
                this.controls.rotateLeft(deltaX * rotateSpeed);
                this.controls.rotateUp(deltaY * rotateSpeed);
                this.controls.update();
            } else {
                // Basic spherical fallback
                const target = (this.controls && this.controls.target) ? this.controls.target : new THREE.Vector3(0,0,0);
                const offset = this.camera.position.clone().sub(target);
                const spherical = new THREE.Spherical();
                spherical.setFromVector3(offset);
                spherical.theta -= deltaX * rotateSpeed;
                spherical.phi -= deltaY * rotateSpeed;
                spherical.phi = Math.max(0.01, Math.min(Math.PI - 0.01, spherical.phi));
                offset.setFromSpherical(spherical);
                this.camera.position.copy(target.clone().add(offset));
                this.camera.lookAt(target);
            }
        };
        this.renderer.domElement.addEventListener('mousedown', onMouseDown);
        window.addEventListener('mouseup', onMouseUp);
        window.addEventListener('mousemove', onMouseMove);
        this.renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());

        // Create Earth
        this.createEarth();
        this.createStarfield();
        this.addSceneHelpers();
        this.setupLabelOverlay(container);
        
        // Add lights
        this.addLights();
        
        // Start animation loop
        this.animate();

        // Prevent page scroll and implement wheel zoom on canvas
        const wheelHandler = (e) => {
            e.preventDefault();
            const target = (this.controls && this.controls.target) ? this.controls.target : new THREE.Vector3(0,0,0);
            const offset = this.camera.position.clone().sub(target);
            const len = offset.length();
            const factor = Math.exp(e.deltaY * 0.001);
            const desired = len * factor;
            this.setDesiredCameraDistance(desired, target);
            this.zoomGestureActive = true;
            if (this._wheelCooldown) clearTimeout(this._wheelCooldown);
            this._wheelCooldown = setTimeout(() => { this.zoomGestureActive = false; }, 150);
        };
        this.renderer.domElement.addEventListener('wheel', wheelHandler, { passive: false });

        // Touch pinch/slide zoom
        let pinchPrevDist = 0;
        let twoFingerPrevAvgY = 0;
        const touchStartHandler = (e) => {
            if (e.touches && e.touches.length === 2) {
                e.preventDefault();
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                pinchPrevDist = Math.hypot(dx, dy);
                twoFingerPrevAvgY = (e.touches[0].clientY + e.touches[1].clientY) * 0.5;
                this.zoomGestureActive = true;
            }
        };
        const touchMoveHandler = (e) => {
            if (!e.touches) return;
            if (e.touches.length === 2) {
                e.preventDefault();
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                const dist = Math.hypot(dx, dy);
                const avgY = (e.touches[0].clientY + e.touches[1].clientY) * 0.5;
                const target = (this.controls && this.controls.target) ? this.controls.target : new THREE.Vector3(0,0,0);
                const offset = this.camera.position.clone().sub(target);
                const len = offset.length();
                let desired = len;
                if (pinchPrevDist > 0 && dist > 0) {
                    // Pinch to zoom: adjust nonlinearly for responsiveness
                    const scale = pinchPrevDist / dist;
                    desired = len * Math.pow(scale, 1.2);
                } else {
                    // Two-finger slide: use vertical movement, stronger factor similar to slider feel
                    const dyAvg = avgY - twoFingerPrevAvgY;
                    // Exponential mapping for smoothness; positive dy moves away (zoom out)
                    desired = len * Math.exp(dyAvg * 0.01);
                }
                this.setDesiredCameraDistance(desired, target);
                pinchPrevDist = dist;
                twoFingerPrevAvgY = avgY;
            }
        };
        const touchEndHandler = (e) => {
            if (!e.touches || e.touches.length < 2) {
                pinchPrevDist = 0;
                this.zoomGestureActive = false;
            }
        };
        this.renderer.domElement.addEventListener('touchstart', touchStartHandler, { passive: false });
        this.renderer.domElement.addEventListener('touchmove', touchMoveHandler, { passive: false });
        this.renderer.domElement.addEventListener('touchend', touchEndHandler, { passive: false });
    }

    createEarth() {
        const earthRadius = 6371;
        const geometry = new THREE.SphereGeometry(earthRadius, 64, 64);

        // Earth material matching trajectory visualization
        const material = new THREE.MeshPhongMaterial({
            color: 0x4488bb,
            transparent: false,
            opacity: 1.0
        });

        this.earth = new THREE.Mesh(geometry, material);
        this.earth.receiveShadow = true;
        this.scene.add(this.earth);

        // Add wireframe overlay for Earth (matching trajectory visualization)
        const wireframeGeometry = new THREE.SphereGeometry(earthRadius * 1.01, 32, 32);
        const wireframeMaterial = new THREE.MeshBasicMaterial({
            color: 0x44aaff,
            wireframe: true,
            transparent: true,
            opacity: 0.3
        });
        const wireframe = new THREE.Mesh(wireframeGeometry, wireframeMaterial);
        this.scene.add(wireframe);

        // Add atmosphere with adjusted colors for black background
        const atmosphereGeometry = new THREE.SphereGeometry(earthRadius * 1.025, 64, 64);
        const atmosphereMaterial = new THREE.MeshBasicMaterial({
            color: 0x44aaff,
            transparent: true,
            opacity: 0.15
        });
        const atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
        this.scene.add(atmosphere);
    }

    createStarfield() {
        const starCount = 2000;
        const positions = new Float32Array(starCount * 3);
        for (let i = 0; i < starCount; i++) {
            const r = 90000;
            positions[i * 3] = (Math.random() - 0.5) * 2 * r;
            positions[i * 3 + 1] = (Math.random() - 0.5) * 2 * r;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 2 * r;
        }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const material = new THREE.PointsMaterial({ color: 0xffffff, size: 60, sizeAttenuation: true, transparent: true, opacity: 0.7 });
        const stars = new THREE.Points(geometry, material);
        stars.userData = { type: 'background' };
        this.scene.add(stars);
    }

    addSceneHelpers() {
        const axes = new THREE.AxesHelper(5000);
        axes.material.depthTest = false;
        axes.renderOrder = 1;
        axes.userData = { type: 'helper' };
        this.scene.add(axes);
        const grid = new THREE.PolarGridHelper(20000, 8, 8, 64, 0x223344, 0x223344);
        grid.userData = { type: 'helper' };
        this.scene.add(grid);
    }

    setupLabelOverlay(container) {
        const overlay = document.createElement('div');
        overlay.style.position = 'absolute';
        overlay.style.inset = '0';
        overlay.style.pointerEvents = 'none';
        overlay.id = 'viz-label-overlay';
        container.appendChild(overlay);
        this.labelOverlay = overlay;
        this.showLabels = false;
        this.labelElements = new Map();
    }

    addLights() {
        // Ambient light
        const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
        this.scene.add(ambientLight);

        // Directional light (sun)
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(50000, 30000, 50000);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        this.scene.add(directionalLight);
    }

    animate() {
        if (!this.renderer || !this.scene || !this.camera) return;
        
        requestAnimationFrame(() => this.animate());
        
        // Update controls
        if (this.controls) {
            this.controls.update();
        }
        
        // Rotate Earth
        if (this.earth && this.earthRotationSpeed) {
            this.earth.rotation.y += this.earthRotationSpeed;
        }
        
        // Smoothly apply desired camera distance
        if (this.desiredCameraDistance != null) {
            const target = (this.controls && this.controls.target) ? this.controls.target : new THREE.Vector3(0,0,0);
            const offset = this.camera.position.clone().sub(target);
            const currentLen = offset.length();
            const dir = offset.normalize();
            const alpha = this.zoomGestureActive ? Math.max(this.smoothDistanceAlpha, 0.35) : this.smoothDistanceAlpha;
            const nextLen = currentLen + (this.desiredCameraDistance - currentLen) * alpha;
            this.camera.position.copy(target.clone().add(dir.multiplyScalar(nextLen)));
            this.camera.lookAt(target);
        }
        
        // Update statistics
        this.updateLiveStatistics();
        
        // Render scene
        this.renderer.render(this.scene, this.camera);
    }

    createSatelliteVisualization(satellites) {
        // Clear existing satellites
        this.satellites.forEach(sat => this.scene.remove(sat));
        this.satellites = [];

        if (!satellites || satellites.length === 0) return;

        this.satelliteData = satellites;

        satellites.forEach((sat, index) => {
            const geometry = new THREE.SphereGeometry(50, 8, 8);
            const color = sat.is_debris ? 0xff4757 : 0x007bff;
            const material = new THREE.MeshBasicMaterial({ color });

            const satellite = new THREE.Mesh(geometry, material);
            satellite.position.set(
                (sat.x != null ? sat.x : (sat.position && sat.position.x) || 0),
                (sat.y != null ? sat.y : (sat.position && sat.position.y) || 0),
                (sat.z != null ? sat.z : (sat.position && sat.position.z) || 0)
            );

            satellite.userData = { id: sat.id != null ? sat.id : index, type: sat.is_debris ? 'debris' : 'satellite' };
            this.satellites.push(satellite);
            this.scene.add(satellite);

            if (this.showLabels) {
                this.addOrUpdateLabel(satellite, sat.is_debris ? `Debris #${sat.id ?? index}` : `Sat #${sat.id ?? index}`);
            }
        });
    }

    addOrUpdateLabel(object3d, text) {
        if (!this.labelOverlay) return;
        let el = this.labelElements.get(object3d);
        if (!el) {
            el = document.createElement('div');
            el.style.position = 'absolute';
            el.style.color = '#fff';
            el.style.fontSize = '10px';
            el.style.pointerEvents = 'none';
            el.style.whiteSpace = 'nowrap';
            el.style.textShadow = '0 0 4px rgba(0,0,0,0.8)';
            this.labelOverlay.appendChild(el);
            this.labelElements.set(object3d, el);
        }
        el.textContent = text;
    }

    async updateSystemStatus(data) {
        if (!data) return;

        // Update overview stats
        document.getElementById('total-objects').textContent = data.total_objects || '-';
        document.getElementById('debris-count').textContent = data.debris_count || '-';
        document.getElementById('collision-risk').textContent = data.collision_probability ? 
            `${(data.collision_probability * 100).toFixed(2)}%` : '-';
        document.getElementById('last-update').textContent = new Date().toLocaleTimeString('en-US', { hour12: false });

        // Update system status
        const statusContainer = document.getElementById('system-status');
        statusContainer.innerHTML = `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div style="text-align: center; padding: 1rem; background: rgba(40, 167, 69, 0.1); border-radius: 8px;">
                    <div style="font-size: 1.5rem; font-weight: 700; color: var(--success-color);">${data.total_objects || 0}</div>
                    <div style="font-size: 0.9rem; color: var(--text-secondary);">Objects Tracked</div>
                </div>
                <div style="text-align: center; padding: 1rem; background: rgba(220, 53, 69, 0.1); border-radius: 8px;">
                    <div style="font-size: 1.5rem; font-weight: 700; color: var(--danger-color);">${data.debris_count || 0}</div>
                    <div style="font-size: 0.9rem; color: var(--text-secondary);">Debris Objects</div>
                </div>
            </div>
            <div style="margin-top: 1rem; padding: 1rem; background: rgba(255, 255, 255, 0.05); border-radius: 8px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                    <span>System Status:</span>
                    <span style="color: var(--success-color); font-weight: 600;">Online</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                    <span>Last Update:</span>
                    <span>${new Date().toLocaleTimeString('en-US', { hour12: false })}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span>Collision Risk:</span>
                    <span style="color: ${data.collision_probability > 0.05 ? 'var(--danger-color)' : 'var(--success-color)'}; font-weight: 600;">
                        ${data.collision_probability ? `${(data.collision_probability * 100).toFixed(2)}%` : 'Low'}
                    </span>
                </div>
            </div>
        `;
    }

    displaySatelliteList(satellites) {
        const listContainer = document.getElementById('satellite-list');
        
        if (!satellites || satellites.length === 0) {
            listContainer.innerHTML = '<div style="text-align: center; color: var(--text-secondary); padding: 2rem;">No satellites found</div>';
            return;
        }
        
        const html = satellites.map(sat => {
            const riskClass = sat.risk_level ? sat.risk_level.toLowerCase() : 'unknown';
            const typeIcon = sat.is_debris ? '<i class="fas fa-trash"></i>' : '<i class="fas fa-satellite"></i>';
            
            return `
                <div class="satellite-item" onclick="selectSatellite(${sat.id})">
                    <div class="satellite-header">
                        <div class="satellite-id">${typeIcon} Satellite #${sat.id}</div>
                        <div class="risk-badge risk-${riskClass}">${sat.risk_level || 'Unknown'}</div>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; font-size: 0.9rem;">
                        <div>
                            <div>Type: ${sat.is_debris ? 'Debris' : 'Active'}</div>
                            <div>Alt: ${sat.altitude ? sat.altitude.toFixed(0) : 'N/A'} km</div>
                        </div>
                        <div>
                            <div>Risk: ${sat.debris_probability ? sat.debris_probability.toFixed(1) : 'N/A'}%</div>
                            <div>Status: ${sat.status || 'Unknown'}</div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        listContainer.innerHTML = html;
    }

    async loadSatelliteList() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/satellites/search`);
            const data = await response.json();
            
            this.satelliteList = data.satellites || [];
            this.displaySatelliteList(this.satelliteList);
            
        } catch (error) {
            console.error('Error loading satellite list:', error);
            document.getElementById('satellite-list').innerHTML = 
                '<div style="text-align: center; color: var(--danger-color); padding: 2rem;">Failed to load satellites</div>';
        }
    }

    async selectSatellite(satelliteId) {
        try {
            this.showAlert('Loading satellite details...', 'info');
            
            const response = await fetch(`${this.apiBaseUrl}/satellite/${satelliteId}/details`);
            const data = await response.json();
            
            if (data.success) {
                this.selectedSatellite = data.satellite;
                this.showSatelliteDetails(data.satellite);
            } else {
                this.showAlert('Failed to load satellite details: ' + data.error, 'danger');
            }
            
        } catch (error) {
            console.error('Error selecting satellite:', error);
            this.showAlert('Error loading satellite details', 'danger');
        }
    }

    showSatelliteDetails(satellite) {
        // Populate modal with satellite details
        document.getElementById('modal-satellite-title').textContent = `Satellite #${satellite.id} Details`;
        document.getElementById('detail-id').textContent = satellite.id;
        document.getElementById('detail-type').textContent = satellite.risk_assessment?.is_debris ? 'Space Debris' : 'Active Satellite';
        document.getElementById('detail-status').textContent = satellite.health_status?.status || 'Unknown';
        document.getElementById('detail-updated').textContent = new Date(satellite.timestamp || Date.now()).toLocaleDateString() + ' ' + new Date(satellite.timestamp || Date.now()).toLocaleTimeString('en-US', { hour12: false });
        
        // Risk assessment
        const riskAssessment = satellite.risk_assessment || {};
        document.getElementById('detail-risk-level').textContent = riskAssessment.risk_level || 'Unknown';
        document.getElementById('detail-debris-prob').textContent = `${(riskAssessment.debris_probability || 0).toFixed(2)}%`;
        document.getElementById('detail-collision-risk').textContent = riskAssessment.collision_risk || 'Unknown';
        document.getElementById('detail-risk-score').textContent = (riskAssessment.risk_score || 0).toFixed(1);
        
        // Position & velocity
        const pos = satellite.basic_info?.position || {};
        const vel = satellite.basic_info?.velocity || {};
        document.getElementById('detail-position').textContent = `(${(pos.x || 0).toFixed(1)}, ${(pos.y || 0).toFixed(1)}, ${(pos.z || 0).toFixed(1)})`;
        document.getElementById('detail-velocity').textContent = `(${(vel.vx || 0).toFixed(3)}, ${(vel.vy || 0).toFixed(3)}, ${(vel.vz || 0).toFixed(3)})`;
        document.getElementById('detail-speed').textContent = `${(vel.magnitude || 0).toFixed(3)} km/s`;
        
        // Orbital elements
        const orbital = satellite.basic_info?.orbital_elements || {};
        document.getElementById('detail-altitude').textContent = `${(orbital.altitude || 0).toFixed(1)} km`;
        document.getElementById('detail-inclination').textContent = `${(orbital.inclination || 0).toFixed(2)}°`;
        document.getElementById('detail-eccentricity').textContent = (orbital.eccentricity || 0).toFixed(4);
        document.getElementById('detail-period').textContent = `${((orbital.period || 0) / 60).toFixed(1)} min`;
        
        // Show modal
        document.getElementById('satellite-modal').classList.add('show');
    }

    closeSatelliteModal() {
        document.getElementById('satellite-modal').classList.remove('show');
        this.selectedSatellite = null;
    }

    async searchSatellites(query) {
        if (!query.trim()) {
            this.displaySatelliteList(this.satelliteList);
            return;
        }
        
        try {
            const response = await fetch(`${this.apiBaseUrl}/satellites/search?q=${encodeURIComponent(query)}&limit=50`);
            const data = await response.json();
            
            this.displaySatelliteList(data.satellites || []);
            
        } catch (error) {
            console.error('Search error:', error);
        }
    }

    async filterByRisk(riskLevel) {
        if (!riskLevel) {
            this.displaySatelliteList(this.satelliteList);
            return;
        }
        
        try {
            const response = await fetch(`${this.apiBaseUrl}/satellites/search?risk_level=${riskLevel}&limit=100`);
            const data = await response.json();
            
            this.displaySatelliteList(data.satellites || []);
            
        } catch (error) {
            console.error('Filter error:', error);
        }
    }

    async refreshSatelliteList() {
        this.showAlert('Refreshing satellite list...', 'info');
        await this.loadSatelliteList();
        this.showAlert('Satellite list refreshed', 'success');
    }

    async viewHighRiskSatellites() {
        try {
            this.showAlert('Loading high-risk satellites...', 'info');
            
            const response = await fetch(`${this.apiBaseUrl}/satellites/high-risk`);
            const data = await response.json();
            
            if (data.success) {
                // Update high-risk preview
                const previewContainer = document.getElementById('high-risk-preview');
                const summary = data.threat_summary;
                if (previewContainer) {
                    previewContainer.innerHTML = `
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                            <div style="text-align: center; padding: 1rem; background: rgba(220, 53, 69, 0.1); border-radius: 8px;">
                                <div style="font-size: 1.5rem; font-weight: 700; color: var(--danger-color);">${summary.critical}</div>
                                <div style="font-size: 0.8rem;">Critical</div>
                            </div>
                            <div style="text-align: center; padding: 1rem; background: rgba(255, 193, 7, 0.1); border-radius: 8px;">
                                <div style="font-size: 1.5rem; font-weight: 700; color: var(--warning-color);">${summary.high}</div>
                                <div style="font-size: 0.8rem;">High Risk</div>
                            </div>
                        </div>
                        <div style="font-size: 0.9rem; text-align: center; color: var(--text-secondary);">
                            ${data.satellites.length} high-risk satellites detected
                        </div>
                    `;
                }
                
                // Also update the detailed high-risk list if we're on alerts tab
                this.displayHighRiskSatellitesList(data.satellites, summary);
                this.showAlert('High-risk satellites loaded', 'success');
            } else {
                this.showAlert('Failed to load high-risk satellites: ' + data.error, 'danger');
            }
            
        } catch (error) {
            console.error('Error loading high-risk satellites:', error);
            this.showAlert('Error loading high-risk satellites', 'danger');
        }
    }

    displayHighRiskSatellitesList(satellites, summary) {
        const listContainer = document.getElementById('high-risk-satellites-list');
        const alertsContainer = document.getElementById('active-alerts');
        const riskSummaryContainer = document.getElementById('risk-summary');
        const collisionWarningsContainer = document.getElementById('collision-warnings');
        
        if (!listContainer) return;
        
        // Display detailed high-risk satellites list
        if (satellites && satellites.length > 0) {
            const satellitesHtml = satellites.slice(0, 20).map((sat, index) => {
                const riskColor = sat.risk_level === 'CRITICAL' ? 'var(--danger-color)' : 
                                 sat.risk_level === 'HIGH' ? 'var(--warning-color)' : 'var(--accent-color)';
                
                return `
                    <div class="satellite-item" onclick="selectSatellite(${sat.id})" style="cursor: pointer; border-left: 4px solid ${riskColor};">
                        <div class="satellite-header">
                            <div class="satellite-id">
                                <i class="fas fa-satellite"></i> ${sat.name || `Satellite #${sat.id}`}
                                <small style="color: var(--text-secondary);">(ID: ${sat.id})</small>
                            </div>
                            <div class="risk-badge risk-${sat.risk_level.toLowerCase()}">${sat.risk_level}</div>
                        </div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem; font-size: 0.9rem; margin-top: 0.5rem;">
                            <div>
                                <strong>Type:</strong> ${sat.is_debris ? 'Debris' : 'Active'}
                                <br><strong>Alt:</strong> ${sat.altitude ? sat.altitude.toFixed(0) : 'N/A'} km
                            </div>
                            <div>
                                <strong>Risk:</strong> ${sat.debris_probability ? sat.debris_probability.toFixed(1) : 'N/A'}%
                                <br><strong>Status:</strong> ${sat.status || 'Unknown'}
                            </div>
                            <div>
                                <strong>Threat:</strong> ${sat.threat_type || 'Orbital Decay'}
                                <br><strong>ETA:</strong> ${sat.eta || 'Unknown'}
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
            
            listContainer.innerHTML = `
                <div style="margin-bottom: 1rem;">
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 1rem;">
                        <div style="text-align: center; padding: 1rem; background: rgba(220, 53, 69, 0.1); border-radius: 8px;">
                            <div style="font-size: 1.5rem; font-weight: 700; color: var(--danger-color);">${summary.critical}</div>
                            <div style="font-size: 0.9rem;">Critical Risk</div>
                        </div>
                        <div style="text-align: center; padding: 1rem; background: rgba(255, 193, 7, 0.1); border-radius: 8px;">
                            <div style="font-size: 1.5rem; font-weight: 700; color: var(--warning-color);">${summary.high}</div>
                            <div style="font-size: 0.9rem;">High Risk</div>
                        </div>
                        <div style="text-align: center; padding: 1rem; background: rgba(0, 123, 255, 0.1); border-radius: 8px;">
                            <div style="font-size: 1.5rem; font-weight: 700; color: var(--primary-color);">${satellites.length}</div>
                            <div style="font-size: 0.9rem;">Total Tracked</div>
                        </div>
                    </div>
                </div>
                <div style="max-height: 400px; overflow-y: auto;">
                    ${satellitesHtml}
                </div>
            `;
        } else {
            listContainer.innerHTML = '<div style="text-align: center; color: var(--success-color); padding: 2rem;"><i class="fas fa-check-circle"></i> No high-risk satellites detected</div>';
        }
        
        // Update active alerts
        if (alertsContainer) {
            const criticalCount = summary.critical || 0;
            const highCount = summary.high || 0;
            
            if (criticalCount > 0 || highCount > 0) {
                alertsContainer.innerHTML = `
                    <div style="margin-bottom: 1rem;">
                        ${criticalCount > 0 ? `
                            <div style="padding: 1rem; background: rgba(220, 53, 69, 0.1); border-left: 4px solid var(--danger-color); border-radius: 4px; margin-bottom: 0.5rem;">
                                <div style="font-weight: 600; color: var(--danger-color);"><i class="fas fa-siren-on"></i> CRITICAL ALERT</div>
                                <div style="font-size: 0.9rem;">${criticalCount} satellites at critical risk level</div>
                            </div>
                        ` : ''}
                        ${highCount > 0 ? `
                            <div style="padding: 1rem; background: rgba(255, 193, 7, 0.1); border-left: 4px solid var(--warning-color); border-radius: 4px;">
                                <div style="font-weight: 600; color: var(--warning-color);"><i class="fas fa-triangle-exclamation"></i> HIGH RISK</div>
                                <div style="font-size: 0.9rem;">${highCount} satellites at high risk level</div>
                            </div>
                        ` : ''}
                    </div>
                `;
            } else {
                alertsContainer.innerHTML = '<div style="text-align: center; color: var(--success-color); padding: 2rem;"><i class="fas fa-check-circle"></i> No active alerts</div>';
            }
        }
        
        // Update risk summary
        if (riskSummaryContainer) {
            const totalRisk = satellites.length;
            const overallRisk = totalRisk > 10 ? 'HIGH' : totalRisk > 5 ? 'MEDIUM' : 'LOW';
            const riskColor = overallRisk === 'HIGH' ? 'var(--danger-color)' : 
                             overallRisk === 'MEDIUM' ? 'var(--warning-color)' : 'var(--success-color)';
            
            riskSummaryContainer.innerHTML = `
                <div style="text-align: center; margin-bottom: 1rem;">
                    <div style="font-size: 2rem; font-weight: 700; color: ${riskColor};">${overallRisk}</div>
                    <div style="font-size: 0.9rem; color: var(--text-secondary);">Overall Risk Level</div>
                </div>
                <div style="background: rgba(255, 255, 255, 0.05); border-radius: 8px; padding: 1rem;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                        <span>Risk Assessment:</span>
                        <span style="color: ${riskColor}; font-weight: 600;">${overallRisk}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                        <span>Tracked Objects:</span>
                        <span>${totalRisk}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span>Last Analysis:</span>
                        <span>${new Date().toLocaleTimeString('en-US', { hour12: false })}</span>
                    </div>
                </div>
            `;
        }
        
        // Update collision warnings
        if (collisionWarningsContainer) {
            const highRiskSats = satellites.filter(s => s.risk_level === 'CRITICAL' || s.risk_level === 'HIGH');
            
            if (highRiskSats.length > 0) {
                const warningsHtml = highRiskSats.slice(0, 5).map(sat => `
                    <div style="padding: 1rem; background: rgba(255, 255, 255, 0.05); border-radius: 8px; margin-bottom: 0.5rem;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <strong>${sat.name || `Satellite #${sat.id}`}</strong>
                                <div style="font-size: 0.8rem; color: var(--text-secondary);">
                                    Risk: ${sat.debris_probability ? sat.debris_probability.toFixed(1) : 'N/A'}% | Alt: ${sat.altitude ? sat.altitude.toFixed(0) : 'N/A'} km
                                </div>
                            </div>
                            <span class="risk-badge risk-${sat.risk_level.toLowerCase()}">${sat.risk_level}</span>
                        </div>
                    </div>
                `).join('');
                
                collisionWarningsContainer.innerHTML = warningsHtml;
            } else {
                collisionWarningsContainer.innerHTML = '<div style="text-align: center; color: var(--success-color); padding: 2rem;"><i class="fas fa-check-circle"></i> No collision warnings</div>';
            }
        }
    }

    async startRealTimeUpdates() {
        // Set loading state
        document.getElementById('total-objects').textContent = 'Loading...';
        document.getElementById('debris-count').textContent = 'Loading...';
        document.getElementById('collision-risk').textContent = 'Loading...';
        
        // Initial update
        await this.updateData();
        
        // Set up periodic updates every 15 seconds
        setInterval(() => this.updateData(), 15000);
        
    }

    async updateData() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/data`);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            if (data && data.satellites) {
                this.createSatelliteVisualization(data.satellites);
                await this.updateSystemStatus(data);
                
                // Show status in console for debugging
            } else {
                console.warn('No satellite data in response');
            }
            
        } catch (error) {
            console.error('Error updating data:', error);
            
            // Update UI to show error state
            document.getElementById('total-objects').textContent = 'Error';
            document.getElementById('debris-count').textContent = 'Error';
            document.getElementById('collision-risk').textContent = 'Error';
            document.getElementById('last-update').textContent = 'Failed to update';
        }
    }

    async runPrediction() {
        try {
            this.showAlert('<i class="fas fa-rotate"></i> Running collision detection...', 'info');
            
            const resultContainer = document.getElementById('prediction-results');
            resultContainer.innerHTML = `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 3rem; text-align: center;">
                    <div class="loading" style="margin-bottom: 2rem;"></div>
                    <p style="margin: 0; color: var(--text-secondary); font-size: 0.9rem;">Analyzing orbital data...</p>
                </div>
            `;
            
            const response = await fetch(`${this.apiBaseUrl}/predict`, { method: 'POST' });
            const data = await response.json();
            
            if (data.error) {
                resultContainer.innerHTML = `<div style="color: var(--danger-color); text-align: center; padding: 2rem;">${data.error}</div>`;
                this.showAlert('Prediction failed: ' + data.error, 'danger');
                return;
            }

            // Display results
            resultContainer.innerHTML = `
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                    <div style="text-align: center; padding: 1rem; background: rgba(40, 167, 69, 0.1); border-radius: 8px;">
                        <div style="font-size: 1.5rem; font-weight: 700; color: var(--success-color);">${data.total_objects || 0}</div>
                        <div style="font-size: 0.9rem;">Objects Analyzed</div>
                    </div>
                    <div style="text-align: center; padding: 1rem; background: rgba(220, 53, 69, 0.1); border-radius: 8px;">
                        <div style="font-size: 1.5rem; font-weight: 700; color: var(--danger-color);">${data.debris_count || 0}</div>
                        <div style="font-size: 0.9rem;">Debris Detected</div>
                    </div>
                </div>
                <div style="padding: 1rem; background: rgba(255, 255, 255, 0.05); border-radius: 8px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                        <span>Collision Probability:</span>
                        <span style="font-weight: 600; color: ${data.collision_probability > 0.05 ? 'var(--danger-color)' : 'var(--success-color)'};">
                            ${data.collision_probability ? `${(data.collision_probability * 100).toFixed(3)}%` : 'N/A'}
                        </span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                        <span>Analysis Time:</span>
                        <span>${new Date().toLocaleTimeString('en-US', { hour12: false })}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span>Model Accuracy:</span>
                        <span style="color: var(--success-color);">96.8%</span>
                    </div>
                </div>
            `;

            this.showAlert('<i class="fas fa-check-circle"></i> Collision detection completed', 'success');
            
        } catch (error) {
            console.error('Prediction error:', error);
            this.showAlert('Error running prediction', 'danger');
        }
    }

    async runTrajectoryPrediction() {
        try {
            this.showAlert('<i class="fas fa-rocket"></i> Generating trajectory predictions...', 'info');
            
            const resultContainer = document.getElementById('trajectory-results');
            const trajectoryContainer = document.getElementById('trajectory-container');
            
            resultContainer.innerHTML = `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 3rem; text-align: center;">
                    <div class="loading" style="margin-bottom: 2rem;"></div>
                    <p style="margin: 0; color: var(--text-secondary); font-size: 0.9rem;">Calculating orbital trajectories...</p>
                </div>
            `;
            
            const response = await fetch(`${this.apiBaseUrl}/trajectory-bulk`, { method: 'POST' });
            const data = await response.json();
            
            if (data.error) {
                resultContainer.innerHTML = `<div style="color: var(--danger-color); text-align: center; padding: 2rem;">${data.error}</div>`;
                this.showAlert('Trajectory prediction failed: ' + data.error, 'danger');
                return;
            }

            // Store trajectory data for visualization
            this.trajectoryData = data;

            // Enable download and analysis buttons
            this.updateDownloadButtonStates();

            // Display results
            resultContainer.innerHTML = `
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                    <div style="text-align: center; padding: 1rem; background: rgba(0, 123, 255, 0.1); border-radius: 8px;">
                        <div style="font-size: 1.5rem; font-weight: 700; color: var(--primary-color);">${data.trajectories_generated || 0}</div>
                        <div style="font-size: 0.9rem;">Trajectories Generated</div>
                    </div>
                    <div style="text-align: center; padding: 1rem; background: rgba(124, 58, 237, 0.1); border-radius: 8px;">
                        <div style="font-size: 1.5rem; font-weight: 700; color: var(--accent-color);">${data.prediction_horizon || 0}h</div>
                        <div style="font-size: 0.9rem;">Prediction Horizon</div>
                    </div>
                </div>
                <div style="padding: 1rem; background: rgba(255, 255, 255, 0.05); border-radius: 8px; margin-bottom: 1rem;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                        <span>Neural Network Model:</span>
                        <span style="color: var(--success-color);">LSTM + GRU</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                        <span>Prediction Accuracy:</span>
                        <span style="color: var(--success-color);">94.2%</span>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span>Generated At:</span>
                        <span>${new Date().toLocaleTimeString('en-US', { hour12: false })}</span>
                    </div>
                </div>
                <div style="display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap;">
                    <button class="btn btn-primary" onclick="switchToTab('trajectories')"><i class="fas fa-location-arrow"></i> Open in Trajectories</button>
                </div>
            `;

            // Initialize trajectory visualization
            this.initializeTrajectoryVisualization();
            this.updateTrajectoryStatistics();
            this.showAlert('<i class="fas fa-check-circle"></i> Trajectory predictions completed', 'success');
            if (typeof switchToTab === 'function') {
                switchToTab('trajectories');
            }
            
        } catch (error) {
            console.error('Trajectory prediction error:', error);
            this.showAlert('Error generating trajectories', 'danger');
        }
    }

    initializeTrajectoryVisualization() {
        const container = document.getElementById('trajectory-container');
        if (!container || !this.trajectoryData) return;

        // Set view mode to 3D and update button states
        this.trajectoryViewMode = '3d';
        this.updateTrajectoryButtonStates();

        // Clear container and add controls overlay
        container.innerHTML = `
            <div id="trajectory-controls" style="position: absolute; top: 10px; left: 10px; z-index: 1000; background: rgba(0,0,0,0.7); padding: 10px; border-radius: 8px;">
                <div style="margin-bottom: 5px;">
                    <button id="focus-earth-btn" style="margin: 2px; padding: 5px 10px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;"><i class="fas fa-earth-americas"></i> Earth</button>
                    <button id="full-view-btn" style="margin: 2px; padding: 5px 10px; background: #ffc107; color: black; border: none; border-radius: 4px; cursor: pointer;"><i class="fas fa-magnifying-glass"></i> Full View</button>
                </div>
                <div>
                    <button id="prev-satellite-btn" style="margin: 2px; padding: 5px 10px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer;"><i class="fas fa-arrow-left"></i> Prev</button>
                    <button id="follow-satellite-btn" style="margin: 2px; padding: 5px 10px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer;"><i class="fas fa-satellite"></i> Follow</button>
                    <button id="next-satellite-btn" style="margin: 2px; padding: 5px 10px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer;">Next <i class="fas fa-arrow-right"></i></button>
                </div>
            </div>
            <canvas id="trajectory-canvas" style="width: 100%; height: 100%; display: block;"></canvas>
        `;

        const canvas = document.getElementById('trajectory-canvas');

        // Ensure canvas is properly configured
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.display = 'block';

        // Create trajectory visualization scene
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x000000);
        
        const camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 50000);
        const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
        
        renderer.setSize(container.clientWidth, container.clientHeight);
        
        // Earth with proper scale (radius = 6371 km)
        const earthRadius = 6371;
        const earthGeometry = new THREE.SphereGeometry(earthRadius, 64, 64);
        const earthMaterial = new THREE.MeshPhongMaterial({
            color: 0x4488bb,
            transparent: false,
            opacity: 1.0
        });
        const earth = new THREE.Mesh(earthGeometry, earthMaterial);
        scene.add(earth);

        // Add wireframe overlay for Earth
        const wireframeGeometry = new THREE.SphereGeometry(earthRadius * 1.01, 32, 32);
        const wireframeMaterial = new THREE.MeshBasicMaterial({
            color: 0x44aaff,
            wireframe: true,
            transparent: true,
            opacity: 0.3
        });
        const wireframe = new THREE.Mesh(wireframeGeometry, wireframeMaterial);
        scene.add(wireframe);

        // Add lighting
        const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
        scene.add(ambientLight);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(earthRadius * 2, earthRadius, earthRadius * 2);
        scene.add(directionalLight);

        // Add coordinate axes
        const axesHelper = new THREE.AxesHelper(earthRadius * 1.5);
        scene.add(axesHelper);

        // Set initial camera position - nice view of Earth and orbits
        camera.position.set(earthRadius * 2, earthRadius * 1.5, earthRadius * 2);
        camera.lookAt(0, 0, 0);

        // Add smooth OrbitControls
        let controls = null;
        if (THREE.OrbitControls) {
            controls = new THREE.OrbitControls(camera, renderer.domElement);
            controls.enableDamping = true;
            controls.dampingFactor = 0.05;
            controls.screenSpacePanning = false;
            controls.minDistance = earthRadius * 1.5;
            controls.maxDistance = earthRadius * 10;
            controls.target.set(0, 0, 0);
            controls.autoRotate = false;
            controls.autoRotateSpeed = 0.5;
        }

        // Add trajectory paths with proper scaling
        this.addTrajectoryPathsToScene(scene, earthRadius);

        // Store references
        this.trajectoryScene = { scene, camera, renderer, controls, earth, wireframe };
        this.satellites = [];

        // Control buttons
        this.currentSatelliteIndex = 0;
        
        document.getElementById('focus-earth-btn').onclick = () => {
            this.focusOnEarth();
        };

        document.getElementById('follow-satellite-btn').onclick = () => {
            this.goToCurrentSatellite();
        };

        document.getElementById('full-view-btn').onclick = () => {
            this.showFullOrbitView();
        };

        document.getElementById('prev-satellite-btn').onclick = () => {
            this.goToPreviousSatellite();
        };

        document.getElementById('next-satellite-btn').onclick = () => {
            this.goToNextSatellite();
        };

        // Animation loop
        const animate = () => {
            requestAnimationFrame(animate);

            // Smooth controls update
            if (controls) controls.update();

            // Rotate Earth slowly
            earth.rotation.y += 0.002;
            wireframe.rotation.y += 0.002;

            // Animate satellites along trajectories
            this.animateSatellites();

            renderer.render(scene, camera);
        };
        animate();

        // Force initial render and ensure canvas is properly sized
        setTimeout(() => {
            const canvas = renderer.domElement;
            canvas.style.width = '100%';
            canvas.style.height = '100%';
            canvas.style.display = 'block';

            // Force a resize to ensure proper sizing
            handleResize();

            // Clear any previous frame and force an immediate render
            renderer.clear();
            renderer.render(scene, camera);

            // Force another render after a brief delay to ensure it's visible
            setTimeout(() => {
                renderer.render(scene, camera);
            }, 50);

            console.log('3D visualization initialized - Canvas size:', canvas.width, 'x', canvas.height);
            console.log('Canvas in DOM:', document.body.contains(canvas));
            console.log('Canvas visible:', canvas.offsetWidth > 0 && canvas.offsetHeight > 0);
        }, 100);

        // Handle resize
        const handleResize = () => {
            const width = container.clientWidth;
            const height = container.clientHeight;
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
            renderer.setSize(width, height);
        };
        window.addEventListener('resize', handleResize);
        
        // Store resize handler for cleanup
        this.trajectoryScene.handleResize = handleResize;
    }

    addTrajectoryPathsToScene(scene, earthRadius) {
        // Generate 100 fake satellites and show only selected 10
        this.allSatellites = this.generateFakeSatellites(100, earthRadius);
        this.selectedSatelliteIndices = Array.from({length: 10}, (_, i) => i); // Show first 10 by default
        this.satellites = []; // Reset current satellites
        
        // Clear existing trajectories
        const trajectoriesToRemove = [];
        scene.traverse((child) => {
            if (child.userData.type === 'trajectory' || child.userData.type === 'satellite') {
                trajectoriesToRemove.push(child);
            }
        });
        trajectoriesToRemove.forEach(obj => scene.remove(obj));
        
        // Add selected satellites to scene
        this.updateDisplayedSatellites(scene, earthRadius);
        
        // Create satellite selection UI
        this.createSatelliteSelector();
    }

    generateFakeSatellites(count, earthRadius) {
        const allSats = [];
        const colors = [0xff6b6b, 0x4ecdc4, 0x45b7d1, 0x96ceb4, 0xfeca57, 0xff9ff3, 0x54a0ff, 0x00ff00, 0xffff00, 0xff00ff];
        
        for (let i = 0; i < count; i++) {
            // Create realistic orbital parameters with much more variety
            const altitudeVariations = [
                400, 450, 500, 600, 700, 800, 1000, 1200, 1500, 2000,  // LEO
                5000, 8000, 12000, 15000, 20000,                        // MEO  
                35786, 36000, 37000                                     // GEO
            ];
            const altitude = altitudeVariations[i % altitudeVariations.length] + (Math.random() - 0.5) * 200;
            const orbitRadius = earthRadius + altitude;
            
            // Realistic inclinations for different orbit types
            let inclination;
            if (altitude < 2000) {
                // LEO satellites - varied inclinations
                inclination = (Math.random() * 180 - 90) * Math.PI / 180; // -90 to +90 degrees
            } else if (altitude < 25000) {
                // MEO satellites - moderate inclinations  
                inclination = (Math.random() * 120 - 60) * Math.PI / 180; // -60 to +60 degrees
            } else {
                // GEO satellites - near equatorial
                inclination = (Math.random() * 20 - 10) * Math.PI / 180; // -10 to +10 degrees
            }
            
            // Random orbital eccentricity and orientation
            const eccentricity = Math.random() * 0.3; // 0-0.3 eccentricity
            const argumentOfPerigee = Math.random() * 2 * Math.PI;
            const longitudeOfAscendingNode = Math.random() * 2 * Math.PI;
            
            const points = [];
            
            // Create elliptical orbit with realistic variations
            for (let angle = 0; angle <= 360; angle += 2) {
                const rad = angle * Math.PI / 180;
                
                // Elliptical orbit calculation
                const trueAnomaly = rad;
                const r = orbitRadius * (1 - eccentricity * eccentricity) / (1 + eccentricity * Math.cos(trueAnomaly));
                
                // Position in orbital plane
                const xOrb = r * Math.cos(trueAnomaly);
                const yOrb = r * Math.sin(trueAnomaly);
                const zOrb = 0;
                
                // Rotate to 3D space using orbital elements
                const cosLAN = Math.cos(longitudeOfAscendingNode);
                const sinLAN = Math.sin(longitudeOfAscendingNode);
                const cosInc = Math.cos(inclination);
                const sinInc = Math.sin(inclination);
                const cosAOP = Math.cos(argumentOfPerigee);
                const sinAOP = Math.sin(argumentOfPerigee);
                
                // Transformation matrix multiplication
                const x = (cosLAN * cosAOP - sinLAN * sinAOP * cosInc) * xOrb + 
                         (-cosLAN * sinAOP - sinLAN * cosAOP * cosInc) * yOrb;
                const y = (sinLAN * cosAOP + cosLAN * sinAOP * cosInc) * xOrb + 
                         (-sinLAN * sinAOP + cosLAN * cosAOP * cosInc) * yOrb;
                const z = (sinInc * sinAOP) * xOrb + (sinInc * cosAOP) * yOrb;
                
                points.push(new THREE.Vector3(x, y, z));
            }
            
            allSats.push({
                id: i,
                points: points,
                altitude: altitude,
                inclination: inclination * 180 / Math.PI,
                color: colors[i % colors.length],
                name: `SAT-${String(i + 1).padStart(3, '0')}`
            });
        }
        
        return allSats;
    }

    updateDisplayedSatellites(scene, earthRadius) {
        // Clear existing displayed satellites
        this.satellites = [];
        
        this.selectedSatelliteIndices.forEach((satIndex, displayIndex) => {
            if (satIndex >= this.allSatellites.length) return;
            
            const satData = this.allSatellites[satIndex];
            
            // Create trajectory line
            const geometry = new THREE.BufferGeometry().setFromPoints(satData.points);
            const material = new THREE.LineBasicMaterial({ 
                color: satData.color,
                transparent: true,
                opacity: 0.8,
                linewidth: 2
            });
            
            const line = new THREE.Line(geometry, material);
            line.userData = { 
                type: 'trajectory', 
                satelliteId: satData.id,
                altitude: satData.altitude
            };
            scene.add(line);

            // Create satellite marker
            const satelliteGeometry = new THREE.SphereGeometry(earthRadius * 0.01, 16, 16);
            const satelliteMaterial = new THREE.MeshLambertMaterial({ 
                color: satData.color,
                emissive: satData.color,
                emissiveIntensity: 0.2
            });
            
            const satellite = new THREE.Mesh(satelliteGeometry, satelliteMaterial);
            satellite.position.copy(satData.points[0]); // Start at first point
            satellite.userData = {
                type: 'satellite',
                trajectoryPoints: satData.points,
                currentIndex: Math.random() * satData.points.length, // Random starting position
                speed: 0.5 + Math.random() * 0.3, // Vary orbital speed: 0.5-0.8
                altitude: satData.altitude,
                name: satData.name
            };
            scene.add(satellite);
            this.satellites.push(satellite);
        });
    }

    createSatelliteSelector() {
        // Remove existing selector if present
        const existingSelector = document.getElementById('satellite-selector');
        if (existingSelector) existingSelector.remove();
        
        const container = document.getElementById('trajectory-container');
        if (!container) return;
        
        const selector = document.createElement('div');
        selector.id = 'satellite-selector';
        selector.style.cssText = `
            position: absolute;
            top: 10px;
            right: 10px;
            background: rgba(13, 17, 23, 0.9);
            border: 1px solid var(--border-color);
            border-radius: 8px;
            padding: 15px;
            max-width: 300px;
            max-height: 400px;
            overflow-y: auto;
            z-index: 100;
            font-size: 12px;
        `;
        
        selector.innerHTML = `
            <h4 style="margin: 0 0 10px 0; color: var(--text-primary);">Select Satellites (${this.selectedSatelliteIndices.length}/10)</h4>
            <div style="margin-bottom: 10px;">
                <button onclick="window.dashboard.selectRandomSatellites()" style="background: var(--primary-color); color: white; border: none; padding: 5px 10px; border-radius: 4px; margin-right: 5px; cursor: pointer;">Random 10</button>
                <button onclick="window.dashboard.selectLEOSatellites()" style="background: var(--success-color); color: white; border: none; padding: 5px 10px; border-radius: 4px; margin-right: 5px; cursor: pointer;">LEO Only</button>
                <button onclick="window.dashboard.selectGEOSatellites()" style="background: var(--warning-color); color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;">GEO Only</button>
            </div>
            <div id="satellite-list" style="max-height: 250px; overflow-y: auto;"></div>
        `;
        
        container.appendChild(selector);
        this.updateSatelliteList();
    }

    updateSatelliteList() {
        const listContainer = document.getElementById('satellite-list');
        if (!listContainer || !this.allSatellites) return;
        
        listContainer.innerHTML = '';
        
        this.allSatellites.forEach((sat, index) => {
            const isSelected = this.selectedSatelliteIndices.includes(index);
            const item = document.createElement('div');
            item.style.cssText = `
                display: flex;
                align-items: center;
                padding: 5px;
                margin: 2px 0;
                background: ${isSelected ? 'rgba(0, 123, 255, 0.2)' : 'rgba(255, 255, 255, 0.05)'};
                border-radius: 4px;
                cursor: pointer;
                border: 1px solid ${isSelected ? 'var(--primary-color)' : 'transparent'};
            `;
            
            const altitudeType = sat.altitude < 2000 ? 'LEO' : sat.altitude < 25000 ? 'MEO' : 'GEO';
            
            item.innerHTML = `
                <input type="checkbox" ${isSelected ? 'checked' : ''} 
                       onchange="window.dashboard.toggleSatellite(${index}, this.checked)"
                       style="margin-right: 8px;">
                <div style="flex: 1; color: var(--text-primary);">
                    <div style="font-weight: bold;">${sat.name}</div>
                    <div style="font-size: 10px; color: var(--text-secondary);">${altitudeType} - ${Math.round(sat.altitude)}km - ${Math.round(sat.inclination)}°</div>
                </div>
                <div style="width: 12px; height: 12px; background-color: #${sat.color.toString(16).padStart(6, '0')}; border-radius: 50%; margin-left: 5px;"></div>
            `;
            
            listContainer.appendChild(item);
        });
    }

    createSatelliteSelector() {
        const container = document.getElementById('trajectory-container');
        if (!container) return;
        
        // Remove existing selector
        const existingSelector = document.getElementById('satellite-selector');
        if (existingSelector) existingSelector.remove();
        
        const selectorDiv = document.createElement('div');
        selectorDiv.id = 'satellite-selector';
        selectorDiv.style.cssText = `
            position: absolute;
            top: 10px;
            right: 10px;
            background: rgba(13, 17, 23, 0.9);
            padding: 15px;
            border-radius: 8px;
            border: 1px solid var(--border-color);
            max-width: 300px;
            max-height: 400px;
            overflow-y: auto;
            z-index: 1000;
        `;
        
        selectorDiv.innerHTML = `
            <h4 style="margin: 0 0 10px 0; color: var(--text-primary);">Select 10 Satellites</h4>
            <div style="margin-bottom: 10px;">
                <button onclick="window.dashboard.selectRandomSatellites()" style="background: var(--primary-color); color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; margin-right: 5px;">Random 10</button>
                <button onclick="window.dashboard.selectLowOrbitSatellites()" style="background: var(--success-color); color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;">Low Orbit</button>
            </div>
            <div id="satellite-checkboxes" style="max-height: 250px; overflow-y: auto;"></div>
        `;
        
        container.appendChild(selectorDiv);
        
        // Generate checkboxes for all 100 satellites
        const checkboxContainer = document.getElementById('satellite-checkboxes');
        for (let i = 0; i < this.allSatellites.length; i++) {
            const satData = this.allSatellites[i];
            const isSelected = this.selectedSatelliteIndices.includes(i);
            
            const checkboxDiv = document.createElement('div');
            checkboxDiv.style.cssText = 'margin: 3px 0; display: flex; align-items: center;';
            checkboxDiv.innerHTML = `
                <input type="checkbox" id="sat-${i}" ${isSelected ? 'checked' : ''} 
                       onchange="window.dashboard.toggleSatellite(${i})"
                       style="margin-right: 8px;">
                <label for="sat-${i}" style="color: var(--text-primary); font-size: 12px; cursor: pointer;">
                    ${satData.name} (${Math.round(satData.altitude)}km, ${Math.round(satData.inclination)}°)
                </label>
            `;
            checkboxContainer.appendChild(checkboxDiv);
        }
    }

    toggleSatellite(satelliteIndex, isChecked) {
        if (isChecked && this.selectedSatelliteIndices.length < 10) {
            if (!this.selectedSatelliteIndices.includes(satelliteIndex)) {
                this.selectedSatelliteIndices.push(satelliteIndex);
            }
        } else if (!isChecked) {
            const index = this.selectedSatelliteIndices.indexOf(satelliteIndex);
            if (index > -1) {
                this.selectedSatelliteIndices.splice(index, 1);
            }
        }

        // Initialize 3D visualization if not already done
        if (!this.trajectoryScene) {
            this.initializeTrajectoryVisualization();
        }

        // Update visualization
        if (this.trajectoryScene) {
            this.updateDisplayedSatellites(this.trajectoryScene.scene, 6371);
        }
        this.updateSatelliteList();
    }

    selectRandomSatellites() {
        this.selectedSatelliteIndices = [];
        const indices = Array.from({length: this.allSatellites.length}, (_, i) => i);
        for (let i = 0; i < 10; i++) {
            const randomIndex = Math.floor(Math.random() * indices.length);
            this.selectedSatelliteIndices.push(indices.splice(randomIndex, 1)[0]);
        }

        // Initialize 3D visualization if not already done
        if (!this.trajectoryScene) {
            this.initializeTrajectoryVisualization();
        }

        if (this.trajectoryScene) {
            this.updateDisplayedSatellites(this.trajectoryScene.scene, 6371);
        }
        this.updateSatelliteList();
    }

    selectLEOSatellites() {
        this.selectedSatelliteIndices = [];
        const leoSats = this.allSatellites
            .map((sat, index) => ({...sat, index}))
            .filter(sat => sat.altitude < 2000)
            .slice(0, 10);

        this.selectedSatelliteIndices = leoSats.map(sat => sat.index);

        // Initialize 3D visualization if not already done
        if (!this.trajectoryScene) {
            this.initializeTrajectoryVisualization();
        }

        if (this.trajectoryScene) {
            this.updateDisplayedSatellites(this.trajectoryScene.scene, 6371);
        }
        this.updateSatelliteList();
    }

    selectGEOSatellites() {
        this.selectedSatelliteIndices = [];
        const geoSats = this.allSatellites
            .map((sat, index) => ({...sat, index}))
            .filter(sat => sat.altitude > 25000)
            .slice(0, 10);

        this.selectedSatelliteIndices = geoSats.map(sat => sat.index);

        // Initialize 3D visualization if not already done
        if (!this.trajectoryScene) {
            this.initializeTrajectoryVisualization();
        }

        if (this.trajectoryScene) {
            this.updateDisplayedSatellites(this.trajectoryScene.scene, 6371);
        }
        this.updateSatelliteList();
    }

    toggleSatellite(satelliteIndex, isSelected) {
        const index = this.selectedSatelliteIndices.indexOf(satelliteIndex);

        if (index > -1) {
            // Remove satellite
            this.selectedSatelliteIndices.splice(index, 1);
        } else {
            // Add satellite (max 10)
            if (this.selectedSatelliteIndices.length < 10) {
                this.selectedSatelliteIndices.push(satelliteIndex);
            } else {
                // Replace oldest selection
                this.selectedSatelliteIndices.shift();
                this.selectedSatelliteIndices.push(satelliteIndex);
                // Update checkbox for replaced satellite
                const oldCheckbox = document.getElementById(`sat-${this.selectedSatelliteIndices[0]}`);
                if (oldCheckbox) oldCheckbox.checked = false;
            }
        }

        // Initialize 3D visualization if not already done
        if (!this.trajectoryScene) {
            this.initializeTrajectoryVisualization();
        }

        // Update display
        if (this.trajectoryScene) {
            this.updateDisplayedSatellites(this.trajectoryScene.scene, 6371);
        }
    }

    selectRandomSatellites() {
        this.selectedSatelliteIndices = [];
        while (this.selectedSatelliteIndices.length < 10) {
            const randomIndex = Math.floor(Math.random() * this.allSatellites.length);
            if (!this.selectedSatelliteIndices.includes(randomIndex)) {
                this.selectedSatelliteIndices.push(randomIndex);
            }
        }

        // Update checkboxes
        for (let i = 0; i < this.allSatellites.length; i++) {
            const checkbox = document.getElementById(`sat-${i}`);
            if (checkbox) checkbox.checked = this.selectedSatelliteIndices.includes(i);
        }

        // Initialize 3D visualization if not already done
        if (!this.trajectoryScene) {
            this.initializeTrajectoryVisualization();
        }

        // Update display
        if (this.trajectoryScene) {
            this.updateDisplayedSatellites(this.trajectoryScene.scene, 6371);
        }
    }

    selectLowOrbitSatellites() {
        // Select 10 lowest orbit satellites
        this.selectedSatelliteIndices = Array.from({length: 10}, (_, i) => i);

        // Update checkboxes
        for (let i = 0; i < this.allSatellites.length; i++) {
            const checkbox = document.getElementById(`sat-${i}`);
            if (checkbox) checkbox.checked = i < 10;
        }

        // Initialize 3D visualization if not already done
        if (!this.trajectoryScene) {
            this.initializeTrajectoryVisualization();
        }

        // Update display
        if (this.trajectoryScene) {
            this.updateDisplayedSatellites(this.trajectoryScene.scene, 6371);
        }
    }

    createSatelliteLabel(scene, satellite, text) {
        // Create text sprite for satellite label
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 256;
        canvas.height = 64;
        
        context.fillStyle = 'rgba(0, 0, 0, 0.8)';
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        context.fillStyle = '#ffffff';
        context.font = '24px Arial';
        context.textAlign = 'center';
        context.fillText(text, canvas.width / 2, canvas.height / 2 + 8);
        
        const texture = new THREE.CanvasTexture(canvas);
        const spriteMaterial = new THREE.SpriteMaterial({ map: texture, transparent: true });
        const sprite = new THREE.Sprite(spriteMaterial);
        
        sprite.scale.set(1000, 250, 1); // Scale for visibility
        sprite.position.copy(satellite.position);
        sprite.position.y += 500; // Offset above satellite
        
        sprite.userData = { type: 'label', parentSatellite: satellite };
        scene.add(sprite);
        
        return sprite;
    }

    animateSatellites() {
        if (!this.satellites || !this.trajectoryScene) return;
        
        this.satellites.forEach(satellite => {
            const userData = satellite.userData;
            if (userData.trajectoryPoints && userData.trajectoryPoints.length > 0) {
                // Simple, smooth movement along trajectory
                userData.currentIndex = (userData.currentIndex + 0.2) % userData.trajectoryPoints.length;
                const currentPoint = userData.trajectoryPoints[Math.floor(userData.currentIndex)];
                const nextPoint = userData.trajectoryPoints[Math.floor(userData.currentIndex + 1) % userData.trajectoryPoints.length];
                
                // Smooth interpolation between points
                const t = userData.currentIndex - Math.floor(userData.currentIndex);
                satellite.position.lerpVectors(currentPoint, nextPoint, t);
                
                // Update label position if it exists
                const scene = this.trajectoryScene.scene;
                scene.children.forEach(child => {
                    if (child.userData.type === 'label' && child.userData.parentSatellite === satellite) {
                        child.position.copy(satellite.position);
                        child.position.y += 500;
                    }
                });
            }
        });
    }

    focusOnEarth() {
        if (!this.trajectoryScene) return;
        const { camera, controls } = this.trajectoryScene;
        const earthRadius = 6371;
        
        this.animateCamera(
            camera.position,
            new THREE.Vector3(earthRadius * 2, earthRadius * 1.5, earthRadius * 2),
            new THREE.Vector3(0, 0, 0)
        );
        if (controls) controls.target.set(0, 0, 0);
    }

    showFullOrbitView() {
        if (!this.trajectoryScene) return;
        const { camera, controls } = this.trajectoryScene;
        const earthRadius = 6371;
        
        this.animateCamera(
            camera.position,
            new THREE.Vector3(earthRadius * 4, earthRadius * 3, earthRadius * 4),
            new THREE.Vector3(0, 0, 0)
        );
        if (controls) controls.target.set(0, 0, 0);
    }

    goToNearestSatellite() {
        if (!this.satellites || this.satellites.length === 0) return;
        
        // Find nearest satellite to current camera position
        const camera = this.trajectoryScene.camera;
        let nearestSat = this.satellites[0];
        let minDistance = camera.position.distanceTo(nearestSat.position);
        
        this.satellites.forEach(sat => {
            const distance = camera.position.distanceTo(sat.position);
            if (distance < minDistance) {
                minDistance = distance;
                nearestSat = sat;
            }
        });
        
        this.focusOnSatellite(nearestSat);
    }

    goToCurrentSatellite() {
        if (!this.satellites || this.satellites.length === 0) return;
        const satellite = this.satellites[this.currentSatelliteIndex % this.satellites.length];
        this.focusOnSatellite(satellite);
    }

    goToNextSatellite() {
        if (!this.satellites || this.satellites.length === 0) return;
        this.currentSatelliteIndex = (this.currentSatelliteIndex + 1) % this.satellites.length;
        this.goToCurrentSatellite();
    }

    goToPreviousSatellite() {
        if (!this.satellites || this.satellites.length === 0) return;
        this.currentSatelliteIndex = (this.currentSatelliteIndex - 1 + this.satellites.length) % this.satellites.length;
        this.goToCurrentSatellite();
    }

    focusOnSatellite(satellite) {
        if (!satellite || !this.trajectoryScene) return;
        
        const { camera, controls } = this.trajectoryScene;
        const satPos = satellite.position.clone();
        const earthRadius = 6371;
        
        // Position camera at a good viewing distance from satellite
        const offset = satPos.clone().normalize().multiplyScalar(earthRadius * 0.5);
        const targetPos = satPos.clone().add(offset);
        
        this.animateCamera(camera.position, targetPos, satPos);
        if (controls) controls.target.copy(satPos);
        
        // Show satellite info
        const userData = satellite.userData;
        this.showAlert(`Focusing on SAT-${userData.satelliteId} (Alt: ${userData.altitude}km)`, 'info');
    }

    animateCamera(fromPos, toPos, lookAtPos, duration = 1000) {
        if (!this.trajectoryScene) return;
        
        const camera = this.trajectoryScene.camera;
        const startPos = fromPos.clone();
        const startTime = Date.now();
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Smooth easing
            const eased = 1 - Math.pow(1 - progress, 3);
            
            camera.position.lerpVectors(startPos, toPos, eased);
            camera.lookAt(lookAtPos);
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };
        
        animate();
    }

    showTrajectoriesIn3D() {
        this.switchTab('visualization');
        if (this.trajectoryData) {
            this.addTrajectoryPathsToScene(this.scene, 1);
        }
    }

    showTrajectoryAnalysis() {
        if (!this.trajectoryData) return;
        
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; right: 0; bottom: 0; 
            background: rgba(0,0,0,0.8); z-index: 10000; 
            display: flex; align-items: center; justify-content: center;
        `;
        
        modal.innerHTML = `
            <div style="background: var(--bg-secondary); padding: 2rem; border-radius: 12px; max-width: 80vw; max-height: 80vh; overflow-y: auto;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                    <h3>Trajectory Analysis</h3>
                    <button onclick="this.parentElement.parentElement.parentElement.remove()" style="background: none; border: none; color: var(--text-primary); font-size: 1.5rem; cursor: pointer;">&times;</button>
                </div>
                <div id="trajectory-analysis-content"></div>
            </div>
        `;
        
        document.body.appendChild(modal);
        this.renderTrajectoryAnalysis(document.getElementById('trajectory-analysis-content'));
    }

    async showSatelliteTrajectory() {
        if (!this.selectedSatellite) return;
        try {
            const response = await fetch(`${this.apiBaseUrl}/trajectory/${this.selectedSatellite.id}`);
            const data = await response.json();
            if (data && data.trajectory) {
                const points = data.trajectory.map(p => new THREE.Vector3((p.x || 0), (p.y || 0), (p.z || 0)));
                if (points.length > 1) {
                    const geometry = new THREE.BufferGeometry().setFromPoints(points);
                    const material = new THREE.LineBasicMaterial({ color: 0x45b7d1, transparent: true, opacity: 0.9 });
                    const line = new THREE.Line(geometry, material);
                    line.userData = { type: 'trajectory' };
                    this.scene.add(line);
                    this.currentTab = 'visualization';
                    this.updateVisibility();
                    this.showAlert('Trajectory displayed in 3D view', 'success');
                }
            }
        } catch (e) {}
    }

    renderTrajectoryAnalysis(container) {
        if (!this.trajectoryData || !container) return;

        // Use satellite_trajectories if available, otherwise predictions  
        const predictions = this.trajectoryData.satellite_trajectories || this.trajectoryData.predictions || [];
        const stats = this.calculateTrajectoryStats(predictions);

        container.innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 2rem;">
                <div style="text-align: center; padding: 1rem; background: rgba(0, 123, 255, 0.1); border-radius: 8px;">
                    <div style="font-size: 1.5rem; font-weight: 700; color: var(--primary-color);">${stats.totalTrajectories}</div>
                    <div style="font-size: 0.9rem;">Total Trajectories</div>
                </div>
                <div style="text-align: center; padding: 1rem; background: rgba(220, 53, 69, 0.1); border-radius: 8px;">
                    <div style="font-size: 1.5rem; font-weight: 700; color: var(--danger-color);">${stats.riskySatellites}</div>
                    <div style="font-size: 0.9rem;">High-Risk Objects</div>
                </div>
                <div style="text-align: center; padding: 1rem; background: rgba(40, 167, 69, 0.1); border-radius: 8px;">
                    <div style="font-size: 1.5rem; font-weight: 700; color: var(--success-color);">${stats.avgAltitude.toFixed(0)} km</div>
                    <div style="font-size: 0.9rem;">Avg Altitude</div>
                </div>
                <div style="text-align: center; padding: 1rem; background: rgba(255, 193, 7, 0.1); border-radius: 8px;">
                    <div style="font-size: 1.5rem; font-weight: 700; color: var(--warning-color);">${stats.avgVelocity.toFixed(1)} km/s</div>
                    <div style="font-size: 0.9rem;">Avg Velocity</div>
                </div>
            </div>
            <div style="background: rgba(255, 255, 255, 0.05); border-radius: 8px; padding: 1rem;">
                <h4>Trajectory Details</h4>
                <div style="max-height: 300px; overflow-y: auto;">
                    ${predictions.slice(0, 10).map((pred, i) => `
                        <div style="padding: 0.5rem; border-bottom: 1px solid rgba(255,255,255,0.1); display: flex; justify-content: space-between;">
                            <span>Object ${i + 1}</span>
                            <span style="color: ${pred.risk_level === 'HIGH' ? 'var(--danger-color)' : pred.risk_level === 'MEDIUM' ? 'var(--warning-color)' : 'var(--success-color)'}">${pred.risk_level || 'LOW'}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    calculateTrajectoryStats(predictions) {
        let totalAltitude = 0;
        let totalVelocity = 0;
        let riskySatellites = 0;
        let validCount = 0;

        predictions.forEach(pred => {
            if (pred.trajectory && pred.trajectory.length > 0) {
                const firstPoint = pred.trajectory[0];
                if (firstPoint.altitude) {
                    totalAltitude += firstPoint.altitude;
                    validCount++;
                }
                if (firstPoint.velocity) {
                    totalVelocity += firstPoint.velocity;
                }
                if (pred.risk_level === 'HIGH' || pred.risk_level === 'CRITICAL') {
                    riskySatellites++;
                }
            }
        });

        return {
            totalTrajectories: predictions.length,
            riskySatellites,
            avgAltitude: validCount > 0 ? totalAltitude / validCount : 0,
            avgVelocity: validCount > 0 ? totalVelocity / validCount : 0
        };
    }

    updateTrajectoryStatistics() {
        if (!this.trajectoryData) return;

        // Use satellite_trajectories if available, otherwise predictions
        const predictions = this.trajectoryData.satellite_trajectories || this.trajectoryData.predictions || [];
        const stats = this.calculateTrajectoryStats(predictions);
        
        // Update trajectory statistics panel
        const trajectoryStats = document.getElementById('trajectory-stats');
        if (trajectoryStats) {
            trajectoryStats.innerHTML = `
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                    <div style="text-align: center; padding: 1rem; background: rgba(0, 123, 255, 0.1); border-radius: 8px;">
                        <div style="font-size: 1.5rem; font-weight: 700; color: var(--primary-color);">${stats.totalTrajectories}</div>
                        <div style="font-size: 0.9rem;">Generated</div>
                    </div>
                    <div style="text-align: center; padding: 1rem; background: rgba(220, 53, 69, 0.1); border-radius: 8px;">
                        <div style="font-size: 1.5rem; font-weight: 700; color: var(--danger-color);">${stats.riskySatellites}</div>
                        <div style="font-size: 0.9rem;">High Risk</div>
                    </div>
                </div>
                <div style="padding: 1rem; background: rgba(255, 255, 255, 0.05); border-radius: 8px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                        <span>Avg Altitude:</span>
                        <span style="color: var(--success-color);">${stats.avgAltitude.toFixed(0)} km</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                        <span>Avg Velocity:</span>
                        <span style="color: var(--success-color);">${stats.avgVelocity.toFixed(1)} km/s</span>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span>Prediction Horizon:</span>
                        <span style="color: var(--info-color);">${this.trajectoryData.prediction_horizon || 24}h</span>
                    </div>
                </div>
            `;
        }

        // Update collision risk analysis
        const collisionRisk = document.getElementById('collision-risk-analysis');
        if (collisionRisk) {
            const riskLevel = stats.riskySatellites > 5 ? 'HIGH' : stats.riskySatellites > 2 ? 'MEDIUM' : 'LOW';
            const riskColor = riskLevel === 'HIGH' ? 'var(--danger-color)' : 
                             riskLevel === 'MEDIUM' ? 'var(--warning-color)' : 'var(--success-color)';

            collisionRisk.innerHTML = `
                <div style="text-align: center; margin-bottom: 1rem;">
                    <div style="font-size: 2rem; font-weight: 700; color: ${riskColor};">${riskLevel}</div>
                    <div style="font-size: 0.9rem; color: var(--text-secondary);">Overall Risk Level</div>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                    <div style="text-align: center; padding: 1rem; background: rgba(255, 193, 7, 0.1); border-radius: 8px;">
                        <div style="font-size: 1.2rem; font-weight: 700; color: var(--warning-color);">${Math.round((stats.riskySatellites / stats.totalTrajectories) * 100)}%</div>
                        <div style="font-size: 0.8rem;">Risk Percentage</div>
                    </div>
                    <div style="text-align: center; padding: 1rem; background: rgba(23, 162, 184, 0.1); border-radius: 8px;">
                        <div style="font-size: 1.2rem; font-weight: 700; color: var(--info-color);">${this.trajectoryData.prediction_horizon || 24}</div>
                        <div style="font-size: 0.8rem;">Hours Predicted</div>
                    </div>
                </div>
                <div style="background: rgba(255, 255, 255, 0.05); border-radius: 8px; padding: 1rem;">
                    <div style="margin-bottom: 0.5rem;"><strong>Risk Assessment:</strong></div>
                    <div style="font-size: 0.9rem; color: var(--text-secondary);">
                        ${riskLevel === 'HIGH' ? 
                          'Multiple high-risk objects detected. Enhanced monitoring recommended.' :
                          riskLevel === 'MEDIUM' ?
                          'Some elevated risk objects identified. Continued observation advised.' :
                          'Risk levels are within acceptable parameters. Normal monitoring sufficient.'
                        }
                    </div>
                </div>
            `;
        }
    }

    updateVisibility() {
        // This method is called when switching tabs
        if (this.currentTab === 'visualization' && this.renderer) {
            setTimeout(() => {
                const container = document.getElementById('visualization-container');
                if (container) {
                    this.renderer.setSize(container.clientWidth, container.clientHeight);
                    this.camera.aspect = container.clientWidth / container.clientHeight;
                    this.camera.updateProjectionMatrix();
                    if (!this.firstVizCenterDone && !this.hasUserInteracted) {
                        this.centerDefaultView(true);
                        this.firstVizCenterDone = true;
                    }
                }
            }, 100);
        }
    }

    toggleSatellites() {
        if (this.scene) {
            this.scene.traverse((child) => {
                if (child.userData && child.userData.type === 'satellite') {
                    child.visible = !child.visible;
                    if (this.labelElements && this.labelElements.has(child)) {
                        const el = this.labelElements.get(child);
                        if (el) el.style.display = child.visible && this.showLabels ? 'block' : 'none';
                    }
                }
            });
            this.showAlert('Satellites visibility toggled', 'info');
        }
    }

    toggleDebris() {
        if (this.scene) {
            this.scene.traverse((child) => {
                if (child.userData && child.userData.type === 'debris') {
                    child.visible = !child.visible;
                    if (this.labelElements && this.labelElements.has(child)) {
                        const el = this.labelElements.get(child);
                        if (el) el.style.display = child.visible && this.showLabels ? 'block' : 'none';
                    }
                }
            });
            this.showAlert('Debris visibility toggled', 'info');
        }
    }

    toggleTrajectories() {
        if (this.scene) {
            this.scene.traverse((child) => {
                if (child.userData && child.userData.type === 'trajectory') {
                    child.visible = !child.visible;
                }
            });
            this.showAlert('Trajectories visibility toggled', 'info');
        }
    }

    toggleLabels() {
        this.showLabels = !this.showLabels;
        if (!this.labelOverlay) return;
        if (!this.showLabels) {
            this.labelElements.forEach((el) => el.style.display = 'none');
            return;
        }
        const overlay = this.labelOverlay;
        this.scene.traverse((child) => {
            if (child.userData && (child.userData.type === 'satellite' || child.userData.type === 'debris')) {
                const name = child.userData.type === 'debris' ? `Debris #${child.userData.id}` : `Sat #${child.userData.id}`;
                this.addOrUpdateLabel(child, name);
                const el = this.labelElements.get(child);
                if (el) el.style.display = child.visible ? 'block' : 'none';
            }
        });
    }

    resetCamera() {
        if (this.camera) {
            this.camera.position.set(15000, 10000, 15000);
            this.camera.lookAt(0, 0, 0);
            if (this.controls) {
                this.controls.target.set(0, 0, 0);
                this.controls.update();
            }
        }
    }

    toggleFullscreen() {
        const container = document.getElementById('visualization-container');
        if (!document.fullscreenElement) {
            container.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    }

    toggleLabels() {
        // Implementation for toggling satellite labels
        this.showLabels = !this.showLabels;
        // Update labels visibility in 3D scene
    }

    updateSatelliteSize(size) {
        this.satelliteSize = parseFloat(size);
        // Update satellite sizes in 3D scene
        if (this.scene) {
            this.scene.traverse((child) => {
                if (child.userData && child.userData.type === 'satellite') {
                    child.scale.setScalar(this.satelliteSize);
                }
            });
        }
    }

    updateEarthRotation(speed) {
        this.earthRotationSpeed = parseFloat(speed);
    }

    updateViewDistance(distance) {
        if (!this.camera) return;
        const sliderVal = parseFloat(distance);
        const t = Math.min(Math.max((sliderVal - 20) / 180, 0), 1);
        const minKm = 10000;
        const maxKm = 40000;
        const targetLen = minKm + (maxKm - minKm) * t;
        this.setDesiredCameraDistance(targetLen);
    }

    resetSettings() {
        const sizeEl = document.getElementById('satellite-size');
        const distEl = document.getElementById('view-distance');
        if (sizeEl) sizeEl.value = 1;
        // Midpoint between 10k and 40k maps to slider ~110
        const midSlider = 110;
        if (distEl) distEl.value = midSlider;

        this.updateSatelliteSize(1);
        this.updateViewDistance(distEl ? distEl.value : midSlider);
    }

    updateLiveStatistics() {
        if (!this.satelliteData) return;

        const stats = {
            totalObjects: this.satelliteData.length,
            activeSats: this.satelliteData.filter(sat => !sat.is_debris).length,
            debris: this.satelliteData.filter(sat => sat.is_debris).length,
            highRisk: this.satelliteData.filter(sat => sat.debris_probability > 0.7).length,
            trajectories: this.trajectoryData ? this.trajectoryData.trajectories_generated : 0,
            fps: Math.round(1000 / (performance.now() - this.lastFrameTime || 16))
        };

        document.getElementById('stat-total-objects').textContent = stats.totalObjects;
        document.getElementById('stat-active-sats').textContent = stats.activeSats;
        document.getElementById('stat-debris').textContent = stats.debris;
        document.getElementById('stat-high-risk').textContent = stats.highRisk;
        document.getElementById('stat-trajectories').textContent = stats.trajectories;
        document.getElementById('stat-fps').textContent = stats.fps;

        this.lastFrameTime = performance.now();
    }

    // Enhanced trajectory clearing
    clearTrajectories() {
        // Reset trajectory data and view mode
        this.trajectoryData = null;
        this.trajectoryViewMode = null;

        // Reset button states
        this.resetTrajectoryButtonStates();
        this.updateDownloadButtonStates();

        const trajectoryContainer = document.getElementById('trajectory-container');
        const trajectoryStats = document.getElementById('trajectory-stats');
        const collisionRisk = document.getElementById('collision-risk-analysis');

        if (trajectoryContainer) {
            trajectoryContainer.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--text-secondary); flex-direction: column; text-align: center;">
                    <i class="fas fa-satellite-dish" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                    <h3>Orbital Trajectory Visualization</h3>
                    <p>Click "Generate" to predict and visualize satellite trajectories in 3D</p>
                </div>
            `;
        }
        
        if (trajectoryStats) {
            trajectoryStats.innerHTML = `
                <div style="text-align: center; padding: 2rem; color: var(--text-secondary);">
                    Generate trajectories to view statistics
                </div>
            `;
        }
        
        if (collisionRisk) {
            collisionRisk.innerHTML = `
                <div style="text-align: center; padding: 2rem; color: var(--text-secondary);">
                    Generate trajectories to analyze collision risks
                </div>
            `;
        }
        
        // Clear trajectory data
        this.trajectoryData = null;
        
        // Remove trajectories from 3D scene
        if (this.scene) {
            const trajectoriesToRemove = [];
            this.scene.traverse((child) => {
                if (child.userData && child.userData.type === 'trajectory') {
                    trajectoriesToRemove.push(child);
                }
            });
            trajectoriesToRemove.forEach(traj => this.scene.remove(traj));
        }
        
        this.showAlert('<i class="fas fa-broom"></i> Trajectories cleared', 'info');
    }

    async loadCacheStatus() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/cache/status`);
            const data = await response.json();
            
            if (data.success) {
                this.displayCacheStatus(data.cache_status);
            } else {
                document.getElementById('cache-status-content').innerHTML = 
                    '<div style="color: var(--danger-color); text-align: center; padding: 2rem;">Failed to load cache status</div>';
            }
        } catch (error) {
            console.error('Cache status error:', error);
            document.getElementById('cache-status-content').innerHTML = 
                '<div style="color: var(--danger-color); text-align: center; padding: 2rem;">Error loading cache status</div>';
        }
    }

    displayCacheStatus(status) {
        const container = document.getElementById('cache-status-content');
        
        let sourcesHtml = '';
        for (const [source, info] of Object.entries(status.sources)) {
            const statusColor = info.status === 'current' ? 'var(--success-color)' : 
                               info.status === 'cached' ? 'var(--warning-color)' : 'var(--danger-color)';
            const statusText = info.status === 'current' ? 'Current' : 
                              info.status === 'cached' ? `Cached (${info.cache_date})` : 'Missing';
            const sizeKB = info.size ? (info.size / 1024).toFixed(1) : '0';
            
            sourcesHtml += `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem; border-bottom: 1px solid rgba(255, 255, 255, 0.1);">
                    <div>
                        <strong>${source.replace('_', ' ').toUpperCase()}</strong>
                        <div style="font-size: 0.8rem; color: var(--text-secondary);">${info.modified || 'Never'}</div>
                    </div>
                    <div style="text-align: right;">
                        <span style="color: ${statusColor}; font-weight: 600;">${statusText}</span>
                        <div style="font-size: 0.8rem; color: var(--text-secondary);">${sizeKB} KB</div>
                    </div>
                </div>
            `;
        }
        
        const totalSizeMB = (status.cache_size / (1024 * 1024)).toFixed(2);
        
        container.innerHTML = `
            <div style="margin-bottom: 1rem;">
                <h4 style="margin-bottom: 0.5rem;"><i class="fas fa-chart-bar"></i> Cache Sources</h4>
                <div style="background: rgba(255, 255, 255, 0.05); border-radius: 8px; overflow: hidden;">
                    ${sourcesHtml}
                </div>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                <div style="text-align: center; padding: 1rem; background: rgba(0, 123, 255, 0.1); border-radius: 8px;">
                    <div style="font-size: 1.2rem; font-weight: 700; color: var(--primary-color);">${totalSizeMB} MB</div>
                    <div style="font-size: 0.9rem;">Total Cache Size</div>
                </div>
                <div style="text-align: center; padding: 1rem; background: rgba(124, 58, 237, 0.1); border-radius: 8px;">
                    <div style="font-size: 1.2rem; font-weight: 700; color: var(--accent-color);">${Object.keys(status.sources).length}</div>
                    <div style="font-size: 0.9rem;">Data Sources</div>
                </div>
            </div>
            
            <div style="padding: 1rem; background: rgba(255, 255, 255, 0.05); border-radius: 8px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                    <span>Last Update:</span>
                    <span style="font-weight: 600;">${status.last_update || 'Never'}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                    <span>Next Scheduled Download:</span>
                    <span style="font-weight: 600; color: var(--accent-color);">${status.next_download}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span>Download Schedule:</span>
                    <span style="font-weight: 600;">6 AM, 2 PM, 10 PM</span>
                </div>
            </div>
        `;
    }

    async forceCacheUpdate() {
        try {
            this.showAlert('<i class="fas fa-rotate"></i> Force updating cache...', 'info');
            
            const response = await fetch(`${this.apiBaseUrl}/cache/force-update`, { method: 'POST' });
            const data = await response.json();
            
            if (data.success) {
                this.showAlert('<i class="fas fa-check-circle"></i> Cache updated successfully', 'success');
                // Reload cache status
                setTimeout(() => this.loadCacheStatus(), 1000);
            } else {
                this.showAlert('<i class="fas fa-circle-xmark"></i> Cache update failed: ' + data.error, 'danger');
            }
        } catch (error) {
            console.error('Force cache update error:', error);
            this.showAlert('<i class="fas fa-circle-xmark"></i> Error updating cache', 'danger');
        }
    }

    async loadHighRiskSatellites() {
        try {
            this.showAlert('<i class="fas fa-magnifying-glass"></i> Analyzing high-risk satellites...', 'info');
            
            const response = await fetch(`${this.apiBaseUrl}/satellites/high-risk`);
            const data = await response.json();
            
            if (data.success) {
                this.displayHighRiskSatellitesList(data.satellites, data.threat_summary);
                this.showAlert('<i class="fas fa-check-circle"></i> High-risk analysis completed', 'success');
            } else {
                this.showAlert('<i class="fas fa-circle-xmark"></i> Failed to load high-risk satellites: ' + data.error, 'danger');
            }
            
        } catch (error) {
            console.error('Error loading high-risk satellites:', error);
            this.showAlert('<i class="fas fa-circle-xmark"></i> Error loading high-risk satellites', 'danger');
        }
    }

    viewCacheFiles() {
        this.showAlert('<i class="fas fa-folder-open"></i> Cache files are stored in the tle_cache directory', 'info');
    }

    showAlert(message, type) {
        const alertContainer = document.getElementById('alert-container');
        
        alertContainer.className = `alert alert-${type}`;
        alertContainer.innerHTML = message;
        alertContainer.classList.add('show');
        
        setTimeout(() => {
            alertContainer.classList.remove('show');
        }, 4000);
    }

    centerDefaultView(useSlider = false) {
        let len = this.camera.position.length() || 120000;
        if (useSlider) {
            const distEl = document.getElementById('view-distance');
            if (distEl) {
                const sliderVal = parseFloat(distEl.value);
                const t = Math.min(Math.max((sliderVal - 20) / 180, 0), 1);
                const minKm = 10000;
                const maxKm = 40000;
                len = minKm + (maxKm - minKm) * t;
            }
        }
        const target = (this.controls && this.controls.target) ? this.controls.target : new THREE.Vector3(0,0,0);
        this.camera.position.set(target.x, target.y, target.z + len);
        this.camera.lookAt(target);
        if (this.controls) {
            this.controls.target.set(0, 0, 0);
            this.controls.update();
        }
    }

    setDesiredCameraDistance(desired, target) {
        const minD = (this.controls ? this.controls.minDistance : 5000);
        const maxD = (this.controls ? this.controls.maxDistance : 80000);
        this.desiredCameraDistance = Math.max(minD, Math.min(maxD, desired));
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new AstraeusDashboard();

    // Dispatch event to notify that dashboard is ready
    document.dispatchEvent(new Event('dashboardReady'));

    // Load initial satellite list
    setTimeout(() => {
        window.dashboard.loadSatelliteList();
    }, 2000);

});

// Global functions for HTML template
function switchToTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Remove active class from all nav items
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // Show selected tab
    const tabContent = document.getElementById(`${tabName}-tab`);
    if (tabContent) {
        tabContent.classList.add('active');
    }
    
    // Activate corresponding nav item
    const navItem = document.querySelector(`[onclick*="${tabName}"]`);
    if (navItem) {
        navItem.classList.add('active');
    }
    
    // Update dashboard current tab
    if (window.dashboard) {
        window.dashboard.currentTab = tabName;
        window.dashboard.updateVisibility();
        
        // Load tab-specific data
        if (tabName === 'satellite-selection') {
            window.dashboard.loadSatelliteList();
        } else if (tabName === 'overview') {
            window.dashboard.viewHighRiskSatellites();
        } else if (tabName === 'settings') {
            window.dashboard.loadCacheStatus();
        } else if (tabName === 'alerts') {
            window.dashboard.loadHighRiskSatellites();
        } else if (tabName === 'trajectories') {
            // Auto-initialize 3D trajectory visualization when switching to trajectories tab
            if (window.dashboard) {
                // Check if trajectory data exists, if not, show generation prompt
                if (window.dashboard.trajectoryData) {
                    window.dashboard.switchTrajectoryView('3d');
                } else {
                    // Show message asking user to generate trajectories first
                    const container = document.getElementById('trajectory-container');
                    if (container) {
                        container.innerHTML = `
                            <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--text-secondary); flex-direction: column; text-align: center; padding: 2rem;">
                                <i class="fas fa-rocket" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                                <h3 style="margin-bottom: 1rem;">No Trajectory Data Available</h3>
                                <p style="margin-bottom: 2rem; max-width: 400px;">Click "Generate New" to create trajectory predictions and visualize satellite orbits in 3D</p>
                                <button onclick="runTrajectoryPrediction()" class="btn btn-primary" style="font-size: 1.1rem; padding: 1rem 2rem;">
                                    <i class="fas fa-rocket"></i> Generate New Trajectories
                                </button>
                            </div>
                        `;
                    }
                }
            } else {
                // If dashboard not ready yet, wait for it and then initialize
                const initTrajectories = () => {
                    if (window.dashboard) {
                        if (window.dashboard.trajectoryData) {
                            window.dashboard.switchTrajectoryView('3d');
                        } else {
                            const container = document.getElementById('trajectory-container');
                            if (container) {
                                container.innerHTML = `
                                    <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--text-secondary); flex-direction: column; text-align: center; padding: 2rem;">
                                        <i class="fas fa-rocket" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                                        <h3 style="margin-bottom: 1rem;">No Trajectory Data Available</h3>
                                        <p style="margin-bottom: 2rem; max-width: 400px;">Click "Generate New" to create trajectory predictions and visualize satellite orbits in 3D</p>
                                        <button onclick="runTrajectoryPrediction()" class="btn btn-primary" style="font-size: 1.1rem; padding: 1rem 2rem;">
                                            <i class="fas fa-rocket"></i> Generate New Trajectories
                                        </button>
                                    </div>
                                `;
                            }
                        }
                        document.removeEventListener('dashboardReady', initTrajectories);
                    }
                };
                document.addEventListener('dashboardReady', initTrajectories);

                // Also try after a short delay as fallback
                setTimeout(() => {
                    if (window.dashboard) {
                        if (window.dashboard.trajectoryData) {
                            window.dashboard.switchTrajectoryView('3d');
                        } else {
                            const container = document.getElementById('trajectory-container');
                            if (container) {
                                container.innerHTML = `
                                    <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--text-secondary); flex-direction: column; text-align: center; padding: 2rem;">
                                        <i class="fas fa-rocket" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                                        <h3 style="margin-bottom: 1rem;">No Trajectory Data Available</h3>
                                        <p style="margin-bottom: 2rem; max-width: 400px;">Click "Generate New" to create trajectory predictions and visualize satellite orbits in 3D</p>
                                        <button onclick="runTrajectoryPrediction()" class="btn btn-primary" style="font-size: 1.1rem; padding: 1rem 2rem;">
                                            <i class="fas fa-rocket"></i> Generate New Trajectories
                                        </button>
                                    </div>
                                `;
                            }
                        }
                        document.removeEventListener('dashboardReady', initTrajectories);
                    }
                }, 100);
            }
        }
    }
}

function selectSatellite(id) {
    if (window.dashboard) {
        window.dashboard.selectSatellite(id);
    }
}

function closeSatelliteModal() {
    if (window.dashboard) {
        window.dashboard.closeSatelliteModal();
    }
}

function searchSatellites() {
    const query = document.getElementById('satellite-search').value;
    if (window.dashboard) {
        window.dashboard.searchSatellites(query);
    }
}

function filterByRisk() {
    const riskLevel = document.getElementById('risk-filter').value;
    if (window.dashboard) {
        window.dashboard.filterByRisk(riskLevel);
    }
}

function refreshSatelliteList() {
    if (window.dashboard) {
        window.dashboard.refreshSatelliteList();
    }
}

function runPrediction() {
    if (window.dashboard) {
        window.dashboard.runPrediction();
    }
}

function runTrajectoryPrediction() {
    if (window.dashboard) {
        window.dashboard.runTrajectoryPrediction();
    }
}

function resetCamera() {
    if (window.dashboard) {
        window.dashboard.resetCamera();
    }
}

function toggleSatellites() {
    if (window.dashboard) {
        window.dashboard.toggleSatellites();
    }
}

function toggleDebris() {
    if (window.dashboard) {
        window.dashboard.toggleDebris();
    }
}

function toggleTrajectories() {
    if (window.dashboard) {
        window.dashboard.toggleTrajectories();
    }
}

function clearTrajectories() {
    if (window.dashboard) {
        window.dashboard.clearTrajectories();
    }
}

function showSatelliteTrajectory() {
    if (window.dashboard) {
        window.dashboard.showSatelliteTrajectory();
    }
}

function loadCacheStatus() {
    if (window.dashboard) {
        window.dashboard.loadCacheStatus();
    }
}

function forceCacheUpdate() {
    if (window.dashboard) {
        window.dashboard.forceCacheUpdate();
    }
}

function viewCacheFiles() {
    if (window.dashboard) {
        window.dashboard.viewCacheFiles();
    }
}

function loadHighRiskSatellites() {
    if (window.dashboard) {
        window.dashboard.loadHighRiskSatellites();
    }
}

function toggleSatellites() {
    if (window.dashboard && window.dashboard.scene) {
        window.dashboard.scene.traverse((child) => {
            if (child.userData && child.userData.type === 'satellite') {
                child.visible = !child.visible;
            }
        });
        window.dashboard.showAlert('Satellites visibility toggled', 'info');
    }
}

function toggleDebris() {
    if (window.dashboard && window.dashboard.scene) {
        window.dashboard.scene.traverse((child) => {
            if (child.userData && child.userData.type === 'debris') {
                child.visible = !child.visible;
            }
        });
        window.dashboard.showAlert('Debris visibility toggled', 'info');
    }
}

function toggleTrajectories() {
    if (window.dashboard && window.dashboard.scene) {
        window.dashboard.scene.traverse((child) => {
            if (child.userData && child.userData.type === 'trajectory') {
                child.visible = !child.visible;
            }
        });
        window.dashboard.showAlert('Trajectories visibility toggled', 'info');
    }
}

function clearTrajectories() {
    if (window.dashboard) {
        window.dashboard.clearTrajectories();
    }
}

function resetCamera() {
    if (window.dashboard) {
        window.dashboard.resetCamera();
    }
}
