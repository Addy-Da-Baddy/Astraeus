"""
Fuel Optimization Module
========================

A comprehensive satellite fuel optimization system that provides:
- Orbital mechanics calculations
- Propulsion system modeling
- Trajectory optimization algorithms
- Fuel consumption analysis
- Real-time optimization capabilities
- Mission planning and analysis
"""

# Core optimization classes
from .fuel_optimizer import FuelOptimizer, MissionRequirements, OptimizationResult
from .trajectory_optimizer import TrajectoryOptimizer, OptimizedTrajectory, TrajectorySegment
from .fuel_models import PropulsionModel, PropulsionSystem, FuelConsumption
from .orbital_mechanics import OrbitalMechanics, OrbitalState, OrbitalElements

# Real-time optimization classes
from .realtime_optimizer import (
    RealTimeOptimizer, 
    RealTimeConstraints, 
    RealTimeMetrics,
    OptimizationStatus, 
    ConstraintViolation, 
    OptimizationEvent
)

# Public API
__all__ = [
    # Core classes
    'FuelOptimizer',
    'MissionRequirements', 
    'OptimizationResult',
    'TrajectoryOptimizer',
    'OptimizedTrajectory',
    'TrajectorySegment',
    'PropulsionModel',
    'PropulsionSystem',
    'FuelConsumption',
    'OrbitalMechanics',
    'OrbitalState',
    'OrbitalElements',
    
    # Real-time classes
    'RealTimeOptimizer',
    'RealTimeConstraints',
    'RealTimeMetrics', 
    'OptimizationStatus',
    'ConstraintViolation',
    'OptimizationEvent'
]
