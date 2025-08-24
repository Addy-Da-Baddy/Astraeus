// NovaGen Dashboard - Real-time Orbital Prediction System with Satellite Selection
class NovaGenDashboard {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.earth = null;
        this.satellites = [];
        this.debrisObjects = [];
        this.trajectoryLines = [];
        this.animationId = null;
        this.currentTab = 'orbital';
        this.trajectoryChart = null;
        this.predictionInProgress = false;
        this.apiBaseUrl = 'http://localhost:5000/api';
        this.selectedSatellite = null;
        this.satelliteList = [];
        this.highRiskSatellites = [];
        
        this.init();
        this.startRealTimeUpdates();
        this.setupEventListeners();
    }

    init() {
        this.initThreeJS();
        this.initTrajectoryChart();
        this.updateData();
        this.loadSatelliteList();
    }

    setupEventListeners() {
        // Search box
        const searchBox = document.getElementById('satellite-search');
        if (searchBox) {
            searchBox.addEventListener('input', (e) => {
                this.searchSatellites(e.target.value);
            });
        }
        
        // Risk filter
        const riskFilter = document.getElementById('risk-filter');
        if (riskFilter) {
            riskFilter.addEventListener('change', (e) => {
                this.filterByRisk(e.target.value);
            });
        }
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeSatelliteModal();
                this.closeHighRiskModal();
            }
        });
    }

    initThreeJS() {
        const container = document.getElementById('threejs-container');
        
        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x000011);
        
        // Camera
        this.camera = new THREE.PerspectiveCamera(
            75, 
            container.offsetWidth / container.offsetHeight, 
            0.1, 
            100000
        );
        this.camera.position.set(20000, 15000, 20000);
        
        // Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(container.offsetWidth, container.offsetHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        container.appendChild(this.renderer.domElement);
        
        // Lighting
        const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
        this.scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(50000, 50000, 50000);
        directionalLight.castShadow = true;
        this.scene.add(directionalLight);
        
        // Earth
        this.createEarth();
        
        // Controls
        this.setupControls();
        
        // Start animation
        this.animate();
        
        // Resize handler
        window.addEventListener('resize', () => this.onWindowResize());
    }

    createEarth() {
        // Earth sphere
        const earthGeometry = new THREE.SphereGeometry(6371, 64, 64);
        const earthMaterial = new THREE.MeshPhongMaterial({
            color: 0x4488ff,
            shininess: 100,
            transparent: true,
            opacity: 0.9
        });
        
        this.earth = new THREE.Mesh(earthGeometry, earthMaterial);
        this.earth.receiveShadow = true;
        this.scene.add(this.earth);
        
        // Atmosphere
        const atmosphereGeometry = new THREE.SphereGeometry(6471, 32, 32);
        const atmosphereMaterial = new THREE.MeshPhongMaterial({
            color: 0x88ccff,
            transparent: true,
            opacity: 0.15
        });
        const atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
        this.scene.add(atmosphere);
        
        // Orbital reference lines
        this.createOrbitalReference();
    }

    createOrbitalReference() {
        // LEO, MEO, GEO reference circles
        const orbits = [
            { radius: 6371 + 400, color: 0x00ff00, name: 'LEO' },    // LEO ~400km
            { radius: 6371 + 2000, color: 0xffff00, name: 'MEO' },   // MEO ~2000km
            { radius: 6371 + 35786, color: 0xff8800, name: 'GEO' }   // GEO ~35786km
        ];
        
        orbits.forEach(orbit => {
            const geometry = new THREE.RingGeometry(orbit.radius - 50, orbit.radius + 50, 64);
            const material = new THREE.MeshBasicMaterial({
                color: orbit.color,
                transparent: true,
                opacity: 0.2,
                side: THREE.DoubleSide
            });
            const ring = new THREE.Mesh(geometry, material);
            ring.rotation.x = Math.PI / 2;
            this.scene.add(ring);
        });
    }

    setupControls() {
        let mouseDown = false;
        let mouseX = 0;
        let mouseY = 0;
        
        this.renderer.domElement.addEventListener('mousedown', (e) => {
            mouseDown = true;
            mouseX = e.clientX;
            mouseY = e.clientY;
        });
        
        this.renderer.domElement.addEventListener('mouseup', () => {
            mouseDown = false;
        });
        
        this.renderer.domElement.addEventListener('mousemove', (e) => {
            if (!mouseDown) return;
            
            const deltaX = e.clientX - mouseX;
            const deltaY = e.clientY - mouseY;
            
            // Rotate camera around Earth
            const spherical = new THREE.Spherical();
            spherical.setFromVector3(this.camera.position);
            
            spherical.theta -= deltaX * 0.005;
            spherical.phi += deltaY * 0.005;
            spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi));
            
            this.camera.position.setFromSpherical(spherical);
            this.camera.lookAt(0, 0, 0);
            
            mouseX = e.clientX;
            mouseY = e.clientY;
        });
        
        // Zoom
        this.renderer.domElement.addEventListener('wheel', (e) => {
            const factor = e.deltaY > 0 ? 1.1 : 0.9;
            this.camera.position.multiplyScalar(factor);
            this.camera.position.clampLength(10000, 50000);
        });
    }

    createSatellite(data, isDebris = false) {
        const geometry = new THREE.SphereGeometry(isDebris ? 80 : 60, 12, 12);
        const material = new THREE.MeshPhongMaterial({
            color: isDebris ? 0xff4757 : 0x00d4ff,
            emissive: isDebris ? 0x330000 : 0x001122,
            transparent: true,
            opacity: 0.9
        });
        
        const satellite = new THREE.Mesh(geometry, material);
        satellite.position.set(data.x, data.y, data.z);
        satellite.userData = { ...data, isDebris };
        
        // Add glow effect
        const glowGeometry = new THREE.SphereGeometry(isDebris ? 120 : 100, 16, 16);
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: isDebris ? 0xff4757 : 0x00d4ff,
            transparent: true,
            opacity: 0.2
        });
        const glow = new THREE.Mesh(glowGeometry, glowMaterial);
        satellite.add(glow);
        
        return satellite;
    }

    createTrajectoryLine(points, isDebris = false) {
        const geometry = new THREE.BufferGeometry().setFromPoints(
            points.map(p => new THREE.Vector3(p.x, p.y, p.z))
        );
        
        const material = new THREE.LineBasicMaterial({
            color: isDebris ? 0xff4757 : 0x00d4ff,
            transparent: true,
            opacity: 0.6,
            linewidth: 2
        });
        
        return new THREE.Line(geometry, material);
    }

    updateSatellites(satelliteData) {
        // Clear existing objects
        this.satellites.forEach(sat => this.scene.remove(sat));
        this.debrisObjects.forEach(debris => this.scene.remove(debris));
        this.satellites = [];
        this.debrisObjects = [];
        
        if (!satelliteData || !satelliteData.satellites) return;
        
        satelliteData.satellites.slice(0, 200).forEach(data => { // Limit for performance
            const satellite = this.createSatellite(data, data.is_debris);
            
            if (data.is_debris) {
                this.debrisObjects.push(satellite);
            } else {
                this.satellites.push(satellite);
            }
        });
        
        this.updateVisibility();
    }

    updateVisibility() {
        // Remove all satellites and debris from scene
        this.satellites.forEach(sat => this.scene.remove(sat));
        this.debrisObjects.forEach(debris => this.scene.remove(debris));
        this.trajectoryLines.forEach(line => this.scene.remove(line));
        
        // Add objects based on current tab
        switch (this.currentTab) {
            case 'orbital':
                this.satellites.forEach(sat => this.scene.add(sat));
                this.debrisObjects.forEach(debris => this.scene.add(debris));
                break;
            case 'debris':
                this.debrisObjects.forEach(debris => this.scene.add(debris));
                break;
            case 'trajectories':
                this.satellites.forEach(sat => this.scene.add(sat));
                this.debrisObjects.forEach(debris => this.scene.add(debris));
                this.trajectoryLines.forEach(line => this.scene.add(line));
                break;
        }
    }

    animate() {
        this.animationId = requestAnimationFrame(() => this.animate());
        
        // Rotate Earth
        if (this.earth) {
            this.earth.rotation.y += 0.002;
        }
        
        // Animate satellites in orbit
        const time = Date.now() * 0.0001;
        
        [...this.satellites, ...this.debrisObjects].forEach((satellite, index) => {
            if (satellite.parent === this.scene) {
                const data = satellite.userData;
                const orbitSpeed = 0.05 / Math.max(1, (data.altitude || 400) / 1000);
                
                const angle = time * orbitSpeed + index * 0.05;
                const radius = (data.altitude || 400) + 6371;
                const inclination = (data.inclination || 0) * Math.PI / 180;
                
                satellite.position.x = Math.cos(angle) * radius * Math.cos(inclination);
                satellite.position.z = Math.sin(angle) * radius * Math.cos(inclination);
                satellite.position.y = Math.sin(angle) * radius * Math.sin(inclination) * 0.5;
            }
        });
        
        this.renderer.render(this.scene, this.camera);
    }

    initTrajectoryChart() {
        const ctx = document.getElementById('trajectory-chart');
        if (!ctx) return;
        
        this.trajectoryChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Predicted Altitude (km)',
                    data: [],
                    borderColor: '#00d4ff',
                    backgroundColor: 'rgba(0, 212, 255, 0.1)',
                    tension: 0.4,
                    pointRadius: 3,
                    pointHoverRadius: 6
                }, {
                    label: 'Debris Altitude (km)',
                    data: [],
                    borderColor: '#ff4757',
                    backgroundColor: 'rgba(255, 71, 87, 0.1)',
                    tension: 0.4,
                    pointRadius: 3,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: {
                            color: '#ffffff'
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: { color: '#b8b8b8' },
                        grid: { color: 'rgba(255, 255, 255, 0.1)' }
                    },
                    y: {
                        ticks: { color: '#b8b8b8' },
                        grid: { color: 'rgba(255, 255, 255, 0.1)' }
                    }
                }
            }
        });
    }

    // Satellite selection and management
    async loadSatelliteList() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/satellites/search?limit=100`);
            const data = await response.json();
            
            this.satelliteList = data.satellites || [];
            this.displaySatelliteList(this.satelliteList);
            
        } catch (error) {
            console.error('Error loading satellite list:', error);
            document.getElementById('satellite-list').innerHTML = 
                '<div style="text-align: center; color: var(--danger-color);">Failed to load satellites</div>';
        }
    }

    displaySatelliteList(satellites) {
        const listContainer = document.getElementById('satellite-list');
        
        if (!satellites || satellites.length === 0) {
            listContainer.innerHTML = '<div style="text-align: center; color: var(--text-secondary);">No satellites found</div>';
            return;
        }
        
        const html = satellites.map(sat => {
            const riskClass = sat.risk_level.toLowerCase().replace('critical', 'critical').replace('high', 'high-risk');
            const typeIcon = sat.is_debris ? '🗑️' : '🛰️';
            
            return `
                <div class="satellite-item-small ${sat.is_debris ? 'debris' : ''} ${riskClass}" 
                     onclick="dashboard.selectSatellite(${sat.id})" 
                     title="Click for details">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <strong>${typeIcon} Satellite #${sat.id}</strong>
                            <div style="font-size: 0.8rem; color: var(--text-secondary);">
                                ${sat.type} • Alt: ${sat.altitude.toFixed(0)}km
                            </div>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-size: 0.7rem; font-weight: 600; color: ${this.getRiskColor(sat.risk_level)};">
                                ${sat.risk_level}
                            </div>
                            <div style="font-size: 0.7rem;">
                                ${sat.debris_probability.toFixed(1)}%
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        listContainer.innerHTML = html;
    }

    getRiskColor(riskLevel) {
        switch (riskLevel) {
            case 'CRITICAL': return '#ff4757';
            case 'HIGH': return '#ffa502';
            case 'MEDIUM': return '#7b68ee';
            case 'LOW': return '#2ed573';
            default: return '#b8b8b8';
        }
    }

    async searchSatellites(query) {
        if (!query.trim()) {
            this.displaySatelliteList(this.satelliteList);
            return;
        }
        
        try {
            const response = await fetch(`${this.apiBaseUrl}/satellites/search?q=${encodeURIComponent(query)}`);
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

    async selectSatellite(satelliteId) {
        try {
            this.showAlert('Loading satellite details...', 'info');
            
            const response = await fetch(`${this.apiBaseUrl}/satellite/${satelliteId}/details`);
            const data = await response.json();
            
            if (data.success) {
                this.selectedSatellite = data.satellite;
                this.showSatelliteDetails(data.satellite);
                this.focusOnSatelliteInView(satelliteId);
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
        document.getElementById('detail-type').textContent = satellite.risk_assessment.is_debris ? 'Space Debris' : 'Active Satellite';
        document.getElementById('detail-status').textContent = satellite.health_status.status;
        document.getElementById('detail-updated').textContent = new Date(satellite.timestamp).toLocaleString();
        
        // Risk assessment
        document.getElementById('detail-risk-level').textContent = satellite.risk_assessment.risk_level;
        document.getElementById('detail-risk-level').style.color = this.getRiskColor(satellite.risk_assessment.risk_level);
        document.getElementById('detail-debris-prob').textContent = `${satellite.risk_assessment.debris_probability.toFixed(2)}%`;
        document.getElementById('detail-collision-risk').textContent = satellite.risk_assessment.collision_risk;
        document.getElementById('detail-risk-score').textContent = satellite.risk_assessment.risk_score.toFixed(1);
        
        // Position & velocity
        const pos = satellite.basic_info.position;
        const vel = satellite.basic_info.velocity;
        document.getElementById('detail-position').textContent = `(${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)})`;
        document.getElementById('detail-velocity').textContent = `(${vel.vx.toFixed(3)}, ${vel.vy.toFixed(3)}, ${vel.vz.toFixed(3)})`;
        document.getElementById('detail-speed').textContent = `${vel.magnitude.toFixed(3)} km/s`;
        
        // Orbital elements
        const orbital = satellite.basic_info.orbital_elements;
        document.getElementById('detail-altitude').textContent = `${orbital.altitude.toFixed(1)} km`;
        document.getElementById('detail-inclination').textContent = `${orbital.inclination.toFixed(2)}°`;
        document.getElementById('detail-eccentricity').textContent = orbital.eccentricity.toFixed(4);
        document.getElementById('detail-period').textContent = `${(orbital.period / 60).toFixed(1)} min`;
        document.getElementById('detail-apogee').textContent = `${orbital.apogee.toFixed(1)} km`;
        document.getElementById('detail-perigee').textContent = `${orbital.perigee.toFixed(1)} km`;
        
        // Health flags
        const flagsContainer = document.getElementById('detail-flags');
        flagsContainer.innerHTML = satellite.health_status.flags.map(flag => 
            `<span class="threat-badge ${satellite.health_status.status.toLowerCase()}">${flag}</span>`
        ).join('');
        
        // Show modal
        document.getElementById('satellite-modal').classList.add('show');
    }

    closeSatelliteModal() {
        document.getElementById('satellite-modal').classList.remove('show');
        this.selectedSatellite = null;
    }

    async viewHighRiskSatellites() {
        try {
            this.showAlert('Loading high-risk satellites...', 'info');
            
            const response = await fetch(`${this.apiBaseUrl}/satellites/high-risk`);
            const data = await response.json();
            
            if (data.success) {
                this.highRiskSatellites = data.satellites;
                this.showHighRiskModal(data);
            } else {
                this.showAlert('Failed to load high-risk satellites: ' + data.error, 'danger');
            }
            
        } catch (error) {
            console.error('Error loading high-risk satellites:', error);
            this.showAlert('Error loading high-risk satellites', 'danger');
        }
    }

    showHighRiskModal(data) {
        // Summary cards
        const summaryContainer = document.getElementById('high-risk-summary');
        const summary = data.threat_summary;
        summaryContainer.innerHTML = `
            <div class="detail-section" style="text-align: center; flex: 1;">
                <h3 style="color: var(--danger-color); margin-bottom: 0.5rem;">${summary.critical}</h3>
                <div>Critical</div>
            </div>
            <div class="detail-section" style="text-align: center; flex: 1;">
                <h3 style="color: var(--warning-color); margin-bottom: 0.5rem;">${summary.high}</h3>
                <div>High</div>
            </div>
            <div class="detail-section" style="text-align: center; flex: 1;">
                <h3 style="color: var(--accent-color); margin-bottom: 0.5rem;">${summary.elevated}</h3>
                <div>Elevated</div>
            </div>
            <div class="detail-section" style="text-align: center; flex: 1;">
                <h3 style="color: var(--primary-color); margin-bottom: 0.5rem;">${summary.moderate}</h3>
                <div>Moderate</div>
            </div>
        `;
        
        // High-risk table
        const tbody = document.getElementById('high-risk-tbody');
        tbody.innerHTML = data.satellites.map(sat => `
            <tr onclick="dashboard.selectSatellite(${sat.id})" style="cursor: pointer;">
                <td>#${sat.id}</td>
                <td><span class="threat-badge threat-${sat.threat_level.toLowerCase()}">${sat.threat_level}</span></td>
                <td>${sat.debris_probability}%</td>
                <td>${sat.position.altitude.toFixed(0)} km</td>
                <td>${sat.priority_score}</td>
                <td>${sat.status_flags.join(', ')}</td>
                <td>
                    <button class="btn" onclick="event.stopPropagation(); dashboard.selectSatellite(${sat.id})" style="padding: 0.3rem 0.8rem; font-size: 0.8rem;">
                        <i class="fas fa-eye"></i> View
                    </button>
                </td>
            </tr>
        `).join('');
        
        // Show modal
        document.getElementById('high-risk-modal').classList.add('show');
    }

    closeHighRiskModal() {
        document.getElementById('high-risk-modal').classList.remove('show');
    }

    focusOnSatelliteInView(satelliteId) {
        // Find satellite in 3D view and focus camera on it
        const allObjects = [...this.satellites, ...this.debrisObjects];
        const targetSatellite = allObjects.find(sat => sat.userData && sat.userData.id === satelliteId);
        
        if (targetSatellite && this.camera) {
            const targetPos = targetSatellite.position;
            const distance = 5000; // km
            
            // Position camera to look at the satellite
            this.camera.position.set(
                targetPos.x + distance,
                targetPos.y + distance,
                targetPos.z + distance
            );
            this.camera.lookAt(targetPos);
            
            // Highlight the satellite temporarily
            const originalMaterial = targetSatellite.material;
            targetSatellite.material = targetSatellite.material.clone();
            targetSatellite.material.emissive.setHex(0xffffff);
            
            setTimeout(() => {
                targetSatellite.material = originalMaterial;
            }, 3000);
            
            this.showAlert(`Focused on Satellite #${satelliteId}`, 'success');
        }
    }

    async showSatelliteTrajectory() {
        if (!this.selectedSatellite) return;
        
        try {
            const response = await fetch(`${this.apiBaseUrl}/trajectory/${this.selectedSatellite.id}`);
            const data = await response.json();
            
            if (!data.error) {
                // Switch to trajectories tab and show this satellite's trajectory
                this.currentTab = 'trajectories';
                document.querySelectorAll('.viz-tab').forEach(tab => tab.classList.remove('active'));
                document.querySelector('[onclick="switchTab(\'trajectories\')"]').classList.add('active');
                
                // Create trajectory visualization for this satellite
                this.createRealTrajectoryVisualization([data]);
                this.updateVisibility();
                
                this.showAlert('Trajectory displayed in 3D view', 'success');
                this.closeSatelliteModal();
            } else {
                this.showAlert('Failed to load trajectory: ' + data.error, 'danger');
            }
            
        } catch (error) {
            console.error('Trajectory error:', error);
            this.showAlert('Error loading trajectory', 'danger');
        }
    }

    async refreshSatelliteList() {
        this.showAlert('Refreshing satellite list...', 'info');
        await this.loadSatelliteList();
        this.showAlert('Satellite list refreshed', 'success');
    }

    // API calls
    async startRealTimeUpdates() {
        await this.updateData();
        setInterval(() => this.updateData(), 15000); // Update every 15 seconds
    }

    async updateData() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/data`);
            const data = await response.json();
            
            this.updateUI(data);
            this.updateSatellites(data);
            this.updateDataTable(data.satellites || []);
            
        } catch (error) {
            console.error('Error fetching data:', error);
            this.showAlert('Connection error. Retrying...', 'warning');
        }
    }

    async runPrediction() {
        if (this.predictionInProgress) return;
        
        this.predictionInProgress = true;
        const btn = document.querySelector('.predict-btn');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Running Real-time Prediction...';
        
        try {
            console.log('🔄 Starting real-time prediction...');
            const response = await fetch(`${this.apiBaseUrl}/predict/realtime`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showAlert(`✅ Real-time prediction complete! ${result.debris_count} debris detected from ${result.total_objects} objects using ${result.models_used.debris_detection.length} ML models.`, 'success');
                
                // Update UI immediately with fresh data
                this.updateUI(result);
                
                // Refresh 3D visualization with new data
                await this.updateData();
                
                console.log('🎯 Models used:', result.models_used);
            } else {
                this.showAlert('❌ Prediction failed: ' + (result.error || 'Unknown error'), 'danger');
            }
            
        } catch (error) {
            console.error('❌ Prediction error:', error);
            this.showAlert('❌ Real-time prediction error: ' + error.message, 'danger');
        } finally {
            this.predictionInProgress = false;
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-rocket"></i> Run Real-time Prediction';
        }
    }

    async runTrajectoryPrediction() {
        try {
            console.log('🚀 Starting real trajectory prediction...');
            
            // Get real satellite data
            const response = await fetch(`${this.apiBaseUrl}/satellites`);
            const data = await response.json();
            
            if (data.satellites && data.satellites.length > 0) {
                // Use real trajectory prediction for first 10 satellites
                const trajectoryPromises = [];
                const selectedSatellites = data.satellites.slice(0, 10);
                
                this.showAlert('🔄 Generating real trajectory predictions...', 'info');
                
                for (let i = 0; i < selectedSatellites.length; i++) {
                    trajectoryPromises.push(
                        fetch(`${this.apiBaseUrl}/trajectory/${i}`)
                            .then(res => res.json())
                            .catch(err => {
                                console.warn(`Failed to get trajectory for satellite ${i}:`, err);
                                return null;
                            })
                    );
                }
                
                const trajectoryResults = await Promise.all(trajectoryPromises);
                const validTrajectories = trajectoryResults.filter(t => t && !t.error);
                
                if (validTrajectories.length > 0) {
                    // Update trajectory chart with real data
                    this.updateTrajectoryChart(validTrajectories);
                    
                    // Create real 3D trajectory visualization
                    this.createRealTrajectoryVisualization(validTrajectories);
                    
                    this.showAlert(`✅ Real trajectory predictions completed for ${validTrajectories.length} satellites using LSTM & GRU neural networks!`, 'success');
                } else {
                    this.showAlert('❌ No valid trajectory predictions generated', 'warning');
                }
            }
            
        } catch (error) {
            console.error('❌ Real trajectory prediction error:', error);
            this.showAlert('❌ Real trajectory prediction failed: ' + error.message, 'danger');
        }
    }

    updateTrajectoryChart(trajectoryResults) {
        const labels = [];
        const satelliteAltitudes = [];
        const debrisAltitudes = [];
        const confidenceData = [];
        
        // Use real data from first trajectory
        if (trajectoryResults.length > 0) {
            const firstTrajectory = trajectoryResults[0];
            
            firstTrajectory.trajectory.forEach((point, index) => {
                labels.push(`T+${Math.floor(point.time / 60)}min`);
                
                if (firstTrajectory.satellite_info.is_debris) {
                    debrisAltitudes.push(point.predicted_altitude);
                    satelliteAltitudes.push(null);
                } else {
                    satelliteAltitudes.push(point.predicted_altitude);
                    debrisAltitudes.push(null);
                }
                
                confidenceData.push(point.confidence * 100);
            });
        }
        
        // Add data from other trajectories
        for (let i = 1; i < Math.min(trajectoryResults.length, 3); i++) {
            const trajectory = trajectoryResults[i];
            trajectory.trajectory.forEach((point, index) => {
                if (index < labels.length) {
                    if (trajectory.satellite_info.is_debris) {
                        if (debrisAltitudes[index] === null) {
                            debrisAltitudes[index] = point.predicted_altitude;
                        }
                    } else {
                        if (satelliteAltitudes[index] === null) {
                            satelliteAltitudes[index] = point.predicted_altitude;
                        }
                    }
                }
            });
        }
        
        // Update chart with real prediction data
        this.trajectoryChart.data.labels = labels;
        this.trajectoryChart.data.datasets[0].data = satelliteAltitudes;
        this.trajectoryChart.data.datasets[1].data = debrisAltitudes;
        
        // Add confidence dataset
        if (this.trajectoryChart.data.datasets.length < 3) {
            this.trajectoryChart.data.datasets.push({
                label: 'Prediction Confidence (%)',
                data: confidenceData,
                borderColor: '#7b68ee',
                backgroundColor: 'rgba(123, 104, 238, 0.1)',
                tension: 0.4,
                pointRadius: 2,
                yAxisID: 'y1'
            });
        } else {
            this.trajectoryChart.data.datasets[2].data = confidenceData;
        }
        
        // Add second Y axis for confidence
        if (!this.trajectoryChart.options.scales.y1) {
            this.trajectoryChart.options.scales.y1 = {
                type: 'linear',
                display: true,
                position: 'right',
                ticks: { color: '#b8b8b8' },
                grid: { drawOnChartArea: false },
                max: 100,
                min: 0
            };
        }
        
        this.trajectoryChart.update();
    }

    createRealTrajectoryVisualization(trajectoryResults) {
        // Clear existing trajectory lines
        this.trajectoryLines.forEach(line => this.scene.remove(line));
        this.trajectoryLines = [];
        
        trajectoryResults.forEach(trajectoryData => {
            if (!trajectoryData.trajectory) return;
            
            const points = trajectoryData.trajectory.map(point => 
                new THREE.Vector3(point.x, point.y, point.z)
            );
            
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            
            // Color based on debris status and confidence
            const isDebris = trajectoryData.satellite_info.is_debris;
            const baseColor = isDebris ? 0xff4757 : 0x00d4ff;
            
            const material = new THREE.LineBasicMaterial({
                color: baseColor,
                transparent: true,
                opacity: 0.8,
                linewidth: isDebris ? 3 : 2
            });
            
            const trajectoryLine = new THREE.Line(geometry, material);
            this.trajectoryLines.push(trajectoryLine);
            
            // Add confidence-based markers along trajectory
            const markerGeometry = new THREE.SphereGeometry(30, 8, 8);
            trajectoryData.trajectory.forEach((point, index) => {
                if (index % 5 === 0) { // Every 5th point
                    const markerMaterial = new THREE.MeshBasicMaterial({
                        color: baseColor,
                        transparent: true,
                        opacity: point.confidence || 0.7
                    });
                    
                    const marker = new THREE.Mesh(markerGeometry, markerMaterial);
                    marker.position.set(point.x, point.y, point.z);
                    trajectoryLine.add(marker);
                }
            });
        });
        
        // Add trajectory lines to scene if in trajectories tab
        if (this.currentTab === 'trajectories') {
            this.trajectoryLines.forEach(line => this.scene.add(line));
        }
    }

    updateUI(data) {
        // Update metrics
        document.getElementById('total-objects').textContent = 
            data.total_objects?.toLocaleString() || '-';
        
        document.getElementById('debris-count').textContent = 
            data.debris_count || '-';
        
        document.getElementById('high-risk-count').textContent = 
            data.high_risk_count || '-';
        
        document.getElementById('last-update').textContent = 
            data.timestamp ? new Date(data.timestamp).toLocaleTimeString() : '-';
        
        // Update risk assessment
        const collisionProb = (data.collision_probability || 0) * 100;
        document.getElementById('risk-percentage').textContent = `${collisionProb.toFixed(4)}%`;
        
        const riskIndicator = document.getElementById('risk-indicator');
        const riskStatus = document.getElementById('risk-status');
        
        // Position risk indicator (0-100%)
        const position = Math.min(collisionProb * 10, 95); // Scale for visibility
        riskIndicator.style.left = `${position}%`;
        
        // Update risk status and color
        if (collisionProb > 5) {
            riskStatus.textContent = 'HIGH RISK';
            riskStatus.style.color = '#ff4757';
            document.getElementById('risk-percentage').style.color = '#ff4757';
        } else if (collisionProb > 1) {
            riskStatus.textContent = 'MODERATE RISK';
            riskStatus.style.color = '#ffa502';
            document.getElementById('risk-percentage').style.color = '#ffa502';
        } else {
            riskStatus.textContent = 'LOW RISK';
            riskStatus.style.color = '#2ed573';
            document.getElementById('risk-percentage').style.color = '#2ed573';
        }
        
        // Alert for high risk
        if (collisionProb > 5) {
            this.showAlert(`🚨 HIGH COLLISION RISK: ${collisionProb.toFixed(4)}%`, 'danger');
        }
    }

    updateDataTable(satellites) {
        const tbody = document.getElementById('objects-tbody');
        if (!satellites || satellites.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-secondary);">No data available</td></tr>';
            return;
        }
        
        const rows = satellites.slice(0, 20).map((sat, index) => {
            const riskLevel = sat.is_debris ? 'HIGH' : 'LOW';
            const riskColor = sat.is_debris ? 'var(--danger-color)' : 'var(--success-color)';
            const rowClass = sat.is_debris ? 'debris-row' : '';
            
            return `
                <tr class="${rowClass}">
                    <td>#${index + 1}</td>
                    <td>${sat.is_debris ? '🗑️ Debris' : '🛰️ Satellite'}</td>
                    <td>${(sat.altitude || 0).toFixed(0)}</td>
                    <td>${(sat.inclination || 0).toFixed(1)}</td>
                    <td style="color: ${riskColor}; font-weight: 600;">${riskLevel}</td>
                    <td>${sat.is_debris ? 'Tracked' : 'Active'}</td>
                </tr>
            `;
        }).join('');
        
        tbody.innerHTML = rows;
    }

    showAlert(message, type = 'success') {
        // Remove existing alert
        const existingAlert = document.querySelector('.alert');
        if (existingAlert) {
            existingAlert.remove();
        }
        
        const alert = document.createElement('div');
        alert.className = `alert ${type}`;
        alert.innerHTML = `
            <div style="display: flex; align-items: center; gap: 1rem;">
                <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'danger' ? 'exclamation-triangle' : 'info-circle'}"></i>
                <div>${message}</div>
            </div>
        `;
        
        document.body.appendChild(alert);
        
        setTimeout(() => {
            if (alert.parentNode) {
                alert.remove();
            }
        }, 5000);
    }

    onWindowResize() {
        const container = document.getElementById('threejs-container');
        if (container && this.camera && this.renderer) {
            this.camera.aspect = container.offsetWidth / container.offsetHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(container.offsetWidth, container.offsetHeight);
        }
    }
}

// Global functions
function switchTab(tabName) {
    // Update tab appearance
    document.querySelectorAll('.viz-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // Update dashboard
    if (window.dashboard) {
        window.dashboard.currentTab = tabName;
        window.dashboard.updateVisibility();
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

// Global functions for HTML event handlers
function switchTab(tab) {
    if (window.dashboard) {
        window.dashboard.switchTab(tab);
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

function closeHighRiskModal() {
    if (window.dashboard) {
        window.dashboard.closeHighRiskModal();
    }
}

function showSatelliteTrajectory() {
    if (window.dashboard) {
        window.dashboard.showSatelliteTrajectory();
    }
}

function searchSatellites() {
    const query = document.getElementById('satellite-search').value;
    if (window.dashboard) {
        window.dashboard.searchSatellites(query);
    }
}

function filterSatellites() {
    const riskLevel = document.getElementById('risk-filter').value;
    if (window.dashboard) {
        window.dashboard.filterByRisk(riskLevel);
    }
}

function viewHighRiskSatellites() {
    if (window.dashboard) {
        window.dashboard.viewHighRiskSatellites();
    }
}

function refreshSatelliteList() {
    if (window.dashboard) {
        window.dashboard.refreshSatelliteList();
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new NovaGenDashboard();
    
    // Load initial satellite list
    setTimeout(() => {
        window.dashboard.loadSatelliteList();
    }, 2000); // Wait for initial data load
    
    console.log('🚀 NovaGen Dashboard initialized');
    console.log('Real-time orbital collision prediction system active');
});
