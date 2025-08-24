"""
Orbital Mechanics Module
========================

Provides comprehensive orbital mechanics calculations including:
- Orbital elements conversions
- Position and velocity calculations
- Orbital maneuvers and transfers
- Perturbation effects
- Lambert's problem solver
"""

import numpy as np
import math
from typing import Tuple, List, Dict, Optional
from dataclasses import dataclass

@dataclass
class OrbitalState:
    """Represents the state of an orbiting object"""
    position: np.ndarray  # [x, y, z] in km
    velocity: np.ndarray  # [vx, vy, vz] in km/s
    epoch: float  # Julian date
    
    def __post_init__(self):
        self.position = np.array(self.position, dtype=float)
        self.velocity = np.array(self.velocity, dtype=float)

@dataclass
class OrbitalElements:
    """Classical orbital elements"""
    semi_major_axis: float  # km
    eccentricity: float     # dimensionless
    inclination: float      # radians
    argument_of_periapsis: float  # radians
    longitude_of_ascending_node: float  # radians
    true_anomaly: float    # radians
    
    def __post_init__(self):
        # Convert angles to radians if they're in degrees
        if abs(self.inclination) > 2*np.pi:
            self.inclination = np.radians(self.inclination)
        if abs(self.argument_of_periapsis) > 2*np.pi:
            self.argument_of_periapsis = np.radians(self.argument_of_periapsis)
        if abs(self.longitude_of_ascending_node) > 2*np.pi:
            self.longitude_of_ascending_node = np.radians(self.longitude_of_ascending_node)
        if abs(self.true_anomaly) > 2*np.pi:
            self.true_anomaly = np.radians(self.true_anomaly)

