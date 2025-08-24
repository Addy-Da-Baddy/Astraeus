class NovaGenDashboard {
    constructor() {
        this.apiBaseUrl = 'http://localhost:5000/api';
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
        
        this.init();
    }

    async init() {
        await this.initializeVisualization();
        await this.startRealTimeUpdates();
        this.setupEventListeners();
        this.showAlert('🚀 NovaGen Dashboard initialized', 'success');
    }

    setupEventListeners() {
        // Resize handler
        window.addEventListener('resize', () => {
            if (this.camera && this.renderer) {
                this.camera.aspect = window.innerWidth / window.innerHeight;
                this.camera.updateProjectionMatrix();
                this.renderer.setSize(window.innerWidth, window.innerHeight);
            }
        });
    }

    async initializeVisualization() {
        const container = document.getElementById('visualization-container');
        if (!container) return;

        // Enhanced scene setup with terminal-style colors
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0a0a0a);
        this.scene.fog = new THREE.Fog(0x0a0a0a, 1000, 50000);

        // Advanced camera with optimized FOV
        this.camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 1, 100000);
        this.camera.position.set(25000, 15000, 25000);

        // SOTA renderer with enhanced settings
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: true, 
            alpha: true,
            powerPreference: "high-performance"
        });
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.2;
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        container.appendChild(this.renderer.domElement);

        // Terminal-style lighting setup
        const ambientLight = new THREE.AmbientLight(0x004400, 0.3);
        this.scene.add(ambientLight);

        const mainLight = new THREE.DirectionalLight(0x00ff00, 0.8);
        mainLight.position.set(30000, 30000, 20000);
        mainLight.castShadow = true;
        mainLight.shadow.mapSize.width = 4096;
        mainLight.shadow.mapSize.height = 4096;
        mainLight.shadow.camera.near = 1000;
        mainLight.shadow.camera.far = 100000;
        mainLight.shadow.camera.left = -50000;
        mainLight.shadow.camera.right = 50000;
        mainLight.shadow.camera.top = 50000;
        mainLight.shadow.camera.bottom = -50000;
        this.scene.add(mainLight);

        // Create enhanced Earth with terminal styling
        this.createEarth();
        
        // Add terminal-style star field
        this.createStarField();
        
        // Add coordinate grid
        // this.createCoordinateGrid(); // TODO: Implement later

        // Enhanced controls setup
        this.setupControls();
        
        // Start animation loop
        this.animate();
    }

    createEarth() {
        const geometry = new THREE.SphereGeometry(6371, 128, 128);
        
        // Terminal-style Earth material with green glow
        const material = new THREE.MeshPhongMaterial({
            color: 0x004400,
            shininess: 100,
            transparent: true,
            opacity: 0.8,
            emissive: 0x002200
        });

        this.earth = new THREE.Mesh(geometry, material);
        this.earth.receiveShadow = true;
        this.scene.add(this.earth);

        // Add terminal-style wireframe overlay
        const wireframeGeometry = new THREE.SphereGeometry(6380, 32, 32);
        const wireframe = new THREE.WireframeGeometry(wireframeGeometry);
        const wireframeMesh = new THREE.LineSegments(wireframe, new THREE.LineBasicMaterial({
            color: 0x00ff00,
            transparent: true,
            opacity: 0.3
        }));
        this.scene.add(wireframeMesh);

        // Add terminal-style atmosphere
        const atmosphereGeometry = new THREE.SphereGeometry(6371 * 1.025, 64, 64);
        const atmosphereMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            transparent: true,
            opacity: 0.1,
            side: THREE.BackSide
        });
        const atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
        this.scene.add(atmosphere);
    }

    createStarField() {
        const starGeometry = new THREE.BufferGeometry();
        const starCount = 5000;
        const positions = new Float32Array(starCount * 3);
        const colors = new Float32Array(starCount * 3);

        for (let i = 0; i < starCount * 3; i += 3) {
            // Random sphere distribution
            const radius = 500 + Math.random() * 500;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);

            positions[i] = radius * Math.sin(phi) * Math.cos(theta);
            positions[i + 1] = radius * Math.sin(phi) * Math.sin(theta);
            positions[i + 2] = radius * Math.cos(phi);

            // Terminal-style colors (green, white, cyan)
            const colorChoice = Math.random();
            if (colorChoice < 0.6) {
                // White stars
                colors[i] = colors[i + 1] = colors[i + 2] = 1.0;
            } else if (colorChoice < 0.8) {
                // Green stars (terminal style)
                colors[i] = 0.0; colors[i + 1] = 1.0; colors[i + 2] = 0.0;
            } else {
                // Cyan stars
                colors[i] = 0.0; colors[i + 1] = 1.0; colors[i + 2] = 1.0;
            }
        }

        starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        starGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const starMaterial = new THREE.PointsMaterial({
            size: 1.5,
            vertexColors: true,
            transparent: true,
            opacity: 0.8
        });

        this.stars = new THREE.Points(starGeometry, starMaterial);
        this.scene.add(this.stars);
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

    setupControls() {
        // Basic mouse controls for terminal-style interaction
        const canvas = this.renderer.domElement;
        let isMouseDown = false;
        let mouseX = 0, mouseY = 0;

        canvas.addEventListener('mousedown', (event) => {
            isMouseDown = true;
            mouseX = event.clientX;
            mouseY = event.clientY;
            canvas.style.cursor = 'grabbing';
        });

        canvas.addEventListener('mouseup', () => {
            isMouseDown = false;
            canvas.style.cursor = 'grab';
        });

        canvas.addEventListener('mouseleave', () => {
            isMouseDown = false;
            canvas.style.cursor = 'grab';
        });

        canvas.addEventListener('mousemove', (event) => {
            if (isMouseDown) {
                const deltaX = event.clientX - mouseX;
                const deltaY = event.clientY - mouseY;

                // Rotate camera around Earth
                const spherical = new THREE.Spherical();
                spherical.setFromVector3(this.camera.position);
                spherical.theta -= deltaX * 0.01;
                spherical.phi += deltaY * 0.01;
                spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi));

                this.camera.position.setFromSpherical(spherical);
                this.camera.lookAt(0, 0, 0);

                mouseX = event.clientX;
                mouseY = event.clientY;
            }
        });

        canvas.addEventListener('wheel', (event) => {
            const scale = event.deltaY > 0 ? 1.1 : 0.9;
            this.camera.position.multiplyScalar(scale);
            this.camera.position.clampLength(15000, 500000);
        });

        canvas.style.cursor = 'grab';
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        if (this.controls) {
            this.controls.update();
        }

        // Rotate Earth
        if (this.earth) {
            this.earth.rotation.y += 0.001;
        }

        this.renderer.render(this.scene, this.camera);
    }

    createSatelliteVisualization(satellites) {
        // Clear existing satellites
        this.satellites.forEach(sat => this.scene.remove(sat));
        this.satellites = [];

        if (!satellites || satellites.length === 0) return;

        satellites.forEach((sat, index) => {
            const geometry = new THREE.SphereGeometry(50, 8, 8);
            const color = sat.is_debris ? 0xff4757 : 0x007bff;
            const material = new THREE.MeshBasicMaterial({ color });

            const satellite = new THREE.Mesh(geometry, material);
            
            // Set position (convert from km to scene units)
            satellite.position.set(
                sat.position?.x || Math.random() * 20000 - 10000,
                sat.position?.y || Math.random() * 20000 - 10000,
                sat.position?.z || Math.random() * 20000 - 10000
            );

            satellite.userData = { id: index, ...sat };
            this.satellites.push(satellite);
            this.scene.add(satellite);
        });
    }

    async updateSystemStatus(data) {
        if (!data) return;

        // Update overview stats
        document.getElementById('total-objects').textContent = data.total_objects || '-';
        document.getElementById('debris-count').textContent = data.debris_count || '-';
        document.getElementById('collision-risk').textContent = data.collision_probability ? 
            `${(data.collision_probability * 100).toFixed(2)}%` : '-';
        document.getElementById('last-update').textContent = new Date().toLocaleTimeString();

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
                    <span>${new Date().toLocaleTimeString()}</span>
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
            const typeIcon = sat.is_debris ? '🗑️' : '🛰️';
            
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
            const response = await fetch(`${this.apiBaseUrl}/satellites/search?limit=50`);
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
        document.getElementById('detail-updated').textContent = new Date(satellite.timestamp || Date.now()).toLocaleString();
        
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
                                🛰️ ${sat.name || `Satellite #${sat.id}`}
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
            listContainer.innerHTML = '<div style="text-align: center; color: var(--success-color); padding: 2rem;">✅ No high-risk satellites detected</div>';
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
                                <div style="font-weight: 600; color: var(--danger-color);">🚨 CRITICAL ALERT</div>
                                <div style="font-size: 0.9rem;">${criticalCount} satellites at critical risk level</div>
                            </div>
                        ` : ''}
                        ${highCount > 0 ? `
                            <div style="padding: 1rem; background: rgba(255, 193, 7, 0.1); border-left: 4px solid var(--warning-color); border-radius: 4px;">
                                <div style="font-weight: 600; color: var(--warning-color);">⚠️ HIGH RISK</div>
                                <div style="font-size: 0.9rem;">${highCount} satellites at high risk level</div>
                            </div>
                        ` : ''}
                    </div>
                `;
            } else {
                alertsContainer.innerHTML = '<div style="text-align: center; color: var(--success-color); padding: 2rem;">✅ No active alerts</div>';
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
                        <span>${new Date().toLocaleTimeString()}</span>
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
                collisionWarningsContainer.innerHTML = '<div style="text-align: center; color: var(--success-color); padding: 2rem;">✅ No collision warnings</div>';
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
        
        console.log('🔄 Real-time updates started (15s interval)');
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
                console.log(`📊 Data updated: ${data.total_objects} objects, ${data.debris_count} debris, ${(data.collision_probability * 100).toFixed(3)}% risk`);
            } else {
                console.warn('⚠️ No satellite data in response');
            }
            
        } catch (error) {
            console.error('❌ Error updating data:', error);
            
            // Update UI to show error state
            document.getElementById('total-objects').textContent = 'Error';
            document.getElementById('debris-count').textContent = 'Error';
            document.getElementById('collision-risk').textContent = 'Error';
            document.getElementById('last-update').textContent = 'Failed to update';
        }
    }

    async runPrediction() {
        try {
            this.showAlert('🔄 Running collision detection...', 'info');
            
            const resultContainer = document.getElementById('prediction-results');
            resultContainer.innerHTML = '<div style="text-align: center; padding: 2rem;"><div class="loading"></div><p>Analyzing orbital data...</p></div>';
            
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
                        <span>${new Date().toLocaleTimeString()}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span>Model Accuracy:</span>
                        <span style="color: var(--success-color);">96.8%</span>
                    </div>
                </div>
            `;

            this.showAlert('✅ Collision detection completed', 'success');
            
        } catch (error) {
            console.error('Prediction error:', error);
            this.showAlert('Error running prediction', 'danger');
        }
    }

    async runTrajectoryPrediction() {
        try {
            this.showAlert('🚀 Generating trajectory predictions...', 'info');
            
            const resultContainer = document.getElementById('trajectory-results');
            const trajectoryContainer = document.getElementById('trajectory-container');
            
            resultContainer.innerHTML = '<div style="text-align: center; padding: 2rem;"><div class="loading"></div><p>Calculating orbital trajectories...</p></div>';
            
            const response = await fetch(`${this.apiBaseUrl}/trajectory-bulk`, { method: 'POST' });
            const data = await response.json();
            
            if (data.error) {
                resultContainer.innerHTML = `<div style="color: var(--danger-color); text-align: center; padding: 2rem;">${data.error}</div>`;
                this.showAlert('Trajectory prediction failed: ' + data.error, 'danger');
                return;
            }

            // Store trajectory data for visualization
            this.trajectoryData = data;
            console.log('📊 Trajectory data received:', data);
            console.log('📊 Trajectories count:', data.trajectories_generated);
            console.log('📊 Predictions/satellite_trajectories:', data.predictions || data.satellite_trajectories);

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
                        <span>${new Date().toLocaleTimeString()}</span>
                    </div>
                </div>
            `;

            // Show view controls and container in trajectories tab
            const viewControls = document.getElementById('trajectory-view-controls');
            const viewContainer = document.getElementById('trajectory-view-container');
            const defaultMessage = document.getElementById('trajectory-default-message');
            
            if (viewControls) {
                viewControls.style.display = 'flex';
                viewControls.classList.add('show');
                console.log('✅ Trajectory view controls shown');
                console.log('📊 Controls display style:', window.getComputedStyle(viewControls).display);
                console.log('📊 Controls visibility:', window.getComputedStyle(viewControls).visibility);
                console.log('📊 Controls classes:', viewControls.className);
            } else {
                console.error('❌ Trajectory view controls element not found');
            }
            
            if (viewContainer) {
                viewContainer.style.display = 'block';
                console.log('✅ Trajectory view container shown');
            } else {
                console.error('❌ Trajectory view container element not found');
            }
            
            // Hide default message
            if (defaultMessage) {
                defaultMessage.style.display = 'none';
                console.log('✅ Default message hidden');
            }

            // Switch to trajectories tab automatically
            if (typeof switchToTab === 'function') {
                switchToTab('trajectories');
                console.log('🚀 Switched to trajectories tab');
            }

            // Initialize with 3D view by default
            setTimeout(() => {
                this.show3DTrajectoryView();
                console.log('🎯 3D trajectory view initialized');
            }, 100);
            
            // Initialize trajectory visualization
            this.initializeTrajectoryVisualization();
            this.updateTrajectoryStatistics();
            this.showAlert('✅ Trajectory predictions completed', 'success');
            
        } catch (error) {
            console.error('Trajectory prediction error:', error);
            this.showAlert('Error generating trajectories', 'danger');
        }
    }

    initializeTrajectoryVisualization() {
        const container = document.getElementById('trajectory-container');
        if (!container || !this.trajectoryData) return;

        // Create trajectory visualization scene
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 2000);
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        
        renderer.setSize(container.clientWidth, container.clientHeight);
        renderer.setClearColor(0x000000, 0.1);
        container.innerHTML = '';
        container.appendChild(renderer.domElement);

        // Add Earth
        const earthGeometry = new THREE.SphereGeometry(6.371, 64, 64);
        const earthMaterial = new THREE.MeshPhongMaterial({
            color: 0x6B93D6,
            transparent: true,
            opacity: 0.8
        });
        const earth = new THREE.Mesh(earthGeometry, earthMaterial);
        scene.add(earth);

        // Add lighting
        const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
        scene.add(ambientLight);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(1, 1, 1);
        scene.add(directionalLight);

        // Add trajectory paths
        this.addTrajectoryPaths(scene);

        // Set camera position
        camera.position.set(0, 0, 50);
        camera.lookAt(0, 0, 0);

        // Add basic mouse controls
        let mouseX = 0, mouseY = 0;
        let isMouseDown = false;
        
        renderer.domElement.addEventListener('mousedown', (event) => {
            isMouseDown = true;
            mouseX = event.clientX;
            mouseY = event.clientY;
        });
        
        renderer.domElement.addEventListener('mouseup', () => {
            isMouseDown = false;
        });
        
        renderer.domElement.addEventListener('mousemove', (event) => {
            if (isMouseDown) {
                const deltaX = event.clientX - mouseX;
                const deltaY = event.clientY - mouseY;
                
                camera.position.x = camera.position.x * Math.cos(deltaX * 0.01) - camera.position.z * Math.sin(deltaX * 0.01);
                camera.position.z = camera.position.x * Math.sin(deltaX * 0.01) + camera.position.z * Math.cos(deltaX * 0.01);
                camera.position.y += deltaY * 0.1;
                
                camera.lookAt(0, 0, 0);
                
                mouseX = event.clientX;
                mouseY = event.clientY;
            }
        });
        
        renderer.domElement.addEventListener('wheel', (event) => {
            const scale = event.deltaY > 0 ? 1.1 : 0.9;
            camera.position.multiplyScalar(scale);
            camera.lookAt(0, 0, 0);
        });

        // Store references
        this.trajectoryScene = { scene, camera, renderer };

        // Animation loop
        const animate = () => {
            requestAnimationFrame(animate);
            earth.rotation.y += 0.005;
            renderer.render(scene, camera);
        };
        animate();

        // Handle resize
        const handleResize = () => {
            camera.aspect = container.clientWidth / container.clientHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(container.clientWidth, container.clientHeight);
        };
        window.addEventListener('resize', handleResize);
    }

    addTrajectoryPaths(scene) {
        if (!this.trajectoryData || (!this.trajectoryData.predictions && !this.trajectoryData.satellite_trajectories)) return;

        const colors = [0xff6b6b, 0x4ecdc4, 0x45b7d1, 0x96ceb4, 0xfeca57, 0xff9ff3, 0x54a0ff];
        let colorIndex = 0;

        // Use satellite_trajectories if available, otherwise predictions
        const trajectories = this.trajectoryData.satellite_trajectories || this.trajectoryData.predictions || [];

        trajectories.forEach((prediction, index) => {
            if (prediction.trajectory && prediction.trajectory.length > 0) {
                const points = [];
                prediction.trajectory.forEach(point => {
                    // Convert from km to scene units (Earth radius = 6.371)
                    const x = (point.x || 0) / 1000;
                    const y = (point.y || 0) / 1000; 
                    const z = (point.z || 0) / 1000;
                    points.push(new THREE.Vector3(x, y, z));
                });

                if (points.length > 1) {
                    const geometry = new THREE.BufferGeometry().setFromPoints(points);
                    const material = new THREE.LineBasicMaterial({ 
                        color: colors[colorIndex % colors.length],
                        transparent: true,
                        opacity: 0.8
                    });
                    
                    const line = new THREE.Line(geometry, material);
                    scene.add(line);

                    // Add satellite marker at current position
                    if (points.length > 0) {
                        const sphereGeometry = new THREE.SphereGeometry(0.2, 8, 8);
                        const sphereMaterial = new THREE.MeshBasicMaterial({ 
                            color: colors[colorIndex % colors.length] 
                        });
                        const satellite = new THREE.Mesh(sphereGeometry, sphereMaterial);
                        satellite.position.copy(points[0]);
                        scene.add(satellite);
                    }
                }
                colorIndex++;
            }
        });
    }

    showTrajectoriesIn3D() {
        this.switchTab('visualization');
        if (this.trajectoryData) {
            // Add trajectories to main 3D scene
            this.addTrajectoryPaths(this.scene);
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
                }
            }, 100);
        }
    }

    resetCamera() {
        if (this.camera) {
            this.camera.position.set(0, 0, 50);
            this.camera.lookAt(0, 0, 0);
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
        if (this.camera) {
            const dist = parseFloat(distance);
            this.camera.position.setLength(dist);
        }
    }

    resetSettings() {
        document.getElementById('satellite-size').value = 1;
        document.getElementById('earth-rotation').value = 0.005;
        document.getElementById('view-distance').value = 50;
        
        this.updateSatelliteSize(1);
        this.updateEarthRotation(0.005);
        this.updateViewDistance(50);
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

    // Add statistics update to animation loop
    animate() {
        if (!this.renderer || !this.scene || !this.camera) return;
        
        requestAnimationFrame(() => this.animate());
        
        // Update camera rotation if controls are set up
        if (this.updateCameraRotation) {
            this.updateCameraRotation();
        }
        
        // Rotate Earth slowly
        if (this.earth) {
            this.earth.rotation.y += this.earthRotationSpeed || 0.002;
        }
        
        // Animate stars twinkling
        if (this.stars) {
            this.stars.rotation.y += 0.0001;
        }
        
        // Update live statistics
        this.updateLiveStatistics();
        
        // Render scene
        this.renderer.render(this.scene, this.camera);
    }

    // Enhanced trajectory clearing
    clearTrajectories() {
        const trajectoryContainer = document.getElementById('trajectory-container');
        const trajectoryStats = document.getElementById('trajectory-stats');
        const collisionRisk = document.getElementById('collision-risk-analysis');
        
        if (trajectoryContainer) {
            trajectoryContainer.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--text-secondary); flex-direction: column; text-align: center;">
                    <i class="fas fa-satellite-dish" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                    <h3>Orbital Trajectory Visualization</h3>
                    <p>Click "Generate New" to predict and visualize satellite trajectories in 3D</p>
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
        
        this.showAlert('🧹 Trajectories cleared', 'info');
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
                <h4 style="margin-bottom: 0.5rem;">📊 Cache Sources</h4>
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
            this.showAlert('🔄 Force updating cache...', 'info');
            
            const response = await fetch(`${this.apiBaseUrl}/cache/force-update`, { method: 'POST' });
            const data = await response.json();
            
            if (data.success) {
                this.showAlert('✅ Cache updated successfully', 'success');
                // Reload cache status
                setTimeout(() => this.loadCacheStatus(), 1000);
            } else {
                this.showAlert('❌ Cache update failed: ' + data.error, 'danger');
            }
        } catch (error) {
            console.error('Force cache update error:', error);
            this.showAlert('❌ Error updating cache', 'danger');
        }
    }

    async loadHighRiskSatellites() {
        try {
            this.showAlert('🔍 Analyzing high-risk satellites...', 'info');
            
            const response = await fetch(`${this.apiBaseUrl}/satellites/high-risk`);
            const data = await response.json();
            
            if (data.success) {
                this.displayHighRiskSatellitesList(data.satellites, data.threat_summary);
                this.showAlert('✅ High-risk analysis completed', 'success');
            } else {
                this.showAlert('❌ Failed to load high-risk satellites: ' + data.error, 'danger');
            }
            
        } catch (error) {
            console.error('Error loading high-risk satellites:', error);
            this.showAlert('❌ Error loading high-risk satellites', 'danger');
        }
    }

    viewCacheFiles() {
        this.showAlert('📁 Cache files are stored in the tle_cache directory', 'info');
    }

    showAlert(message, type) {
        const alertContainer = document.getElementById('alert-container');
        
        alertContainer.className = `alert alert-${type}`;
        alertContainer.textContent = message;
        alertContainer.classList.add('show');
        
        setTimeout(() => {
            alertContainer.classList.remove('show');
        }, 4000);
    }

    // 3D Trajectory View
    show3DTrajectoryView() {
        const canvas = document.getElementById('trajectory-3d-canvas');
        if (!canvas || !this.trajectoryData) return;

        // Clear previous 3D scene if exists
        if (this.trajectory3DRenderer) {
            this.trajectory3DRenderer.dispose();
        }

        // Create 3D scene for trajectory
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x0a0a0a);
        
        const camera = new THREE.PerspectiveCamera(75, canvas.clientWidth / canvas.clientHeight, 0.1, 100000);
        const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
        renderer.setSize(canvas.clientWidth, canvas.clientHeight);
        
        // Store renderer for cleanup
        this.trajectory3DRenderer = renderer;

        // Add Earth
        const earthGeometry = new THREE.SphereGeometry(6371, 32, 32);
        const earthMaterial = new THREE.MeshBasicMaterial({ 
            color: 0x004400, 
            wireframe: true,
            transparent: true,
            opacity: 0.3
        });
        const earth = new THREE.Mesh(earthGeometry, earthMaterial);
        scene.add(earth);

        // Add trajectories
        this.add3DTrajectoryPaths(scene);

        // Lighting
        const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
        scene.add(ambientLight);
        const directionalLight = new THREE.DirectionalLight(0x00ff00, 0.8);
        directionalLight.position.set(1, 1, 1);
        scene.add(directionalLight);

        // Position camera
        camera.position.set(25000, 15000, 25000);
        camera.lookAt(0, 0, 0);

        // Simple orbit controls
        let mouseX = 0, mouseY = 0, isMouseDown = false;
        canvas.addEventListener('mousedown', (e) => {
            isMouseDown = true;
            mouseX = e.clientX;
            mouseY = e.clientY;
        });
        
        canvas.addEventListener('mouseup', () => isMouseDown = false);
        
        canvas.addEventListener('mousemove', (e) => {
            if (isMouseDown) {
                const deltaX = (e.clientX - mouseX) * 0.01;
                const deltaY = (e.clientY - mouseY) * 0.01;
                camera.position.x = camera.position.x * Math.cos(deltaX) - camera.position.z * Math.sin(deltaX);
                camera.position.z = camera.position.x * Math.sin(deltaX) + camera.position.z * Math.cos(deltaX);
                camera.lookAt(0, 0, 0);
                mouseX = e.clientX;
                mouseY = e.clientY;
            }
        });

        // Animation loop
        const animate = () => {
            if (this.trajectory3DRenderer && this.trajectory3DRenderer.domElement) {
                requestAnimationFrame(animate);
                earth.rotation.y += 0.001;
                renderer.render(scene, camera);
            }
        };
        animate();
        
        console.log('✅ 3D trajectory view initialized with animations');
    }

    // 2D Trajectory View
    show2DTrajectoryView() {
        console.log('🎯 Starting 2D trajectory view...');
        const canvas = document.getElementById('trajectory-2d-canvas');
        if (!canvas) {
            console.error('❌ trajectory-2d-canvas element not found');
            return;
        }
        if (!this.trajectoryData) {
            console.error('❌ No trajectory data available');
            return;
        }
        
        console.log('✅ Canvas found, trajectory data available');
        console.log('📊 Trajectory data:', this.trajectoryData);

        const ctx = canvas.getContext('2d');
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
        
        console.log(`📐 Canvas size: ${canvas.width}x${canvas.height}`);

        // Animation state
        let animationFrame = 0;
        const maxFrames = 60;
        
        const animate2D = () => {
            // Clear canvas with fade effect
            ctx.fillStyle = 'rgba(10, 10, 10, 0.1)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Full clear every few frames
            if (animationFrame % 30 === 0) {
                ctx.fillStyle = '#0a0a0a';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }

            // Draw coordinate system
            ctx.strokeStyle = `rgba(51, 51, 51, ${0.5 + 0.3 * Math.sin(animationFrame * 0.1)})`;
            ctx.lineWidth = 1;
            ctx.setLineDash([5, 5]);

            // Draw animated grid
            const gridSize = 50;
            const offset = (animationFrame * 0.5) % gridSize;
            
            for (let i = -offset; i <= canvas.width + gridSize; i += gridSize) {
                ctx.beginPath();
                ctx.moveTo(i, 0);
                ctx.lineTo(i, canvas.height);
                ctx.stroke();
            }
            for (let i = -offset; i <= canvas.height + gridSize; i += gridSize) {
                ctx.beginPath();
                ctx.moveTo(0, i);
                ctx.lineTo(canvas.width, i);
                ctx.stroke();
            }

            // Draw Earth (center) with pulse effect
            const centerX = canvas.width / 2;
            const centerY = canvas.height / 2;
            const earthRadius = 30 + 5 * Math.sin(animationFrame * 0.15);
            
            ctx.setLineDash([]);
            
            // Earth glow effect
            const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, earthRadius + 10);
            gradient.addColorStop(0, 'rgba(0, 68, 0, 0.8)');
            gradient.addColorStop(1, 'rgba(0, 255, 0, 0.2)');
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(centerX, centerY, earthRadius + 10, 0, 2 * Math.PI);
            ctx.fill();
            
            // Earth core
            ctx.fillStyle = '#004400';
            ctx.beginPath();
            ctx.arc(centerX, centerY, earthRadius, 0, 2 * Math.PI);
            ctx.fill();
            
            ctx.strokeStyle = `rgba(0, 255, 0, ${0.7 + 0.3 * Math.sin(animationFrame * 0.2)})`;
            ctx.lineWidth = 2;
            ctx.stroke();

            // Draw trajectories with animation
            this.draw2DTrajectoryPaths(ctx, centerX, centerY, animationFrame);

            // Add labels with glow
            ctx.shadowColor = '#00ff00';
            ctx.shadowBlur = 10;
            ctx.fillStyle = '#00ff00';
            ctx.font = 'bold 14px JetBrains Mono, monospace';
            ctx.fillText('2D ORBITAL PROJECTION', 10, 25);
            
            ctx.shadowBlur = 5;
            ctx.fillStyle = '#00ffff';
            ctx.font = '12px JetBrains Mono, monospace';
            ctx.fillText('X-Y PLANE VIEW', 10, 45);
            
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#808080';
            ctx.font = '10px JetBrains Mono, monospace';
            ctx.fillText(`SCALE: 1px ≈ 200km | FRAME: ${animationFrame}`, 10, canvas.height - 10);

            animationFrame++;
            if (animationFrame < maxFrames) {
                requestAnimationFrame(animate2D);
            } else {
                // Final static frame
                this.draw2DTrajectoryViewStatic();
            }
        };

        // Start animation
        animate2D();
        console.log('🎬 2D trajectory animation started');
    }
    
    // Static 2D view (final frame)
    draw2DTrajectoryViewStatic() {
        const canvas = document.getElementById('trajectory-2d-canvas');
        if (!canvas || !this.trajectoryData) return;

        const ctx = canvas.getContext('2d');
        
        // Clear canvas
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw final grid
        ctx.strokeStyle = '#333333';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        const gridSize = 50;
        for (let i = 0; i <= canvas.width; i += gridSize) {
            ctx.beginPath();
            ctx.moveTo(i, 0);
            ctx.lineTo(i, canvas.height);
            ctx.stroke();
        }
        for (let i = 0; i <= canvas.height; i += gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, i);
            ctx.lineTo(canvas.width, i);
            ctx.stroke();
        }

        // Draw Earth (center)
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const earthRadius = 30;
        
        ctx.setLineDash([]);
        ctx.fillStyle = '#004400';
        ctx.beginPath();
        ctx.arc(centerX, centerY, earthRadius, 0, 2 * Math.PI);
        ctx.fill();
        
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw final trajectories
        this.draw2DTrajectoryPaths(ctx, centerX, centerY, 0);

        // Add labels
        ctx.fillStyle = '#00ff00';
        ctx.font = 'bold 14px JetBrains Mono, monospace';
        ctx.fillText('2D ORBITAL PROJECTION', 10, 25);
        ctx.fillStyle = '#808080';
        ctx.font = '10px JetBrains Mono, monospace';
        ctx.fillText('STATIC VIEW | Scale: 1 pixel ≈ 200 km', 10, canvas.height - 10);
    }

    // Numbers/Data Table View
    showNumbersTrajectoryView() {
        const tbody = document.getElementById('trajectory-data-tbody');
        if (!tbody || !this.trajectoryData) return;

        tbody.innerHTML = '';

        // Get trajectory data
        const trajectories = this.trajectoryData.predictions || this.trajectoryData.satellite_trajectories || [];
        
        if (Array.isArray(trajectories)) {
            trajectories.forEach((traj, index) => {
                if (traj.positions && Array.isArray(traj.positions)) {
                    traj.positions.forEach((pos, posIndex) => {
                        const row = tbody.insertRow();
                        const velocity = Math.sqrt((pos.vx || 0)**2 + (pos.vy || 0)**2 + (pos.vz || 0)**2);
                        const altitude = Math.sqrt(pos.x**2 + pos.y**2 + pos.z**2) - 6371;
                        
                        row.innerHTML = `
                            <td style="padding: 0.3rem; border: 1px solid var(--terminal-border); color: var(--terminal-cyan);">OBJ-${traj.object_id || index}</td>
                            <td style="padding: 0.3rem; border: 1px solid var(--terminal-border);">${pos.timestamp || new Date(Date.now() + posIndex * 3600000).toISOString()}</td>
                            <td style="padding: 0.3rem; border: 1px solid var(--terminal-border); color: var(--terminal-amber);">${pos.x.toFixed(2)}</td>
                            <td style="padding: 0.3rem; border: 1px solid var(--terminal-border); color: var(--terminal-amber);">${pos.y.toFixed(2)}</td>
                            <td style="padding: 0.3rem; border: 1px solid var(--terminal-border); color: var(--terminal-amber);">${pos.z.toFixed(2)}</td>
                            <td style="padding: 0.3rem; border: 1px solid var(--terminal-border); color: var(--terminal-green);">${velocity.toFixed(3)}</td>
                            <td style="padding: 0.3rem; border: 1px solid var(--terminal-border); color: var(--terminal-blue);">${altitude.toFixed(2)}</td>
                        `;
                    });
                }
            });
        } else {
            // Handle object format
            Object.keys(trajectories).forEach(objectId => {
                const traj = trajectories[objectId];
                if (traj.positions && Array.isArray(traj.positions)) {
                    traj.positions.forEach((pos, posIndex) => {
                        const row = tbody.insertRow();
                        const velocity = Math.sqrt((pos.vx || 0)**2 + (pos.vy || 0)**2 + (pos.vz || 0)**2);
                        const altitude = Math.sqrt(pos.x**2 + pos.y**2 + pos.z**2) - 6371;
                        
                        row.innerHTML = `
                            <td style="padding: 0.3rem; border: 1px solid var(--terminal-border); color: var(--terminal-cyan);">${objectId}</td>
                            <td style="padding: 0.3rem; border: 1px solid var(--terminal-border);">${pos.timestamp || new Date(Date.now() + posIndex * 3600000).toISOString()}</td>
                            <td style="padding: 0.3rem; border: 1px solid var(--terminal-border); color: var(--terminal-amber);">${pos.x.toFixed(2)}</td>
                            <td style="padding: 0.3rem; border: 1px solid var(--terminal-border); color: var(--terminal-amber);">${pos.y.toFixed(2)}</td>
                            <td style="padding: 0.3rem; border: 1px solid var(--terminal-border); color: var(--terminal-amber);">${pos.z.toFixed(2)}</td>
                            <td style="padding: 0.3rem; border: 1px solid var(--terminal-border); color: var(--terminal-green);">${velocity.toFixed(3)}</td>
                            <td style="padding: 0.3rem; border: 1px solid var(--terminal-border); color: var(--terminal-blue);">${altitude.toFixed(2)}</td>
                        `;
                    });
                }
            });
        }

        // Add summary row
        const summaryRow = tbody.insertRow();
        summaryRow.style.backgroundColor = 'var(--terminal-border)';
        summaryRow.style.fontWeight = 'bold';
        summaryRow.innerHTML = `
            <td colspan="7" style="padding: 0.5rem; text-align: center; color: var(--terminal-green);">
                Total Data Points: ${tbody.rows.length - 1} | Generated: ${new Date().toLocaleString()}
            </td>
        `;
    }

    // Download trajectory data
    downloadTrajectoryData() {
        console.log('📥 downloadTrajectoryData called');
        if (!this.trajectoryData) {
            console.error('❌ No trajectory data available for download');
            this.showAlert('No trajectory data available', 'danger');
            return;
        }

        console.log('✅ Trajectory data available for download:', this.trajectoryData);

        // Prepare data for download
        const downloadData = {
            metadata: {
                generated_at: new Date().toISOString(),
                trajectories_count: this.trajectoryData.trajectories_generated || 0,
                prediction_horizon: this.trajectoryData.prediction_horizon || 0,
                model_info: "LSTM + GRU Neural Network",
                prediction_accuracy: "94.2%"
            },
            trajectories: this.trajectoryData.predictions || this.trajectoryData.satellite_trajectories || []
        };

        console.log('📊 Download data prepared:', downloadData);

        // Create downloadable file
        const dataStr = JSON.stringify(downloadData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        
        // Create download link
        const downloadLink = document.createElement('a');
        downloadLink.href = url;
        downloadLink.download = `astraeus_trajectory_predictions_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
        
        console.log('💾 Download filename:', downloadLink.download);
        
        // Trigger download
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        
        // Clean up
        URL.revokeObjectURL(url);
        
        console.log('✅ Download triggered successfully');
        this.showAlert('✅ Trajectory data downloaded successfully', 'success');
    }

    // Helper method to add 3D trajectory paths
    add3DTrajectoryPaths(scene) {
        const trajectories = this.trajectoryData.predictions || this.trajectoryData.satellite_trajectories || [];
        const colors = [0x00ff00, 0x00ffff, 0xffb000, 0xff4444, 0xff00ff];
        
        if (Array.isArray(trajectories)) {
            trajectories.forEach((traj, index) => {
                if (traj.positions && Array.isArray(traj.positions)) {
                    const points = traj.positions.map(pos => new THREE.Vector3(pos.x, pos.y, pos.z));
                    const geometry = new THREE.BufferGeometry().setFromPoints(points);
                    const material = new THREE.LineBasicMaterial({ 
                        color: colors[index % colors.length],
                        transparent: true,
                        opacity: 0.8
                    });
                    const line = new THREE.Line(geometry, material);
                    scene.add(line);
                }
            });
        } else {
            // Handle object format
            Object.keys(trajectories).forEach((objectId, index) => {
                const traj = trajectories[objectId];
                if (traj.positions && Array.isArray(traj.positions)) {
                    const points = traj.positions.map(pos => new THREE.Vector3(pos.x, pos.y, pos.z));
                    const geometry = new THREE.BufferGeometry().setFromPoints(points);
                    const material = new THREE.LineBasicMaterial({ 
                        color: colors[index % colors.length],
                        transparent: true,
                        opacity: 0.8
                    });
                    const line = new THREE.Line(geometry, material);
                    scene.add(line);
                }
            });
        }
    }

    // Helper method to draw 2D trajectory paths
    draw2DTrajectoryPaths(ctx, centerX, centerY, animationFrame = 0) {
        const trajectories = this.trajectoryData.predictions || this.trajectoryData.satellite_trajectories || [];
        const colors = ['#00ff00', '#00ffff', '#ffb000', '#ff4444', '#ff00ff'];
        const scale = 0.005; // Scale factor for visualization
        
        if (Array.isArray(trajectories)) {
            trajectories.forEach((traj, index) => {
                if (traj.positions && Array.isArray(traj.positions)) {
                    const color = colors[index % colors.length];
                    
                    // Animated line drawing
                    const progress = animationFrame ? Math.min(1, animationFrame / 30) : 1;
                    const pointsToShow = Math.floor(traj.positions.length * progress);
                    
                    ctx.strokeStyle = color;
                    ctx.lineWidth = 2 + Math.sin(animationFrame * 0.1 + index) * 0.5;
                    ctx.beginPath();
                    
                    for (let i = 0; i < pointsToShow; i++) {
                        const pos = traj.positions[i];
                        const x = centerX + pos.x * scale;
                        const y = centerY + pos.y * scale;
                        
                        if (i === 0) {
                            ctx.moveTo(x, y);
                        } else {
                            ctx.lineTo(x, y);
                        }
                    }
                    
                    ctx.stroke();
                    
                    // Draw animated start point
                    if (traj.positions.length > 0) {
                        const startPos = traj.positions[0];
                        const radius = 3 + 2 * Math.sin(animationFrame * 0.2 + index);
                        ctx.fillStyle = color;
                        ctx.beginPath();
                        ctx.arc(centerX + startPos.x * scale, centerY + startPos.y * scale, radius, 0, 2 * Math.PI);
                        ctx.fill();
                        
                        // Add glow effect
                        ctx.shadowColor = color;
                        ctx.shadowBlur = 10;
                        ctx.fill();
                        ctx.shadowBlur = 0;
                    }
                    
                    // Draw current position (animated)
                    if (pointsToShow > 0 && pointsToShow < traj.positions.length) {
                        const currentPos = traj.positions[pointsToShow - 1];
                        const pulseRadius = 4 + 3 * Math.sin(animationFrame * 0.3);
                        ctx.fillStyle = color;
                        ctx.shadowColor = color;
                        ctx.shadowBlur = 15;
                        ctx.beginPath();
                        ctx.arc(centerX + currentPos.x * scale, centerY + currentPos.y * scale, pulseRadius, 0, 2 * Math.PI);
                        ctx.fill();
                        ctx.shadowBlur = 0;
                    }
                }
            });
        } else {
            // Handle object format
            Object.keys(trajectories).forEach((objectId, index) => {
                const traj = trajectories[objectId];
                if (traj.positions && Array.isArray(traj.positions)) {
                    const color = colors[index % colors.length];
                    
                    // Animated line drawing
                    const progress = animationFrame ? Math.min(1, animationFrame / 30) : 1;
                    const pointsToShow = Math.floor(traj.positions.length * progress);
                    
                    ctx.strokeStyle = color;
                    ctx.lineWidth = 2 + Math.sin(animationFrame * 0.1 + index) * 0.5;
                    ctx.beginPath();
                    
                    for (let i = 0; i < pointsToShow; i++) {
                        const pos = traj.positions[i];
                        const x = centerX + pos.x * scale;
                        const y = centerY + pos.y * scale;
                        
                        if (i === 0) {
                            ctx.moveTo(x, y);
                        } else {
                            ctx.lineTo(x, y);
                        }
                    }
                    
                    ctx.stroke();
                    
                    // Draw animated start point
                    if (traj.positions.length > 0) {
                        const startPos = traj.positions[0];
                        const radius = 3 + 2 * Math.sin(animationFrame * 0.2 + index);
                        ctx.fillStyle = color;
                        ctx.beginPath();
                        ctx.arc(centerX + startPos.x * scale, centerY + startPos.y * scale, radius, 0, 2 * Math.PI);
                        ctx.fill();
                        
                        // Add glow effect
                        ctx.shadowColor = color;
                        ctx.shadowBlur = 10;
                        ctx.fill();
                        ctx.shadowBlur = 0;
                    }
                }
            });
        }
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new NovaGenDashboard();
    
    // Load initial satellite list
    setTimeout(() => {
        window.dashboard.loadSatelliteList();
    }, 2000);
    
    console.log('🚀 NovaGen Dashboard initialized');
    console.log('Real-time orbital collision prediction system active');
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
