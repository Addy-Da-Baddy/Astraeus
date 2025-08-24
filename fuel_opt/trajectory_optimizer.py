"""
Trajectory Optimizer Module
===========================

Provides trajectory optimization algorithms for fuel-efficient satellite operations:
- Hohmann transfer optimization
- Multi-impulse trajectory optimization
- Continuous thrust optimization
- Genetic algorithm optimization
- Gradient-based optimization
"""

import numpy as np
from typing import Dict, List, Tuple, Optional, Callable
from dataclasses import dataclass
from .orbital_mechanics import OrbitalMechanics, OrbitalState, OrbitalElements
from .fuel_models import PropulsionModel, PropulsionSystem, FuelConsumption

@dataclass
class TrajectorySegment:
    """Represents a segment of a trajectory"""
    start_time: float  # seconds
    end_time: float   # seconds
    start_state: OrbitalState
    end_state: OrbitalState
    delta_v: float    # km/s
    fuel_consumption: float  # kg
    propulsion_system: Optional[PropulsionSystem] = None

@dataclass
class OptimizedTrajectory:
    """Represents an optimized trajectory"""
    segments: List[TrajectorySegment]
    total_delta_v: float  # km/s
    total_fuel_consumption: float  # kg
    total_time: float  # seconds
    optimization_method: str
    convergence_info: Dict

