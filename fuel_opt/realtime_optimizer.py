"""
Real-Time Fuel Optimization Module
=================================

Provides real-time optimization capabilities for satellite fuel management:
- Continuous trajectory monitoring and optimization
- Real-time constraint violation detection
- Adaptive optimization based on changing conditions
- Live performance metrics and alerts
- Predictive maintenance scheduling
"""

import numpy as np
import threading
import time
import queue
from typing import Dict, List, Tuple, Optional, Callable, Any, Union
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
import logging

from .orbital_mechanics import OrbitalMechanics, OrbitalState, OrbitalElements
from .fuel_models import PropulsionModel, PropulsionSystem, FuelConsumption
from .trajectory_optimizer import TrajectoryOptimizer, OptimizedTrajectory, TrajectorySegment
from .fuel_optimizer import FuelOptimizer, MissionRequirements, OptimizationResult

class OptimizationStatus(Enum):
    """Status of real-time optimization"""
    IDLE = "idle"
    RUNNING = "running"
    CONVERGED = "converged"
    FAILED = "failed"
    CONSTRAINED = "constrained"
    EMERGENCY = "emergency"

class ConstraintViolation(Enum):
    """Types of constraint violations"""
    FUEL_LOW = "fuel_low"
    POWER_LOW = "power_low"
    ORBITAL_DECAY = "orbital_decay"
    COLLISION_RISK = "collision_risk"
    THERMAL_LIMIT = "thermal_limit"
    COMMUNICATION_LOSS = "communication_loss"

@dataclass
class RealTimeConstraints:
    """Real-time optimization constraints"""
    min_fuel_mass: float = 10.0  # kg
    min_power_level: float = 0.2  # 20% of max power
    max_orbital_decay_rate: float = 0.1  # km/day
    max_collision_probability: float = 1e-6
    max_temperature: float = 323.15  # 50°C
    min_communication_quality: float = 0.8  # 80%
    
    # Update intervals
    optimization_interval: float = 60.0  # seconds
    constraint_check_interval: float = 10.0  # seconds
    alert_threshold: float = 0.8  # Alert when 80% of constraint limit reached

@dataclass
class RealTimeMetrics:
    """Real-time performance metrics"""
    current_fuel_mass: float
    current_power_level: float
    orbital_altitude: float
    collision_risk: float
    temperature: float
    communication_quality: float
    optimization_status: OptimizationStatus
    last_optimization_time: datetime
    constraint_violations: List[ConstraintViolation] = field(default_factory=list)
    performance_score: float = 0.0
    timestamp: datetime = field(default_factory=datetime.now)

@dataclass
class OptimizationEvent:
    """Event that triggers optimization"""
    event_type: str
    severity: str  # "low", "medium", "high", "critical"
    description: str
    timestamp: datetime
    data: Dict[str, Any] = field(default_factory=dict)

