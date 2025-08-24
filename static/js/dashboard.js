// NovaGen Dashboard - Real-time Orbital Prediction System
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
        
        this.init();
        this.startRealTimeUpdates();
    }

    init() {
        this.initThreeJS();
        this.initTrajectoryChart();
        this.updateData();
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

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new NovaGenDashboard();
    console.log('🚀 NovaGen Dashboard initialized');
    console.log('Real-time orbital collision prediction system active');
});