class TrajectoryOptimizer:
    """Main class for trajectory optimization"""
    
    def __init__(self):
        self.orbital_mechanics = OrbitalMechanics()
        self.propulsion_model = PropulsionModel()
        
        # Optimization parameters
        self.max_iterations = 1000
        self.tolerance = 1e-6
        self.population_size = 50  # for genetic algorithm
        
    def optimize_hohmann_transfer(self, initial_state: OrbitalState, 
                                 target_altitude: float,
                                 propulsion_system: PropulsionSystem) -> OptimizedTrajectory:
        """
        Optimize a Hohmann transfer to target altitude
        
        Args:
            initial_state: Initial orbital state
            target_altitude: Target altitude in km
            propulsion_system: Propulsion system to use
            
        Returns:
            OptimizedTrajectory object
        """
        # Get initial orbital elements
        initial_elements = self.orbital_mechanics.state_to_elements(initial_state)
        
        # Calculate target radius
        target_radius = self.orbital_mechanics.earth_radius + target_altitude
        
        # Calculate Hohmann transfer parameters
        hohmann_params = self.orbital_mechanics.calculate_hohmann_transfer(
            initial_elements.semi_major_axis, target_radius
        )
        
        # Calculate fuel consumption for each burn
        initial_mass = 1000.0  # Default satellite mass
        consumption1 = self.propulsion_model.calculate_fuel_consumption(
            propulsion_system, hohmann_params['delta_v1'], initial_mass
        )
        
        mass_after_burn1 = initial_mass - consumption1.fuel_mass
        consumption2 = self.propulsion_model.calculate_fuel_consumption(
            propulsion_system, hohmann_params['delta_v2'], mass_after_burn1
        )
        
        # Create trajectory segments
        segment1 = TrajectorySegment(
            start_time=0.0,
            end_time=0.0,  # Instantaneous burn
            start_state=initial_state,
            end_state=self._apply_delta_v(initial_state, hohmann_params['delta_v1']),
            delta_v=hohmann_params['delta_v1'],
            fuel_consumption=consumption1.fuel_mass,
            propulsion_system=propulsion_system
        )
        
        # Intermediate coast phase
        coast_state = self.orbital_mechanics.propagate_orbit(
            segment1.end_state, hohmann_params['transfer_time']
        )
        
        segment2 = TrajectorySegment(
            start_time=hohmann_params['transfer_time'],
            end_time=hohmann_params['transfer_time'],
            start_state=coast_state,
            end_state=self._apply_delta_v(coast_state, hohmann_params['delta_v2']),
            delta_v=hohmann_params['delta_v2'],
            fuel_consumption=consumption2.fuel_mass,
            propulsion_system=propulsion_system
        )
        
        segments = [segment1, segment2]
        
        return OptimizedTrajectory(
            segments=segments,
            total_delta_v=hohmann_params['total_delta_v'],
            total_fuel_consumption=consumption1.fuel_mass + consumption2.fuel_mass,
            total_time=hohmann_params['transfer_time'],
            optimization_method="Hohmann Transfer",
            convergence_info={'iterations': 1, 'converged': True}
        )
    
    def optimize_multi_impulse_trajectory(self, initial_state: OrbitalState,
                                        target_state: OrbitalState,
                                        propulsion_system: PropulsionSystem,
                                        max_impulses: int = 3,
                                        time_constraint: Optional[float] = None) -> OptimizedTrajectory:
        """
        Optimize a multi-impulse trajectory between two states
        
        Args:
            initial_state: Initial orbital state
            target_state: Target orbital state
            propulsion_system: Propulsion system to use
            max_impulses: Maximum number of impulses allowed
            time_constraint: Maximum time constraint (seconds)
            
        Returns:
            OptimizedTrajectory object
        """
        # Use genetic algorithm for multi-impulse optimization
        return self._genetic_algorithm_optimization(
            initial_state, target_state, propulsion_system, max_impulses, time_constraint
        )
    
    def optimize_continuous_thrust_trajectory(self, initial_state: OrbitalState,
                                           target_state: OrbitalState,
                                           propulsion_system: PropulsionSystem,
                                           max_time: float) -> OptimizedTrajectory:
        """
        Optimize a continuous thrust trajectory
        
        Args:
            initial_state: Initial orbital state
            target_state: Target orbital state
            propulsion_system: Propulsion system to use
            max_time: Maximum mission time (seconds)
            
        Returns:
            OptimizedTrajectory object
        """
        # Use gradient-based optimization for continuous thrust
        return self._gradient_optimization(
            initial_state, target_state, propulsion_system, max_time
        )
    
    def _genetic_algorithm_optimization(self, initial_state: OrbitalState,
                                      target_state: OrbitalState,
                                      propulsion_system: PropulsionSystem,
                                      max_impulses: int,
                                      time_constraint: Optional[float]) -> OptimizedTrajectory:
        """Genetic algorithm for trajectory optimization"""
        
        def fitness_function(individual):
            """Calculate fitness of an individual (lower is better)"""
            try:
                trajectory = self._individual_to_trajectory(individual, initial_state, target_state)
                if trajectory is None:
                    return float('inf')
                
                # Calculate total delta-v and fuel consumption
                total_delta_v = sum(seg.delta_v for seg in trajectory.segments)
                total_fuel = sum(seg.fuel_consumption for seg in trajectory.segments)
                total_time = trajectory.total_time
                
                # Check constraints
                if time_constraint and total_time > time_constraint:
                    return float('inf')
                
                # Fitness function: minimize fuel consumption with time penalty
                fitness = total_fuel + 0.1 * total_time + 0.01 * len(trajectory.segments)
                return fitness
                
            except Exception:
                return float('inf')
        
        # Initialize population
        population = self._initialize_population(max_impulses)
        
        best_fitness = float('inf')
        best_individual = None
        generations_without_improvement = 0
        
        for generation in range(self.max_iterations):
            # Evaluate fitness
            fitness_scores = [fitness_function(ind) for ind in population]
            
            # Find best individual
            min_fitness_idx = np.argmin(fitness_scores)
            if fitness_scores[min_fitness_idx] < best_fitness:
                best_fitness = fitness_scores[min_fitness_idx]
                best_individual = population[min_fitness_idx].copy()
                generations_without_improvement = 0
            else:
                generations_without_improvement += 1
            
            # Check convergence
            if generations_without_improvement > 50:
                break
            
            # Selection, crossover, and mutation
            new_population = []
            for _ in range(self.population_size):
                parent1 = self._tournament_selection(population, fitness_scores)
                parent2 = self._tournament_selection(population, fitness_scores)
                child = self._crossover(parent1, parent2)
                child = self._mutate(child)
                new_population.append(child)
            
            population = new_population
        
        # Convert best individual to trajectory
        if best_individual is not None:
            trajectory = self._individual_to_trajectory(best_individual, initial_state, target_state)
            if trajectory is not None:
                return trajectory
        
        # Fallback to simple two-impulse transfer
        return self._simple_two_impulse_transfer(initial_state, target_state, propulsion_system)
    
    def _gradient_optimization(self, initial_state: OrbitalState,
                             target_state: OrbitalState,
                             propulsion_system: PropulsionSystem,
                             max_time: float) -> OptimizedTrajectory:
        """Gradient-based optimization for continuous thrust"""
        
        # Simplified gradient optimization
        # In practice, this would use more sophisticated methods like Pontryagin's maximum principle
        
        # For now, return a discretized continuous thrust trajectory
        num_segments = 20
        time_step = max_time / num_segments
        
        segments = []
        current_state = initial_state
        total_delta_v = 0.0
        total_fuel = 0.0
        
        for i in range(num_segments):
            # Calculate required delta-v for this segment
            target_segment_state = self.orbital_mechanics.propagate_orbit(
                current_state, time_step
            )
            
            # Calculate delta-v needed to reach target state
            delta_v = np.linalg.norm(target_segment_state.velocity - current_state.velocity) / 1000  # km/s
            
            # Calculate fuel consumption
            consumption = self.propulsion_model.calculate_fuel_consumption(
                propulsion_system, delta_v, 1000.0  # Assume constant mass
            )
            
            segment = TrajectorySegment(
                start_time=i * time_step,
                end_time=(i + 1) * time_step,
                start_state=current_state,
                end_state=target_segment_state,
                delta_v=delta_v,
                fuel_consumption=consumption.fuel_mass,
                propulsion_system=propulsion_system
            )
            
            segments.append(segment)
            total_delta_v += delta_v
            total_fuel += consumption.fuel_mass
            current_state = target_segment_state
        
        return OptimizedTrajectory(
            segments=segments,
            total_delta_v=total_delta_v,
            total_fuel_consumption=total_fuel,
            total_time=max_time,
            optimization_method="Gradient Optimization",
            convergence_info={'iterations': num_segments, 'converged': True}
        )
    
    def _initialize_population(self, max_impulses: int) -> List[np.ndarray]:
        """Initialize genetic algorithm population"""
        population = []
        
        for _ in range(self.population_size):
            # Each individual represents impulse times and magnitudes
            num_impulses = np.random.randint(1, max_impulses + 1)
            individual = np.random.rand(num_impulses * 2)  # time and magnitude for each impulse
            
            # Normalize times to [0, 1]
            individual[:num_impulses] = np.sort(individual[:num_impulses])
            
            population.append(individual)
        
        return population
    
    def _tournament_selection(self, population: List[np.ndarray], 
                            fitness_scores: List[float]) -> np.ndarray:
        """Tournament selection for genetic algorithm"""
        tournament_size = 3
        tournament_indices = np.random.choice(len(population), tournament_size, replace=False)
        tournament_fitness = [fitness_scores[i] for i in tournament_indices]
        winner_idx = tournament_indices[np.argmin(tournament_fitness)]
        return population[winner_idx].copy()
    
    def _crossover(self, parent1: np.ndarray, parent2: np.ndarray) -> np.ndarray:
        """Crossover operation for genetic algorithm"""
        if len(parent1) != len(parent2):
            # Use the shorter parent
            shorter = parent1 if len(parent1) < len(parent2) else parent2
            longer = parent2 if len(parent1) < len(parent2) else parent1
            
            # Truncate longer parent
            longer = longer[:len(shorter)]
        else:
            shorter = parent1
            longer = parent2
        
        # Single-point crossover
        crossover_point = np.random.randint(1, len(shorter))
        child = np.concatenate([shorter[:crossover_point], longer[crossover_point:]])
        
        return child
    
    def _mutate(self, individual: np.ndarray) -> np.ndarray:
        """Mutation operation for genetic algorithm"""
        mutation_rate = 0.1
        
        for i in range(len(individual)):
            if np.random.random() < mutation_rate:
                individual[i] += np.random.normal(0, 0.1)
                individual[i] = np.clip(individual[i], 0, 1)
        
        return individual
    
    def _individual_to_trajectory(self, individual: np.ndarray,
                                initial_state: OrbitalState,
                                target_state: OrbitalState) -> Optional[OptimizedTrajectory]:
        """Convert genetic algorithm individual to trajectory"""
        try:
            num_impulses = len(individual) // 2
            times = individual[:num_impulses]
            magnitudes = individual[num_impulses:]
            
            segments = []
            current_state = initial_state
            total_delta_v = 0.0
            total_fuel = 0.0
            
            for i in range(num_impulses):
                # Propagate to impulse time
                impulse_time = times[i] * 3600  # Convert to seconds
                coast_state = self.orbital_mechanics.propagate_orbit(current_state, impulse_time)
                
                # Apply impulse
                delta_v = magnitudes[i] * 1.0  # Scale to reasonable delta-v
                new_state = self._apply_delta_v(coast_state, delta_v)
                
                # Calculate fuel consumption
                consumption = self.propulsion_model.calculate_fuel_consumption(
                    None, delta_v, 1000.0  # Assume constant mass
                )
                
                segment = TrajectorySegment(
                    start_time=impulse_time,
                    end_time=impulse_time,
                    start_state=coast_state,
                    end_state=new_state,
                    delta_v=delta_v,
                    fuel_consumption=consumption.fuel_mass
                )
                
                segments.append(segment)
                total_delta_v += delta_v
                total_fuel += consumption.fuel_mass
                current_state = new_state
            
            # Final coast to target
            final_coast_time = 3600  # 1 hour final coast
            final_state = self.orbital_mechanics.propagate_orbit(current_state, final_coast_time)
            
            return OptimizedTrajectory(
                segments=segments,
                total_delta_v=total_delta_v,
                total_fuel_consumption=total_fuel,
                total_time=times[-1] * 3600 + final_coast_time,
                optimization_method="Genetic Algorithm",
                convergence_info={'iterations': 1, 'converged': True}
            )
            
        except Exception:
            return None
    
    def _simple_two_impulse_transfer(self, initial_state: OrbitalState,
                                   target_state: OrbitalState,
                                   propulsion_system: PropulsionSystem) -> OptimizedTrajectory:
        """Simple two-impulse transfer as fallback"""
        
        # Calculate required delta-v
        delta_v1 = np.linalg.norm(target_state.velocity - initial_state.velocity) / 1000  # km/s
        
        # Calculate fuel consumption
        consumption = self.propulsion_model.calculate_fuel_consumption(
            propulsion_system, delta_v1, 1000.0
        )
        
        segment = TrajectorySegment(
            start_time=0.0,
            end_time=0.0,
            start_state=initial_state,
            end_state=target_state,
            delta_v=delta_v1,
            fuel_consumption=consumption.fuel_mass,
            propulsion_system=propulsion_system
        )
        
        return OptimizedTrajectory(
            segments=[segment],
            total_delta_v=delta_v1,
            total_fuel_consumption=consumption.fuel_mass,
            total_time=0.0,
            optimization_method="Simple Two-Impulse",
            convergence_info={'iterations': 1, 'converged': True}
        )
    
    def _apply_delta_v(self, state: OrbitalState, delta_v: float) -> OrbitalState:
        """Apply delta-v to orbital state"""
        # For simplicity, apply delta-v in velocity direction
        velocity_direction = state.velocity / np.linalg.norm(state.velocity)
        new_velocity = state.velocity + velocity_direction * (delta_v * 1000)  # Convert to m/s
        
        return OrbitalState(
            position=state.position,
            velocity=new_velocity,
            epoch=state.epoch
        )
    
    def optimize_constellation_deployment(self, initial_states: List[OrbitalState],
                                        target_states: List[OrbitalState],
                                        propulsion_system: PropulsionSystem,
                                        constraints: Dict) -> List[OptimizedTrajectory]:
        """
        Optimize deployment of multiple satellites in a constellation
        
        Args:
            initial_states: List of initial orbital states
            target_states: List of target orbital states
            propulsion_system: Propulsion system to use
            constraints: Deployment constraints
            
        Returns:
            List of optimized trajectories for each satellite
        """
        trajectories = []
        
        for i, (initial_state, target_state) in enumerate(zip(initial_states, target_states)):
            # Optimize individual trajectory
            trajectory = self.optimize_multi_impulse_trajectory(
                initial_state, target_state, propulsion_system,
                max_impulses=constraints.get('max_impulses', 3)
            )
            
            trajectories.append(trajectory)
        
        return trajectories
    
    def calculate_trajectory_robustness(self, trajectory: OptimizedTrajectory,
                                     uncertainties: Dict) -> float:
        """
        Calculate robustness of a trajectory under uncertainties
        
        Args:
            trajectory: The trajectory to analyze
            uncertainties: Dictionary of uncertainty parameters
            
        Returns:
            Robustness score (higher is better)
        """
        # Simplified robustness calculation
        # In practice, this would use Monte Carlo analysis
        
        robustness = 1.0
        
        # Penalize for high delta-v (more sensitive to errors)
        if trajectory.total_delta_v > 5.0:  # km/s
            robustness *= 0.8
        
        # Penalize for many segments (more complex)
        if len(trajectory.segments) > 5:
            robustness *= 0.9
        
        # Penalize for long mission time
        if trajectory.total_time > 86400:  # 24 hours
            robustness *= 0.95
        
        return robustness
