// NovaGen - 3D Orbital Visualization and Real-time Data Management
class NovaGenApp {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.satellites = [];
        this.debrisObjects = [];
        this.earth = null;
        this.animationId = null;
        this.animationSpeed = 1;
        this.showDebrisOnly = false;
        
        this.init();
        this.startDataUpdates();
        this.createStars();
    }

    init() {
        // Initialize Three.js scene
        const container = document.getElementById('threejs-container');
        
        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x000011);
        
        // Camera
        this.camera = new THREE.PerspectiveCamera(
            75, 
            container.offsetWidth / container.offsetHeight, 
            0.1, 
            50000
        );
        this.camera.position.set(15000, 10000, 15000);
        
        // Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(container.offsetWidth, container.offsetHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        container.appendChild(this.renderer.domElement);
        
        // Lighting
        const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
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
        
        // Handle resize
        window.addEventListener('resize', () => this.onWindowResize());
    }

    createEarth() {
        const earthGeometry = new THREE.SphereGeometry(6371, 64, 64);
        
        // Earth material with texture (simplified)
        const earthMaterial = new THREE.MeshPhongMaterial({
            color: 0x4488ff,
            shininess: 100,
            transparent: true,
            opacity: 0.8
        });
        
        this.earth = new THREE.Mesh(earthGeometry, earthMaterial);
        this.earth.receiveShadow = true;
        this.scene.add(this.earth);
        
        // Earth atmosphere
        const atmosphereGeometry = new THREE.SphereGeometry(6471, 64, 64);
        const atmosphereMaterial = new THREE.MeshPhongMaterial({
            color: 0x88ccff,
            transparent: true,
            opacity: 0.2
        });
        const atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
        this.scene.add(atmosphere);
        
        // Grid lines for reference
        const gridHelper = new THREE.PolarGridHelper(15000, 16, 8, 64, 0x444444, 0x444444);
        this.scene.add(gridHelper);
    }

    setupControls() {
        // Simple mouse controls for camera
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
            
            spherical.theta -= deltaX * 0.01;
            spherical.phi += deltaY * 0.01;
            spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi));
            
            this.camera.position.setFromSpherical(spherical);
            this.camera.lookAt(0, 0, 0);
            
            mouseX = e.clientX;
            mouseY = e.clientY;
        });
        
        // Zoom with mouse wheel
        this.renderer.domElement.addEventListener('wheel', (e) => {
            const factor = e.deltaY > 0 ? 1.1 : 0.9;
            this.camera.position.multiplyScalar(factor);
            this.camera.position.clampLength(8000, 30000);
        });
    }

    createSatellite(data, isDnbris = false) {
        const geometry = new THREE.SphereGeometry(50, 8, 8);
        const material = new THREE.MeshPhongMaterial({
            color: isDnbris ? 0xff4757 : 0x00d4ff,
            emissive: isDnbris ? 0x330000 : 0x001133,
            transparent: true,
            opacity: 0.8
        });
        
        const satellite = new THREE.Mesh(geometry, material);
        satellite.position.set(data.x, data.y, data.z);
        satellite.userData = data;
        
        // Add trail
        const trailGeometry = new THREE.BufferGeometry();
        const trailMaterial = new THREE.LineBasicMaterial({
            color: isDnbris ? 0xff4757 : 0x00d4ff,
            transparent: true,
            opacity: 0.3
        });
        
        const trail = new THREE.Line(trailGeometry, trailMaterial);
        satellite.add(trail);
        
        return satellite;
    }

    updateSatellites(satelliteData) {
        // Clear existing satellites
        this.satellites.forEach(sat => this.scene.remove(sat));
        this.debrisObjects.forEach(debris => this.scene.remove(debris));
        this.satellites = [];
        this.debrisObjects = [];
        
        if (!satelliteData || !satelliteData.satellites) return;
        
        satelliteData.satellites.forEach(data => {
            const satellite = this.createSatellite(data, data.is_debris);
            
            if (data.is_debris) {
                this.debrisObjects.push(satellite);
                if (!this.showDebrisOnly) {
                    this.scene.add(satellite);
                }
            } else {
                this.satellites.push(satellite);
                if (!this.showDebrisOnly) {
                    this.scene.add(satellite);
                }
            }
        });
        
        if (this.showDebrisOnly) {
            this.debrisObjects.forEach(debris => this.scene.add(debris));
        }
    }

    animate() {
        this.animationId = requestAnimationFrame(() => this.animate());
        
        // Rotate Earth
        if (this.earth) {
            this.earth.rotation.y += 0.005 * this.animationSpeed;
        }
        
        // Animate satellites in orbit
        const time = Date.now() * 0.0001 * this.animationSpeed;
        
        [...this.satellites, ...this.debrisObjects].forEach((satellite, index) => {
            if (satellite.parent === this.scene) {
                const data = satellite.userData;
                const orbitSpeed = 0.1 / (data.altitude / 1000 + 1); // Slower for higher orbits
                
                const angle = time * orbitSpeed + index * 0.1;
                const radius = data.altitude + 6371;
                
                satellite.position.x = Math.cos(angle) * radius;
                satellite.position.z = Math.sin(angle) * radius;
                satellite.position.y = Math.sin(angle * 0.5) * radius * 0.3; // Some inclination
            }
        });
        
        this.renderer.render(this.scene, this.camera);
    }

    onWindowResize() {
        const container = document.getElementById('threejs-container');
        this.camera.aspect = container.offsetWidth / container.offsetHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(container.offsetWidth, container.offsetHeight);
    }

    // Data management
    async startDataUpdates() {
        await this.updateData();
        setInterval(() => this.updateData(), 30000); // Update every 30 seconds
    }

    async updateData() {
        try {
            const response = await fetch('/api/data');
            const data = await response.json();
            
            this.updateUI(data);
            this.updateSatellites(data);
            
        } catch (error) {
            console.error('Error fetching data:', error);
            this.showAlert('Error fetching data', 'danger');
        }
    }

    updateUI(data) {
        // Update status indicators
        document.getElementById('system-status').textContent = 
            data.status === 'active' ? 'Online' : 'Offline';
        
        document.getElementById('status-dot').style.background = 
            data.status === 'active' ? '#2ed573' : '#ff4757';
        
        // Update metrics
        document.getElementById('total-objects').textContent = 
            data.total_objects?.toLocaleString() || '-';
        
        document.getElementById('debris-count').textContent = 
            data.debris_count || '-';
        
        document.getElementById('high-risk-count').textContent = 
            data.high_risk_count || '-';
        
        const collisionProb = data.collision_probability || 0;
        document.getElementById('collision-prob').textContent = 
            `${(collisionProb * 100).toFixed(4)}%`;
        
        // Color code collision probability
        const probElement = document.getElementById('collision-prob');
        if (collisionProb > 0.05) {
            probElement.className = 'metric-value danger';
        } else if (collisionProb > 0.01) {
            probElement.className = 'metric-value warning';
        } else {
            probElement.className = 'metric-value success';
        }
        
        // Update timestamp
        document.getElementById('last-update').textContent = 
            `Last Update: ${new Date(data.timestamp).toLocaleTimeString()}`;
        
        // Update lists
        this.updateDebrisList(data.satellites);
        this.updateSatelliteList(data.satellites);
        
        // Check for high risk alert
        if (collisionProb > 0.05) {
            this.showAlert('HIGH COLLISION RISK DETECTED!', 'danger');
        }
    }

    updateDebrisList(satellites) {
        const debrisList = document.getElementById('debris-list');
        const debris = satellites ? satellites.filter(sat => sat.is_debris) : [];
        
        if (debris.length === 0) {
            debrisList.innerHTML = '<div style="text-align: center; color: var(--text-secondary);">No debris detected</div>';
            return;
        }
        
        debrisList.innerHTML = debris.slice(0, 10).map((item, index) => `
            <div class="debris-item">
                <div style="font-weight: 600;">Debris #${index + 1}</div>
                <div style="font-size: 0.9rem; color: var(--text-secondary);">
                    Alt: ${item.altitude?.toFixed(0)} km<br>
                    Inc: ${item.inclination?.toFixed(1)}
                </div>
            </div>
        `).join('');
    }

    updateSatelliteList(satellites) {
        const satelliteList = document.getElementById('satellite-list');
        const activeSats = satellites ? satellites.filter(sat => !sat.is_debris) : [];
        
        satelliteList.innerHTML = activeSats.slice(0, 8).map((item, index) => `
            <div class="satellite-item">
                <div style="font-weight: 600;">Satellite #${index + 1}</div>
                <div style="font-size: 0.9rem; color: var(--text-secondary);">
                    Alt: ${item.altitude?.toFixed(0)} km<br>
                    Inc: ${item.inclination?.toFixed(1)}
                </div>
            </div>
        `).join('');
    }

    showAlert(message, type = 'info') {
        const existingAlert = document.querySelector('.alert');
        if (existingAlert) {
            existingAlert.remove();
        }
        
        const alert = document.createElement('div');
        alert.className = 'alert';
        alert.innerHTML = `
            <i class="fas fa-exclamation-triangle"></i>
            ${message}
        `;
        
        if (type === 'danger') {
            alert.style.background = '#ff4757';
        }
        
        document.body.appendChild(alert);
        
        setTimeout(() => {
            alert.remove();
        }, 5000);
    }

    createStars() {
        const starsContainer = document.getElementById('stars');
        
        for (let i = 0; i < 200; i++) {
            const star = document.createElement('div');
            star.className = 'star';
            star.style.left = Math.random() * 100 + '%';
            star.style.top = Math.random() * 100 + '%';
            star.style.width = Math.random() * 3 + 1 + 'px';
            star.style.height = star.style.width;
            star.style.animationDelay = Math.random() * 2 + 's';
            starsContainer.appendChild(star);
        }
    }
}

