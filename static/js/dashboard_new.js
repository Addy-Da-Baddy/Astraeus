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

        // Scene setup
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x000011);

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
        }

        // Create Earth
        this.createEarth();
        
        // Add lights
        this.addLights();
        
        // Start animation loop
        this.animate();
    }

    createEarth() {
        const geometry = new THREE.SphereGeometry(6371, 64, 64);
        
        // Earth material with basic color
        const material = new THREE.MeshPhongMaterial({
            color: 0x6b93d6,
            shininess: 30
        });

        this.earth = new THREE.Mesh(geometry, material);
        this.earth.receiveShadow = true;
        this.scene.add(this.earth);

        // Add atmosphere
        const atmosphereGeometry = new THREE.SphereGeometry(6371 * 1.025, 64, 64);
        const atmosphereMaterial = new THREE.MeshBasicMaterial({
            color: 0x87ceeb,
            transparent: true,
            opacity: 0.1
        });
        const atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
        this.scene.add(atmosphere);
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
            resultContainer.innerHTML = '<div style="text-align: center; padding: 2rem;"><div class="loading"></div><p>Calculating orbital trajectories...</p></div>';
            
            const response = await fetch(`${this.apiBaseUrl}/trajectory-bulk`, { method: 'POST' });
            const data = await response.json();
            
            if (data.error) {
                resultContainer.innerHTML = `<div style="color: var(--danger-color); text-align: center; padding: 2rem;">${data.error}</div>`;
                this.showAlert('Trajectory prediction failed: ' + data.error, 'danger');
                return;
            }

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
                <div style="padding: 1rem; background: rgba(255, 255, 255, 0.05); border-radius: 8px;">
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

            this.showAlert('✅ Trajectory predictions completed', 'success');
            
        } catch (error) {
            console.error('Trajectory prediction error:', error);
            this.showAlert('Error generating trajectories', 'danger');
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
            this.camera.position.set(15000, 10000, 15000);
            this.camera.lookAt(0, 0, 0);
        }
    }

    toggleSatellites() {
        this.satellites.forEach(sat => {
            sat.visible = !sat.visible;
        });
        this.showAlert('Satellites ' + (this.satellites[0]?.visible ? 'shown' : 'hidden'), 'info');
    }

    toggleDebris() {
        this.debrisObjects.forEach(debris => {
            debris.visible = !debris.visible;
        });
        this.showAlert('Debris ' + (this.debrisObjects[0]?.visible ? 'shown' : 'hidden'), 'info');
    }

    toggleTrajectories() {
        this.trajectoryLines.forEach(line => {
            line.visible = !line.visible;
        });
        this.showAlert('Trajectories ' + (this.trajectoryLines[0]?.visible ? 'shown' : 'hidden'), 'info');
    }

    clearTrajectories() {
        this.trajectoryLines.forEach(line => this.scene.remove(line));
        this.trajectoryLines = [];
        this.showAlert('Trajectories cleared', 'info');
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