class RealTimeOptimizer:
    """Real-time fuel optimization engine"""
    
    def __init__(self, mission_requirements: MissionRequirements,
                 initial_constraints: Optional[RealTimeConstraints] = None):
        """
        Initialize real-time optimizer
        
        Args:
            mission_requirements: Mission requirements and constraints
            initial_constraints: Initial real-time constraints
        """
        self.mission_requirements = mission_requirements
        self.constraints = initial_constraints or RealTimeConstraints()
        
        # Core components
        self.fuel_optimizer = FuelOptimizer()
        self.orbital_mechanics = OrbitalMechanics()
        self.propulsion_model = PropulsionModel()
        
        # Real-time state
        self.current_metrics = None
        self.optimization_history = []
        self.event_queue = queue.Queue()
        self.alert_callbacks = []
        
        # Threading and control
        self.optimization_thread = None
        self.monitoring_thread = None
        self.running = False
        self.paused = False
        
        # Performance tracking
        self.optimization_times = []
        self.convergence_history = []
        self.constraint_violation_history = []
        
        # Setup logging
        logging.basicConfig(level=logging.INFO)
        self.logger = logging.getLogger(__name__)
        
    def start_real_time_optimization(self, initial_state: Union[OrbitalState, OrbitalElements],
                                   propulsion_system: PropulsionSystem):
        """
        Start real-time optimization
        
        Args:
            initial_state: Initial orbital state or elements
            propulsion_system: Propulsion system to use
        """
        if self.running:
            self.logger.warning("Real-time optimization already running")
            return
            
        self.running = True
        self.paused = False
        
        # Convert orbital elements to state if needed
        if isinstance(initial_state, OrbitalElements):
            initial_state = self.orbital_mechanics.elements_to_state(initial_state, 0.0)
        
        # Initialize current metrics
        self.current_metrics = RealTimeMetrics(
            current_fuel_mass=self.mission_requirements.max_fuel_mass,
            current_power_level=1.0,
            orbital_altitude=np.linalg.norm(initial_state.position) - 6371.0,
            collision_risk=0.0,
            temperature=293.15,  # 20°C
            communication_quality=1.0,
            optimization_status=OptimizationStatus.IDLE,
            last_optimization_time=datetime.now()
        )
        
        # Start monitoring and optimization threads
        self.monitoring_thread = threading.Thread(target=self._monitoring_loop, daemon=True)
        self.optimization_thread = threading.Thread(target=self._optimization_loop, daemon=True)
        
        self.monitoring_thread.start()
        self.optimization_thread.start()
        
        self.logger.info("Real-time optimization started")
        
    def stop_real_time_optimization(self):
        """Stop real-time optimization"""
        self.running = False
        self.paused = False
        
        if self.optimization_thread and self.optimization_thread.is_alive():
            self.optimization_thread.join(timeout=5.0)
        if self.monitoring_thread and self.monitoring_thread.is_alive():
            self.monitoring_thread.join(timeout=5.0)
            
        self.logger.info("Real-time optimization stopped")
        
    def pause_optimization(self):
        """Pause optimization temporarily"""
        self.paused = True
        self.logger.info("Optimization paused")
        
    def resume_optimization(self):
        """Resume optimization"""
        self.paused = False
        self.logger.info("Optimization resumed")
        
    def add_alert_callback(self, callback: Callable[[OptimizationEvent], None]):
        """Add callback for optimization alerts"""
        self.alert_callbacks.append(callback)
        
    def get_current_status(self) -> Dict[str, Any]:
        """Get current optimization status"""
        if not self.current_metrics:
            return {"status": "not_initialized"}
            
        return {
            "status": self.current_metrics.optimization_status.value,
            "fuel_mass": self.current_metrics.current_fuel_mass,
            "power_level": self.current_metrics.current_power_level,
            "orbital_altitude": self.current_metrics.orbital_altitude,
            "collision_risk": self.current_metrics.collision_risk,
            "temperature": self.current_metrics.temperature,
            "communication_quality": self.current_metrics.communication_quality,
            "performance_score": self.current_metrics.performance_score,
            "last_optimization": self.current_metrics.last_optimization_time.isoformat(),
            "constraint_violations": [v.value for v in self.current_metrics.constraint_violations],
            "optimization_history_count": len(self.optimization_history)
        }
        
    def _monitoring_loop(self):
        """Main monitoring loop"""
        while self.running:
            try:
                if not self.paused:
                    self._update_current_metrics()
                    self._check_constraints()
                    self._process_events()
                    
                time.sleep(self.constraints.constraint_check_interval)
                
            except Exception as e:
                self.logger.error(f"Error in monitoring loop: {e}")
                time.sleep(1.0)
                
    def _optimization_loop(self):
        """Main optimization loop"""
        while self.running:
            try:
                if not self.paused and self._should_optimize():
                    self._run_optimization()
                    
                time.sleep(self.constraints.optimization_interval)
                
            except Exception as e:
                self.logger.error(f"Error in optimization loop: {e}")
                time.sleep(1.0)
                
    def _update_current_metrics(self):
        """Update current metrics based on simulation or real data"""
        if not self.current_metrics:
            return
            
        # Simulate orbital decay
        decay_rate = np.random.normal(0.05, 0.02)  # km/day
        self.current_metrics.orbital_altitude -= decay_rate / 86400.0  # Convert to per-second
        
        # Simulate fuel consumption
        fuel_consumption_rate = np.random.normal(0.001, 0.0005)  # kg/day
        self.current_metrics.current_fuel_mass -= fuel_consumption_rate / 86400.0
        
        # Simulate power variations
        power_variation = np.random.normal(0.0, 0.02)
        self.current_metrics.current_power_level = max(0.0, min(1.0, 
            self.current_metrics.current_power_level + power_variation))
        
        # Simulate temperature changes
        temp_variation = np.random.normal(0.0, 2.0)
        self.current_metrics.temperature = max(200.0, min(350.0,
            self.current_metrics.temperature + temp_variation))
        
        # Simulate collision risk
        self.current_metrics.collision_risk = np.random.exponential(1e-7)
        
        # Update timestamp
        self.current_metrics.timestamp = datetime.now()
        
    def _check_constraints(self):
        """Check for constraint violations"""
        if not self.current_metrics:
            return
            
        violations = []
        
        # Check fuel constraint
        if self.current_metrics.current_fuel_mass < self.constraints.min_fuel_mass:
            violations.append(ConstraintViolation.FUEL_LOW)
            
        # Check power constraint
        if self.current_metrics.current_power_level < self.constraints.min_power_level:
            violations.append(ConstraintViolation.POWER_LOW)
            
        # Check orbital decay
        if self.current_metrics.orbital_altitude < 100.0:  # Below 100 km
            violations.append(ConstraintViolation.ORBITAL_DECAY)
            
        # Check collision risk
        if self.current_metrics.collision_risk > self.constraints.max_collision_probability:
            violations.append(ConstraintViolation.COLLISION_RISK)
            
        # Check temperature
        if self.current_metrics.temperature > self.constraints.max_temperature:
            violations.append(ConstraintViolation.THERMAL_LIMIT)
            
        # Update violations
        self.current_metrics.constraint_violations = violations
        
        # Create events for violations
        for violation in violations:
            event = OptimizationEvent(
                event_type="constraint_violation",
                severity="high" if violation in [ConstraintViolation.FUEL_LOW, ConstraintViolation.COLLISION_RISK] else "medium",
                description=f"Constraint violation: {violation.value}",
                timestamp=datetime.now(),
                data={"violation_type": violation.value, "current_value": self._get_violation_value(violation)}
            )
            self.event_queue.put(event)
            
    def _get_violation_value(self, violation: ConstraintViolation) -> float:
        """Get current value for a constraint violation"""
        if violation == ConstraintViolation.FUEL_LOW:
            return self.current_metrics.current_fuel_mass
        elif violation == ConstraintViolation.POWER_LOW:
            return self.current_metrics.current_power_level
        elif violation == ConstraintViolation.ORBITAL_DECAY:
            return self.current_metrics.orbital_altitude
        elif violation == ConstraintViolation.COLLISION_RISK:
            return self.current_metrics.collision_risk
        elif violation == ConstraintViolation.THERMAL_LIMIT:
            return self.current_metrics.temperature
        else:
            return 0.0
            
    def _should_optimize(self) -> bool:
        """Determine if optimization should run"""
        if not self.current_metrics:
            return False
            
        # Always optimize if there are constraint violations
        if self.current_metrics.constraint_violations:
            return True
            
        # Optimize periodically
        time_since_last = (datetime.now() - self.current_metrics.last_optimization_time).total_seconds()
        return time_since_last >= self.constraints.optimization_interval
        
    def _run_optimization(self):
        """Run a single optimization cycle"""
        if not self.current_metrics:
            return
            
        start_time = time.time()
        self.current_metrics.optimization_status = OptimizationStatus.RUNNING
        
        try:
            # Create current orbital state
            current_elements = OrbitalElements(
                semi_major_axis=6371.0 + self.current_metrics.orbital_altitude,
                eccentricity=0.0,
                inclination=np.radians(45.0),
                argument_of_periapsis=0.0,
                longitude_of_ascending_node=0.0,
                true_anomaly=0.0
            )
            
            # Update mission requirements based on current state
            updated_requirements = MissionRequirements(
                initial_altitude=self.current_metrics.orbital_altitude,
                target_altitude=self.mission_requirements.target_altitude,
                max_mission_time=self.mission_requirements.max_mission_time,
                max_fuel_mass=self.current_metrics.current_fuel_mass,
                max_total_mass=self.mission_requirements.max_total_mass,
                max_power=self.mission_requirements.max_power,
                optimization_priority="fuel" if self.current_metrics.constraint_violations else "balanced"
            )
            
            # Run optimization
            result = self.fuel_optimizer.optimize_mission(
                updated_requirements, current_elements
            )
            
            # Update metrics
            self.current_metrics.optimization_status = OptimizationStatus.CONVERGED
            self.current_metrics.last_optimization_time = datetime.now()
            self.current_metrics.performance_score = self._calculate_performance_score(result)
            
            # Store optimization result
            self.optimization_history.append({
                'timestamp': datetime.now(),
                'result': result,
                'execution_time': time.time() - start_time,
                'constraints_violated': len(self.current_metrics.constraint_violations)
            })
            
            # Track performance
            self.optimization_times.append(time.time() - start_time)
            self.convergence_history.append(True)
            
            self.logger.info(f"Optimization completed in {time.time() - start_time:.3f}s")
            
        except Exception as e:
            self.current_metrics.optimization_status = OptimizationStatus.FAILED
            self.logger.error(f"Optimization failed: {e}")
            self.convergence_history.append(False)
            
    def _calculate_performance_score(self, result: OptimizationResult) -> float:
        """Calculate performance score for optimization result"""
        if not result:
            return 0.0
            
        # Base score from fuel efficiency
        fuel_score = 1.0 - (result.fuel_consumption.fuel_mass / self.mission_requirements.max_fuel_mass)
        
        # Time efficiency score
        time_score = 1.0 - (result.trajectory.total_time / self.mission_requirements.max_mission_time)
        
        # Constraint satisfaction score
        constraint_score = 1.0 - (len(self.current_metrics.constraint_violations) / 6.0)
        
        # Weighted average
        return 0.5 * fuel_score + 0.3 * time_score + 0.2 * constraint_score
        
    def _process_events(self):
        """Process events in the event queue"""
        while not self.event_queue.empty():
            try:
                event = self.event_queue.get_nowait()
                self._handle_event(event)
            except queue.Empty:
                break
                
    def _handle_event(self, event: OptimizationEvent):
        """Handle optimization events"""
        # Log event
        self.logger.info(f"Event: {event.event_type} - {event.description}")
        
        # Store in history
        self.constraint_violation_history.append({
            'timestamp': event.timestamp,
            'event_type': event.event_type,
            'severity': event.severity,
            'description': event.description
        })
        
        # Trigger alert callbacks
        for callback in self.alert_callbacks:
            try:
                callback(event)
            except Exception as e:
                self.logger.error(f"Error in alert callback: {e}")
                
    def get_optimization_history(self, limit: int = 100) -> List[Dict]:
        """Get recent optimization history"""
        return self.optimization_history[-limit:] if self.optimization_history else []
        
    def get_constraint_violation_history(self, limit: int = 100) -> List[Dict]:
        """Get recent constraint violation history"""
        return self.constraint_violation_history[-limit:] if self.constraint_violation_history else []
        
    def get_performance_statistics(self) -> Dict[str, Any]:
        """Get performance statistics"""
        if not self.optimization_times:
            return {}
            
        return {
            'total_optimizations': len(self.optimization_times),
            'average_optimization_time': np.mean(self.optimization_times),
            'success_rate': np.mean(self.convergence_history),
            'constraint_violation_rate': len(self.constraint_violation_history) / max(1, len(self.optimization_times)),
            'current_performance_score': self.current_metrics.performance_score if self.current_metrics else 0.0
        }
