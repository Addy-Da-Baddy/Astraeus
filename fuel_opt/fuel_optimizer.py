"""
Main Fuel Optimizer Class
=========================

Integrates all fuel optimization components to provide a unified interface for:
- Trajectory optimization
- Propulsion system selection
- Fuel consumption analysis
- Mission planning
- Performance analysis
"""

import numpy as np
from typing import Dict, List, Tuple, Optional, Union
from dataclasses import dataclass
from datetime import datetime, timedelta

from .orbital_mechanics import OrbitalMechanics, OrbitalState, OrbitalElements
from .fuel_models import PropulsionModel, PropulsionSystem, FuelConsumption
from .trajectory_optimizer import TrajectoryOptimizer, OptimizedTrajectory, TrajectorySegment

@dataclass
class MissionRequirements:
    """Mission requirements and constraints"""
    initial_altitude: float  # km
    target_altitude: float   # km
    max_mission_time: float  # seconds
    max_fuel_mass: float     # kg
    max_total_mass: float    # kg
    max_power: float         # W
    optimization_priority: str = "fuel"  # "fuel", "time", "mass", "balanced"
    
    def __post_init__(self):
        if self.optimization_priority not in ["fuel", "time", "mass", "balanced"]:
            raise ValueError("optimization_priority must be one of: fuel, time, mass, balanced")

@dataclass
class OptimizationResult:
    """Result of fuel optimization"""
    trajectory: OptimizedTrajectory
    propulsion_system: PropulsionSystem
    fuel_consumption: FuelConsumption
    mission_summary: Dict
    optimization_metrics: Dict
    timestamp: datetime