// Global functions for UI controls
function manualUpdate() {
    if (window.novaGen) {
        window.novaGen.updateData();
        window.novaGen.showAlert('Data updated manually', 'info');
    }
}

function toggleAlert() {
    if (window.novaGen) {
        window.novaGen.showAlert('TEST ALERT: High collision risk simulation!', 'danger');
    }
}

function toggleDebrisFilter() {
    if (window.novaGen) {
        const checkbox = document.getElementById('debris-filter');
        window.novaGen.showDebrisOnly = checkbox.checked;
        
        // Clear and re-add objects based on filter
        window.novaGen.satellites.forEach(sat => window.novaGen.scene.remove(sat));
        window.novaGen.debrisObjects.forEach(debris => window.novaGen.scene.remove(debris));
        
        if (window.novaGen.showDebrisOnly) {
            window.novaGen.debrisObjects.forEach(debris => window.novaGen.scene.add(debris));
        } else {
            window.novaGen.satellites.forEach(sat => window.novaGen.scene.add(sat));
            window.novaGen.debrisObjects.forEach(debris => window.novaGen.scene.add(debris));
        }
    }
}

function updateSpeed() {
    if (window.novaGen) {
        const slider = document.getElementById('speed-control');
        window.novaGen.animationSpeed = parseFloat(slider.value);
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.novaGen = new NovaGenApp();
});