class OrbitalMechanics:
    """Main class for orbital mechanics calculations"""
    
    def __init__(self):
        # Earth gravitational parameter (km³/s²)
        self.mu_earth = 398600.4418
        
        # Earth radius (km)
        self.earth_radius = 6371.0
        
        # J2 perturbation coefficient
        self.j2 = 0.00108263
        
    def state_to_elements(self, state: OrbitalState) -> OrbitalElements:
        """Convert position and velocity to orbital elements"""
        r = state.position
        v = state.velocity
        
        # Angular momentum vector
        h = np.cross(r, v)
        h_mag = np.linalg.norm(h)
        
        # Eccentricity vector
        e_vec = np.cross(v, h) / self.mu_earth - r / np.linalg.norm(r)
        e = np.linalg.norm(e_vec)
        
        # Semi-major axis
        v_mag = np.linalg.norm(v)
        r_mag = np.linalg.norm(r)
        energy = v_mag**2 / 2 - self.mu_earth / r_mag
        a = -self.mu_earth / (2 * energy) if energy < 0 else float('inf')
        
        # Inclination
        i = np.arccos(h[2] / h_mag)
        
        # Longitude of ascending node
        n = np.cross([0, 0, 1], h)
        n_mag = np.linalg.norm(n)
        if n_mag > 0:
            omega = np.arccos(n[0] / n_mag)
            if n[1] < 0:
                omega = 2*np.pi - omega
        else:
            omega = 0
        
        # Argument of periapsis
        if n_mag > 0 and e > 0:
            w = np.arccos(np.dot(n, e_vec) / (n_mag * e))
            if e_vec[2] < 0:
                w = 2*np.pi - w
        else:
            w = 0
        
        # True anomaly
        if e > 0:
            nu = np.arccos(np.dot(e_vec, r) / (e * r_mag))
            if np.dot(r, v) < 0:
                nu = 2*np.pi - nu
        else:
            nu = 0
        
        return OrbitalElements(a, e, i, w, omega, nu)
    
    def elements_to_state(self, elements: OrbitalElements, epoch: float) -> OrbitalState:
        """Convert orbital elements to position and velocity"""
        a, e, i, w, omega, nu = (
            elements.semi_major_axis, elements.eccentricity, elements.inclination,
            elements.argument_of_periapsis, elements.longitude_of_ascending_node,
            elements.true_anomaly
        )
        
        # Calculate position and velocity in orbital plane
        if e < 1:  # Elliptical orbit
            r_mag = a * (1 - e**2) / (1 + e * np.cos(nu))
        else:  # Hyperbolic orbit
            r_mag = a * (e**2 - 1) / (1 + e * np.cos(nu))
        
        # Position in orbital plane
        r_orbital = np.array([r_mag * np.cos(nu), r_mag * np.sin(nu), 0])
        
        # Velocity in orbital plane
        if e < 1:
            v_orbital = np.sqrt(self.mu_earth / (a * (1 - e**2))) * np.array([
                -np.sin(nu), e + np.cos(nu), 0
            ])
        else:
            v_orbital = np.sqrt(self.mu_earth / (a * (e**2 - 1))) * np.array([
                -np.sin(nu), e + np.cos(nu), 0
            ])
        
        # Rotation matrices
        R3_w = self._rotation_matrix_z(w)
        R1_i = self._rotation_matrix_x(i)
        R3_omega = self._rotation_matrix_z(omega)
        
        # Transform to inertial frame
        R_total = R3_omega @ R1_i @ R3_w
        r_inertial = R_total @ r_orbital
        v_inertial = R_total @ v_orbital
        
        return OrbitalState(r_inertial, v_inertial, epoch)
    
    def propagate_orbit(self, state: OrbitalState, time: float) -> OrbitalState:
        """Propagate orbital state forward in time"""
        elements = self.state_to_elements(state)
        
        # Mean motion
        if elements.eccentricity < 1:
            n = np.sqrt(self.mu_earth / elements.semi_major_axis**3)
        else:
            n = np.sqrt(self.mu_earth / abs(elements.semi_major_axis)**3)
        
        # Mean anomaly
        if elements.eccentricity < 1:
            E = 2 * np.arctan(np.sqrt((1 - elements.eccentricity) / (1 + elements.eccentricity)) * 
                             np.tan(elements.true_anomaly / 2))
            M = E - elements.eccentricity * np.sin(E)
        else:
            H = 2 * np.arctanh(np.sqrt((elements.eccentricity - 1) / (elements.eccentricity + 1)) * 
                              np.tan(elements.true_anomaly / 2))
            M = elements.eccentricity * np.sinh(H) - H
        
        # Propagate mean anomaly
        M_new = M + n * time
        
        # Convert back to true anomaly
        if elements.eccentricity < 1:
            # Solve Kepler's equation iteratively
            E_new = M_new
            for _ in range(10):
                E_new = M_new + elements.eccentricity * np.sin(E_new)
            nu_new = 2 * np.arctan(np.sqrt((1 + elements.eccentricity) / (1 - elements.eccentricity)) * 
                                  np.tan(E_new / 2))
        else:
            # Solve hyperbolic Kepler's equation
            H_new = M_new / elements.eccentricity
            for _ in range(10):
                H_new = (M_new + elements.eccentricity * np.sinh(H_new)) / elements.eccentricity
            nu_new = 2 * np.arctan(np.sqrt((elements.eccentricity + 1) / (elements.eccentricity - 1)) * 
                                  np.tanh(H_new / 2))
        
        # Create new elements
        new_elements = OrbitalElements(
            elements.semi_major_axis, elements.eccentricity, elements.inclination,
            elements.argument_of_periapsis, elements.longitude_of_ascending_node,
            nu_new
        )
        
        return self.elements_to_state(new_elements, state.epoch + time)
    
    def calculate_orbital_period(self, elements: OrbitalElements) -> float:
        """Calculate orbital period in seconds"""
        if elements.eccentricity < 1:
            return 2 * np.pi * np.sqrt(elements.semi_major_axis**3 / self.mu_earth)
        else:
            return float('inf')  # Hyperbolic orbits don't have a period
    
    def calculate_orbital_energy(self, state: OrbitalState) -> float:
        """Calculate specific orbital energy (km²/s²)"""
        r_mag = np.linalg.norm(state.position)
        v_mag = np.linalg.norm(state.velocity)
        return v_mag**2 / 2 - self.mu_earth / r_mag
    
    def calculate_angular_momentum(self, state: OrbitalState) -> np.ndarray:
        """Calculate specific angular momentum vector (km²/s)"""
        return np.cross(state.position, state.velocity)
    
    def _rotation_matrix_x(self, angle: float) -> np.ndarray:
        """Rotation matrix around X-axis"""
        c, s = np.cos(angle), np.sin(angle)
        return np.array([[1, 0, 0], [0, c, -s], [0, s, c]])
    
    def _rotation_matrix_z(self, angle: float) -> np.ndarray:
        """Rotation matrix around Z-axis"""
        c, s = np.cos(angle), np.sin(angle)
        return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])
    
    def calculate_lambert_transfer(self, r1: np.ndarray, r2: np.ndarray, 
                                 time: float, prograde: bool = True) -> Tuple[np.ndarray, np.ndarray]:
        """
        Solve Lambert's problem for orbital transfer
        
        Args:
            r1: Initial position vector (km)
            r2: Final position vector (km)
            time: Transfer time (seconds)
            prograde: True for prograde transfer, False for retrograde
            
        Returns:
            Tuple of (initial_velocity, final_velocity) in km/s
        """
        r1_mag = np.linalg.norm(r1)
        r2_mag = np.linalg.norm(r2)
        
        # Cosine of transfer angle
        cos_theta = np.dot(r1, r2) / (r1_mag * r2_mag)
        theta = np.arccos(np.clip(cos_theta, -1, 1))
        
        if not prograde:
            theta = 2 * np.pi - theta
        
        # Chord length
        c = np.sqrt(r1_mag**2 + r2_mag**2 - 2 * r1_mag * r2_mag * cos_theta)
        
        # Semi-perimeter
        s = (r1_mag + r2_mag + c) / 2
        
        # Minimum energy ellipse
        a_min = s / 2
        alpha_min = 2 * np.arcsin(np.sqrt(s / (2 * a_min)))
        beta_min = 2 * np.arcsin(np.sqrt((s - c) / (2 * a_min)))
        
        # Time for minimum energy transfer
        t_min = np.sqrt(a_min**3 / self.mu_earth) * (alpha_min - beta_min - (np.sin(alpha_min) - np.sin(beta_min)))
        
        if time < t_min:
            raise ValueError(f"Transfer time {time} is less than minimum time {t_min}")
        
        # Solve for semi-major axis using Newton's method
        a = a_min
        for _ in range(10):
            alpha = 2 * np.arcsin(np.sqrt(s / (2 * a)))
            beta = 2 * np.arcsin(np.sqrt((s - c) / (2 * a)))
            
            if a > 0:  # Elliptical
                t_calc = np.sqrt(a**3 / self.mu_earth) * (alpha - beta - (np.sin(alpha) - np.sin(beta)))
                dt_da = 3 * t_calc / (2 * a)
            else:  # Hyperbolic
                alpha = 2 * np.arcsinh(np.sqrt(s / (2 * abs(a))))
                beta = 2 * np.arcsinh(np.sqrt((s - c) / (2 * abs(a))))
                t_calc = np.sqrt(abs(a)**3 / self.mu_earth) * (np.sinh(alpha) - np.sinh(beta) - (alpha - beta))
                dt_da = 3 * t_calc / (2 * a)
            
            a_new = a - (t_calc - time) / dt_da
            if abs(a_new - a) < 1e-6:
                break
            a = a_new
        
        # Calculate velocities
        if a > 0:  # Elliptical
            alpha = 2 * np.arcsin(np.sqrt(s / (2 * a)))
            beta = 2 * np.arcsin(np.sqrt((s - c) / (2 * a)))
        else:  # Hyperbolic
            alpha = 2 * np.arcsinh(np.sqrt(s / (2 * abs(a))))
            beta = 2 * np.arcsinh(np.sqrt((s - c) / (2 * abs(a))))
        
        # Velocity components
        A = np.sqrt(self.mu_earth / (4 * a)) * (np.cot(alpha/2) + np.cot(beta/2))
        B = np.sqrt(self.mu_earth / (4 * a)) * (np.cot(alpha/2) - np.cot(beta/2))
        
        # Unit vectors
        r1_unit = r1 / r1_mag
        r2_unit = r2 / r2_mag
        c_unit = (r2 - r1) / c
        
        # Velocities
        v1 = A * r1_unit + B * c_unit
        v2 = A * r2_unit - B * c_unit
        
        return v1, v2
    
    def calculate_hohmann_transfer(self, r1: float, r2: float) -> Dict[str, float]:
        """
        Calculate Hohmann transfer parameters
        
        Args:
            r1: Initial orbital radius (km)
            r2: Final orbital radius (km)
            
        Returns:
            Dictionary with transfer parameters
        """
        # Semi-major axis of transfer orbit
        a_transfer = (r1 + r2) / 2
        
        # Velocity changes
        v1_circular = np.sqrt(self.mu_earth / r1)
        v1_transfer = np.sqrt(self.mu_earth * (2/r1 - 1/a_transfer))
        delta_v1 = abs(v1_transfer - v1_circular)
        
        v2_transfer = np.sqrt(self.mu_earth * (2/r2 - 1/a_transfer))
        v2_circular = np.sqrt(self.mu_earth / r2)
        delta_v2 = abs(v2_circular - v2_transfer)
        
        # Total delta-v
        total_delta_v = delta_v1 + delta_v2
        
        # Transfer time
        transfer_time = np.pi * np.sqrt(a_transfer**3 / self.mu_earth)
        
        return {
            'delta_v1': delta_v1,
            'delta_v2': delta_v2,
            'total_delta_v': total_delta_v,
            'transfer_time': transfer_time,
            'transfer_semi_major_axis': a_transfer
        }
    
    def calculate_perturbations(self, state: OrbitalState, time: float) -> OrbitalState:
        """Calculate J2 perturbation effects"""
        elements = self.state_to_elements(state)
        
        # J2 perturbation effects
        if elements.eccentricity < 1:
            n = np.sqrt(self.mu_earth / elements.semi_major_axis**3)
            
            # Secular changes
            omega_dot = 3/2 * self.j2 * n * (self.earth_radius / elements.semi_major_axis)**2 * \
                       (5 * np.cos(elements.inclination)**2 - 1) / (1 - elements.eccentricity**2)**2
            
            omega_dot_rad = 3/2 * self.j2 * n * (self.earth_radius / elements.semi_major_axis)**2 * \
                           (5 * np.cos(elements.inclination)**2 - 1) / (1 - elements.eccentricity**2)**2
            
            # Update elements
            new_elements = OrbitalElements(
                elements.semi_major_axis,
                elements.eccentricity,
                elements.inclination,
                elements.argument_of_periapsis + omega_dot * time,
                elements.longitude_of_ascending_node + omega_dot_rad * time,
                elements.true_anomaly
            )
            
            return self.elements_to_state(new_elements, state.epoch + time)
        
        return state