class FuelOptimizer:
    """Main class for fuel optimization"""
    
    def __init__(self):
        self.orbital_mechanics = OrbitalMechanics()
        self.propulsion_model = PropulsionModel()
        self.trajectory_optimizer = TrajectoryOptimizer()
        
        # Default optimization parameters
        self.default_constraints = {
            'max_impulses': 5,
            'max_burn_time': 3600,  # 1 hour
            'mass_weight': 1.0,
            'power_weight': 0.1,
            'time_weight': 0.01,
            'efficiency_bonus': 0.5
        }
    
    def optimize_mission(self, mission_requirements: MissionRequirements,
                        initial_elements: Optional[OrbitalElements] = None,
                        custom_constraints: Optional[Dict] = None) -> OptimizationResult:
        """
        Optimize a complete mission for fuel efficiency
        
        Args:
            mission_requirements: Mission requirements and constraints
            initial_elements: Initial orbital elements (optional)
            custom_constraints: Custom optimization constraints
            
        Returns:
            OptimizationResult object
        """
        # Merge constraints
        constraints = {**self.default_constraints, **(custom_constraints or {})}
        
        # Create initial orbital state
        if initial_elements is None:
            initial_elements = self._create_default_initial_elements(mission_requirements.initial_altitude)
        
        initial_state = self.orbital_mechanics.elements_to_state(initial_elements, 0.0)
        
        # Create target orbital state
        target_elements = self._create_target_elements(mission_requirements.target_altitude)
        target_state = self.orbital_mechanics.elements_to_state(target_elements, 0.0)
        
        # Find optimal propulsion system
        estimated_delta_v = self._estimate_required_delta_v(initial_state, target_state)
        optimal_propulsion, _ = self.propulsion_model.calculate_optimal_propulsion(
            estimated_delta_v, mission_requirements.max_total_mass, constraints
        )
        
        # Optimize trajectory based on priority
        if mission_requirements.optimization_priority == "fuel":
            trajectory = self._optimize_for_fuel_efficiency(
                initial_state, target_state, optimal_propulsion, constraints
            )
        elif mission_requirements.optimization_priority == "time":
            trajectory = self._optimize_for_time_efficiency(
                initial_state, target_state, optimal_propulsion, constraints
            )
        elif mission_requirements.optimization_priority == "mass":
            trajectory = self._optimize_for_mass_efficiency(
                initial_state, target_state, optimal_propulsion, constraints
            )
        else:  # balanced
            trajectory = self._optimize_balanced(
                initial_state, target_state, optimal_propulsion, constraints
            )
        
        # Calculate final fuel consumption
        final_consumption = self.propulsion_model.calculate_fuel_consumption(
            optimal_propulsion, trajectory.total_delta_v, mission_requirements.max_total_mass
        )
        
        # Create mission summary
        mission_summary = self._create_mission_summary(
            trajectory, optimal_propulsion, mission_requirements
        )
        
        # Calculate optimization metrics
        optimization_metrics = self._calculate_optimization_metrics(
            trajectory, optimal_propulsion, mission_requirements
        )
        
        return OptimizationResult(
            trajectory=trajectory,
            propulsion_system=optimal_propulsion,
            fuel_consumption=final_consumption,
            mission_summary=mission_summary,
            optimization_metrics=optimization_metrics,
            timestamp=datetime.now()
        )
    
    def optimize_constellation_deployment(self, constellation_config: Dict,
                                        mission_requirements: MissionRequirements) -> List[OptimizationResult]:
        """
        Optimize deployment of multiple satellites in a constellation
        
        Args:
            constellation_config: Configuration for constellation deployment
            mission_requirements: Mission requirements and constraints
            
        Returns:
            List of OptimizationResult objects for each satellite
        """
        results = []
        
        # Extract constellation parameters
        num_satellites = constellation_config.get('num_satellites', 1)
        deployment_altitude = constellation_config.get('deployment_altitude', 500.0)
        spacing_angle = constellation_config.get('spacing_angle', 360.0 / num_satellites)
        
        # Create initial and target states for each satellite
        for i in range(num_satellites):
            # Initial state (launch vehicle insertion)
            initial_elements = self._create_default_initial_elements(
                mission_requirements.initial_altitude
            )
            
            # Target state (constellation position)
            target_elements = self._create_target_elements(deployment_altitude)
            target_elements.longitude_of_ascending_node += np.radians(i * spacing_angle)
            
            # Optimize individual satellite mission
            result = self.optimize_mission(
                mission_requirements, initial_elements
            )
            results.append(result)
        
        return results
    
    def analyze_fuel_efficiency(self, optimization_result: OptimizationResult) -> Dict:
        """
        Analyze the fuel efficiency of an optimization result
        
        Args:
            optimization_result: Result to analyze
            
        Returns:
            Dictionary with efficiency analysis
        """
        trajectory = optimization_result.trajectory
        propulsion_system = optimization_result.propulsion_system
        
        # Calculate efficiency metrics
        delta_v_efficiency = trajectory.total_delta_v / self._calculate_theoretical_minimum_delta_v(
            trajectory.segments[0].start_state, trajectory.segments[-1].end_state
        )
        
        fuel_efficiency = optimization_result.fuel_consumption.fuel_mass / trajectory.total_delta_v
        
        # Calculate specific impulse efficiency
        theoretical_isp = propulsion_system.specific_impulse
        actual_isp = (trajectory.total_delta_v * 1000) / (9.80665 * np.log(
            optimization_result.mission_summary['initial_mass'] / 
            optimization_result.mission_summary['final_mass']
        ))
        
        isp_efficiency = actual_isp / theoretical_isp if theoretical_isp > 0 else 0
        
        return {
            'delta_v_efficiency': delta_v_efficiency,
            'fuel_efficiency': fuel_efficiency,
            'isp_efficiency': isp_efficiency,
            'overall_efficiency': (delta_v_efficiency + fuel_efficiency + isp_efficiency) / 3,
            'theoretical_minimum_delta_v': self._calculate_theoretical_minimum_delta_v(
                trajectory.segments[0].start_state, trajectory.segments[-1].end_state
            ),
            'actual_delta_v': trajectory.total_delta_v,
            'efficiency_loss': 1 - delta_v_efficiency
        }
    
    def compare_propulsion_systems(self, mission_requirements: MissionRequirements,
                                  initial_elements: Optional[OrbitalElements] = None) -> Dict:
        """
        Compare different propulsion systems for a given mission
        
        Args:
            mission_requirements: Mission requirements
            initial_elements: Initial orbital elements
            
        Returns:
            Dictionary comparing all propulsion systems
        """
        if initial_elements is None:
            initial_elements = self._create_default_initial_elements(mission_requirements.initial_altitude)
        
        initial_state = self.orbital_mechanics.elements_to_state(initial_elements, 0.0)
        target_elements = self._create_target_elements(mission_requirements.target_altitude)
        target_state = self.orbital_mechanics.elements_to_state(target_elements, 0.0)
        
        estimated_delta_v = self._estimate_required_delta_v(initial_state, target_state)
        
        comparison = {}
        
        for system_name, system in self.propulsion_model.propulsion_systems.items():
            try:
                # Calculate fuel consumption
                consumption = self.propulsion_model.calculate_fuel_consumption(
                    system, estimated_delta_v, mission_requirements.max_total_mass
                )
                
                # Calculate mission time (simplified)
                mission_time = self._estimate_mission_time(system, estimated_delta_v)
                
                comparison[system_name] = {
                    'propulsion_system': system,
                    'fuel_consumption': consumption.fuel_mass,
                    'energy_consumed': consumption.energy_consumed,
                    'burn_time': consumption.burn_time,
                    'estimated_mission_time': mission_time,
                    'total_mass': system.dry_mass + consumption.fuel_mass,
                    'power_requirement': system.power_consumption,
                    'efficiency_score': self._calculate_efficiency_score(system, consumption, mission_requirements)
                }
                
            except Exception as e:
                comparison[system_name] = {
                    'error': str(e),
                    'propulsion_system': system
                }
        
        return comparison
    
    def _optimize_for_fuel_efficiency(self, initial_state: OrbitalState,
                                    target_state: OrbitalState,
                                    propulsion_system: PropulsionSystem,
                                    constraints: Dict) -> OptimizedTrajectory:
        """Optimize trajectory for minimum fuel consumption"""
        # Use multi-impulse optimization with fuel priority
        constraints['fuel_priority'] = True
        return self.trajectory_optimizer.optimize_multi_impulse_trajectory(
            initial_state, target_state, propulsion_system,
            max_impulses=constraints.get('max_impulses', 5)
        )
    
    def _optimize_for_time_efficiency(self, initial_state: OrbitalState,
                                    target_state: OrbitalState,
                                    propulsion_system: PropulsionSystem,
                                    constraints: Dict) -> OptimizedTrajectory:
        """Optimize trajectory for minimum mission time"""
        # Use Hohmann transfer for time efficiency
        target_altitude = np.linalg.norm(target_state.position) - self.orbital_mechanics.earth_radius
        return self.trajectory_optimizer.optimize_hohmann_transfer(
            initial_state, target_altitude, propulsion_system
        )
    
    def _optimize_for_mass_efficiency(self, initial_state: OrbitalState,
                                    target_state: OrbitalState,
                                    propulsion_system: PropulsionSystem,
                                    constraints: Dict) -> OptimizedTrajectory:
        """Optimize trajectory for minimum total mass"""
        # Use continuous thrust optimization for mass efficiency
        max_time = 86400  # 24 hours default
        return self.trajectory_optimizer.optimize_continuous_thrust_trajectory(
            initial_state, target_state, propulsion_system, max_time
        )
    
    def _optimize_balanced(self, initial_state: OrbitalState,
                          target_state: OrbitalState,
                          propulsion_system: PropulsionSystem,
                          constraints: Dict) -> OptimizedTrajectory:
        """Optimize trajectory with balanced objectives"""
        # Try multiple optimization methods and select the best balanced result
        methods = [
            lambda: self.trajectory_optimizer.optimize_hohmann_transfer(
                initial_state, 
                np.linalg.norm(target_state.position) - self.orbital_mechanics.earth_radius,
                propulsion_system
            ),
            lambda: self.trajectory_optimizer.optimize_multi_impulse_trajectory(
                initial_state, target_state, propulsion_system, max_impulses=3
            ),
            lambda: self.trajectory_optimizer.optimize_continuous_thrust_trajectory(
                initial_state, target_state, propulsion_system, 86400
            )
        ]
        
        best_trajectory = None
        best_score = float('inf')
        
        for method in methods:
            try:
                trajectory = method()
                score = self._calculate_balanced_score(trajectory)
                
                if score < best_score:
                    best_score = score
                    best_trajectory = trajectory
                    
            except Exception:
                continue
        
        if best_trajectory is None:
            # Fallback to Hohmann transfer
            target_altitude = np.linalg.norm(target_state.position) - self.orbital_mechanics.earth_radius
            best_trajectory = self.trajectory_optimizer.optimize_hohmann_transfer(
                initial_state, target_altitude, propulsion_system
            )
        
        return best_trajectory
    
    def _calculate_balanced_score(self, trajectory: OptimizedTrajectory) -> float:
        """Calculate a balanced score for trajectory comparison"""
        # Normalize different metrics and combine them
        fuel_score = trajectory.total_fuel_consumption / 100.0  # Normalize to 100 kg
        time_score = trajectory.total_time / 86400.0  # Normalize to 24 hours
        complexity_score = len(trajectory.segments) / 10.0  # Normalize to 10 segments
        
        # Weighted combination
        return 0.4 * fuel_score + 0.3 * time_score + 0.3 * complexity_score
    
    def _create_default_initial_elements(self, altitude: float) -> OrbitalElements:
        """Create default initial orbital elements"""
        return OrbitalElements(
            semi_major_axis=6371.0 + altitude,  # km
            eccentricity=0.0,  # Circular orbit
            inclination=np.radians(45.0),  # 45 degrees
            argument_of_periapsis=0.0,
            longitude_of_ascending_node=0.0,
            true_anomaly=0.0
        )
    
    def _create_target_elements(self, altitude: float) -> OrbitalElements:
        """Create target orbital elements"""
        return OrbitalElements(
            semi_major_axis=6371.0 + altitude,  # km
            eccentricity=0.0,  # Circular orbit
            inclination=np.radians(45.0),  # 45 degrees
            argument_of_periapsis=0.0,
            longitude_of_ascending_node=0.0,
            true_anomaly=0.0
        )
    
    def _estimate_required_delta_v(self, initial_state: OrbitalState,
                                  target_state: OrbitalState) -> float:
        """Estimate required delta-v for trajectory planning"""
        # Simple estimation based on velocity difference
        velocity_diff = np.linalg.norm(target_state.velocity - initial_state.velocity)
        return velocity_diff / 1000.0  # Convert to km/s
    
    def _estimate_mission_time(self, propulsion_system: PropulsionSystem,
                              delta_v: float) -> float:
        """Estimate mission time based on propulsion system and delta-v"""
        # Simplified estimation
        if propulsion_system.propulsion_type.value in ['ion', 'hall_effect']:
            # Electric propulsion: longer burn times
            return delta_v * 3600  # 1 hour per km/s
        else:
            # Chemical propulsion: shorter burn times
            return delta_v * 600  # 10 minutes per km/s
    
    def _calculate_efficiency_score(self, propulsion_system: PropulsionSystem,
                                  consumption: FuelConsumption,
                                  requirements: MissionRequirements) -> float:
        """Calculate efficiency score for propulsion system comparison"""
        # Normalize different metrics
        fuel_score = 1.0 - (consumption.fuel_mass / requirements.max_fuel_mass)
        mass_score = 1.0 - ((propulsion_system.dry_mass + consumption.fuel_mass) / requirements.max_total_mass)
        power_score = 1.0 - (propulsion_system.power_consumption / requirements.max_power) if requirements.max_power > 0 else 1.0
        
        # Weighted average
        return 0.4 * fuel_score + 0.4 * mass_score + 0.2 * power_score
    
    def _create_mission_summary(self, trajectory: OptimizedTrajectory,
                               propulsion_system: PropulsionSystem,
                               requirements: MissionRequirements) -> Dict:
        """Create mission summary"""
        return {
            'initial_mass': requirements.max_total_mass,
            'final_mass': requirements.max_total_mass - trajectory.total_fuel_consumption,
            'fuel_mass_used': trajectory.total_fuel_consumption,
            'mission_duration': trajectory.total_time,
            'total_delta_v': trajectory.total_delta_v,
            'num_maneuvers': len(trajectory.segments),
            'propulsion_system': propulsion_system.name,
            'optimization_method': trajectory.optimization_method
        }
    
    def _calculate_optimization_metrics(self, trajectory: OptimizedTrajectory,
                                      propulsion_system: PropulsionSystem,
                                      requirements: MissionRequirements) -> Dict:
        """Calculate optimization performance metrics"""
        return {
            'fuel_efficiency': trajectory.total_fuel_consumption / trajectory.total_delta_v,
            'time_efficiency': trajectory.total_time / trajectory.total_delta_v,
            'mass_efficiency': (requirements.max_total_mass - trajectory.total_fuel_consumption) / requirements.max_total_mass,
            'propulsion_efficiency': propulsion_system.efficiency,
            'trajectory_complexity': len(trajectory.segments),
            'convergence_status': trajectory.convergence_info.get('converged', False),
            'optimization_iterations': trajectory.convergence_info.get('iterations', 0)
        }
    
    def _calculate_theoretical_minimum_delta_v(self, initial_state: OrbitalState,
                                             target_state: OrbitalState) -> float:
        """Calculate theoretical minimum delta-v (Hohmann transfer)"""
        r1 = np.linalg.norm(initial_state.position)
        r2 = np.linalg.norm(target_state.position)
        
        # Hohmann transfer delta-v
        v1_circular = np.sqrt(398600.4418 / r1)
        v1_transfer = np.sqrt(398600.4418 * (2/r1 - 2/(r1 + r2)))
        delta_v1 = abs(v1_transfer - v1_circular)
        
        v2_transfer = np.sqrt(398600.4418 * (2/r2 - 2/(r1 + r2)))
        v2_circular = np.sqrt(398600.4418 / r2)
        delta_v2 = abs(v2_circular - v2_transfer)
        
        return (delta_v1 + delta_v2) / 1000.0  # Convert to km/s
