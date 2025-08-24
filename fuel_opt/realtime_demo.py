"""
Real-Time Fuel Optimization Demo
================================

Demonstrates real-time optimization capabilities:
- Live monitoring of satellite parameters
- Real-time constraint violation detection
- Continuous optimization with live updates
- Performance tracking and alerting
"""

import sys
import time
import threading
from datetime import datetime, timedelta

# Add parent directory to path for imports
sys.path.append('..')

from fuel_opt.realtime_optimizer import (
    RealTimeOptimizer, RealTimeConstraints, OptimizationStatus, ConstraintViolation
)
from fuel_opt.fuel_optimizer import MissionRequirements
from fuel_opt.orbital_mechanics import OrbitalState, OrbitalElements
from fuel_opt.fuel_models import PropulsionSystem, PropulsionType

def alert_callback(event):
    """Callback function for optimization alerts"""
    severity_colors = {
        "low": "\033[94m",      # Blue
        "medium": "\033[93m",   # Yellow
        "high": "\033[91m",     # Red
        "critical": "\033[95m"  # Magenta
    }
    
    color = severity_colors.get(event.severity, "\033[0m")
    reset = "\033[0m"
    
    print(f"{color}[{event.severity.upper()}] {event.description}{reset}")
    if event.data:
        for key, value in event.data.items():
            print(f"    {key}: {value}")

def print_status_header():
    """Print status display header"""
    print("\n" + "="*80)
    print("🚀 REAL-TIME FUEL OPTIMIZATION DASHBOARD")
    print("="*80)
    print(f"{'Time':<20} {'Status':<12} {'Fuel':<8} {'Power':<8} {'Altitude':<10} {'Temp':<8} {'Score':<8}")
    print("-"*80)

def print_status_line(metrics, timestamp):
    """Print a single status line"""
    status_symbols = {
        OptimizationStatus.IDLE: "⏸️",
        OptimizationStatus.RUNNING: "🔄",
        OptimizationStatus.CONVERGED: "✅",
        OptimizationStatus.FAILED: "❌",
        OptimizationStatus.CONSTRAINED: "⚠️",
        OptimizationStatus.EMERGENCY: "🚨"
    }
    
    symbol = status_symbols.get(metrics.optimization_status, "❓")
    
    print(f"{timestamp.strftime('%H:%M:%S'):<20} "
          f"{symbol} {metrics.optimization_status.value:<8} "
          f"{metrics.current_fuel_mass:<8.1f} "
          f"{metrics.current_power_level:<8.2f} "
          f"{metrics.orbital_altitude:<10.1f} "
          f"{metrics.temperature:<8.1f} "
          f"{metrics.performance_score:<8.2f}")

def print_constraint_violations(metrics):
    """Print constraint violations if any"""
    if metrics.constraint_violations:
        print("\n⚠️  CONSTRAINT VIOLATIONS:")
        for violation in metrics.constraint_violations:
            if violation == ConstraintViolation.FUEL_LOW:
                print(f"    🔴 FUEL LOW: {metrics.current_fuel_mass:.1f} kg")
            elif violation == ConstraintViolation.POWER_LOW:
                print(f"    🔴 POWER LOW: {metrics.current_power_level:.2f}")
            elif violation == ConstraintViolation.ORBITAL_DECAY:
                print(f"    🔴 ORBITAL DECAY: {metrics.orbital_altitude:.1f} km")
            elif violation == ConstraintViolation.COLLISION_RISK:
                print(f"    🔴 COLLISION RISK: {metrics.collision_risk:.2e}")
            elif violation == ConstraintViolation.THERMAL_LIMIT:
                print(f"    🔴 THERMAL LIMIT: {metrics.temperature:.1f}°C")

def print_performance_summary(optimizer):
    """Print performance summary"""
    stats = optimizer.get_performance_statistics()
    if stats:
        print("\n📊 PERFORMANCE SUMMARY:")
        print(f"    Total Optimizations: {stats['total_optimizations']}")
        print(f"    Success Rate: {stats['success_rate']:.1%}")
        print(f"    Avg Optimization Time: {stats['average_optimization_time']:.3f}s")
        print(f"    Constraint Violation Rate: {stats['constraint_violation_rate']:.1%}")
        print(f"    Current Performance Score: {stats['current_performance_score']:.2f}")

def demo_basic_real_time_optimization():
    """Demo basic real-time optimization"""
    print("🎯 Starting Basic Real-Time Optimization Demo")
    print("="*50)
    
    # Create mission requirements
    mission_req = MissionRequirements(
        initial_altitude=500.0,      # km
        target_altitude=800.0,       # km
        max_mission_time=86400.0,    # 24 hours
        max_fuel_mass=100.0,         # kg
        max_total_mass=1000.0,       # kg
        max_power=1000.0,            # W
        optimization_priority="fuel"
    )
    
    # Create real-time constraints
    constraints = RealTimeConstraints(
        min_fuel_mass=15.0,          # kg
        min_power_level=0.3,         # 30%
        max_orbital_decay_rate=0.2,  # km/day
        max_collision_probability=1e-5,
        max_temperature=333.15,      # 60°C
        optimization_interval=30.0,   # 30 seconds
        constraint_check_interval=5.0 # 5 seconds
    )
    
    # Create real-time optimizer
    optimizer = RealTimeOptimizer(mission_req, constraints)
    
    # Add alert callback
    optimizer.add_alert_callback(alert_callback)
    
    # Create initial orbital state
    initial_elements = OrbitalElements(
        semi_major_axis=6371.0 + 500.0,  # 500 km altitude
        eccentricity=0.0,                 # Circular orbit
        inclination=0.785398,             # 45 degrees
        argument_of_periapsis=0.0,
        longitude_of_ascending_node=0.0,
        true_anomaly=0.0
    )
    
    # Create propulsion system
    propulsion_system = PropulsionSystem(
        name="Demo Electric Thruster",
        propulsion_type=PropulsionType.ION,
        specific_impulse=3000.0,
        thrust=0.1,                    # N
        power_consumption=500.0,       # W
        dry_mass=50.0,                 # kg
        fuel_mass=20.0,                # kg
        efficiency=0.8
    )
    
    # Start real-time optimization
    print("🚀 Starting real-time optimization...")
    optimizer.start_real_time_optimization(initial_elements, propulsion_system)
    
    # Monitor for a few minutes
    start_time = time.time()
    duration = 180  # 3 minutes
    
    print_status_header()
    
    try:
        while time.time() - start_time < duration:
            if optimizer.current_metrics:
                print_status_line(optimizer.current_metrics, datetime.now())
                print_constraint_violations(optimizer.current_metrics)
                
                # Print optimization history if available
                history = optimizer.get_optimization_history(limit=1)
                if history:
                    latest = history[-1]
                    print(f"    🔄 Last optimization: {latest['execution_time']:.3f}s, "
                          f"Constraints violated: {latest['constraints_violated']}")
                
                print("-" * 80)
            
            time.sleep(10)  # Update every 10 seconds
            
    except KeyboardInterrupt:
        print("\n⏹️  Demo interrupted by user")
    
    # Stop optimization
    optimizer.stop_real_time_optimization()
    
    # Print final summary
    print_performance_summary(optimizer)
    
    print("\n✅ Basic Real-Time Optimization Demo Completed!")

def demo_adaptive_optimization():
    """Demo adaptive optimization with changing conditions"""
    print("\n🎯 Starting Adaptive Optimization Demo")
    print("="*50)
    
    # Create mission requirements
    mission_req = MissionRequirements(
        initial_altitude=400.0,      # km
        target_altitude=600.0,       # km
        max_mission_time=43200.0,    # 12 hours
        max_fuel_mass=80.0,          # kg
        max_total_mass=800.0,        # kg
        max_power=800.0,             # W
        optimization_priority="balanced"
    )
    
    # Create tight constraints to trigger violations
    constraints = RealTimeConstraints(
        min_fuel_mass=20.0,          # kg
        min_power_level=0.4,         # 40%
        max_orbital_decay_rate=0.1,  # km/day
        max_collision_probability=1e-6,
        max_temperature=313.15,      # 40°C
        optimization_interval=20.0,   # 20 seconds
        constraint_check_interval=3.0 # 3 seconds
    )
    
    # Create real-time optimizer
    optimizer = RealTimeOptimizer(mission_req, constraints)
    optimizer.add_alert_callback(alert_callback)
    
    # Create initial orbital state
    initial_elements = OrbitalElements(
        semi_major_axis=6371.0 + 400.0,
        eccentricity=0.0,
        inclination=0.785398,
        argument_of_periapsis=0.0,
        longitude_of_ascending_node=0.0,
        true_anomaly=0.0
    )
    
    # Create propulsion system
    propulsion_system = PropulsionSystem(
        name="Demo Chemical Thruster",
        propulsion_type=PropulsionType.CHEMICAL,
        specific_impulse=300.0,
        thrust=100.0,                 # N
        power_consumption=100.0,      # W
        dry_mass=30.0,                # kg
        fuel_mass=15.0,               # kg
        efficiency=0.9
    )
    
    # Start real-time optimization
    print("🚀 Starting adaptive optimization...")
    optimizer.start_real_time_optimization(initial_elements, propulsion_system)
    
    # Monitor for 2 minutes
    start_time = time.time()
    duration = 120  # 2 minutes
    
    print_status_header()
    
    try:
        while time.time() - start_time < duration:
            if optimizer.current_metrics:
                print_status_line(optimizer.current_metrics, datetime.now())
                print_constraint_violations(optimizer.current_metrics)
                
                # Show adaptive behavior
                if optimizer.current_metrics.constraint_violations:
                    print("    🔄 Adaptive optimization triggered due to constraint violations")
                
                print("-" * 80)
            
            time.sleep(8)  # Update every 8 seconds
            
    except KeyboardInterrupt:
        print("\n⏹️  Demo interrupted by user")
    
    # Stop optimization
    optimizer.stop_real_time_optimization()
    
    # Print final summary
    print_performance_summary(optimizer)
    
    print("\n✅ Adaptive Optimization Demo Completed!")

def demo_constraint_monitoring():
    """Demo constraint monitoring and alerting"""
    print("\n🎯 Starting Constraint Monitoring Demo")
    print("="*50)
    
    # Create mission requirements
    mission_req = MissionRequirements(
        initial_altitude=300.0,      # km
        target_altitude=500.0,       # km
        max_mission_time=21600.0,    # 6 hours
        max_fuel_mass=60.0,          # kg
        max_total_mass=600.0,        # kg
        max_power=600.0,             # W
        optimization_priority="fuel"
    )
    
    # Create very tight constraints to force violations
    constraints = RealTimeConstraints(
        min_fuel_mass=25.0,          # kg
        min_power_level=0.5,         # 50%
        max_orbital_decay_rate=0.05, # km/day
        max_collision_probability=1e-7,
        max_temperature=303.15,      # 30°C
        optimization_interval=15.0,   # 15 seconds
        constraint_check_interval=2.0 # 2 seconds
    )
    
    # Create real-time optimizer
    optimizer = RealTimeOptimizer(mission_req, constraints)
    optimizer.add_alert_callback(alert_callback)
    
    # Create initial orbital state
    initial_elements = OrbitalElements(
        semi_major_axis=6371.0 + 300.0,
        eccentricity=0.0,
        inclination=0.785398,
        argument_of_periapsis=0.0,
        longitude_of_ascending_node=0.0,
        true_anomaly=0.0
    )
    
    # Create propulsion system
    propulsion_system = PropulsionSystem(
        name="Demo Hall Effect Thruster",
        propulsion_type=PropulsionType.HALL_EFFECT,
        specific_impulse=1500.0,
        thrust=0.05,                  # N
        power_consumption=300.0,      # W
        dry_mass=40.0,                # kg
        fuel_mass=12.0,               # kg
        efficiency=0.75
    )
    
    # Start real-time optimization
    print("🚀 Starting constraint monitoring...")
    optimizer.start_real_time_optimization(initial_elements, propulsion_system)
    
    # Monitor for 1.5 minutes
    start_time = time.time()
    duration = 90  # 1.5 minutes
    
    print_status_header()
    
    try:
        while time.time() - start_time < duration:
            if optimizer.current_metrics:
                print_status_line(optimizer.current_metrics, datetime.now())
                print_constraint_violations(optimizer.current_metrics)
                
                # Show constraint monitoring
                violations = optimizer.current_metrics.constraint_violations
                if violations:
                    print(f"    📊 Monitoring {len(violations)} constraint violations")
                    for violation in violations:
                        print(f"        - {violation.value}")
                
                print("-" * 80)
            
            time.sleep(6)  # Update every 6 seconds
            
    except KeyboardInterrupt:
        print("\n⏹️  Demo interrupted by user")
    
    # Stop optimization
    optimizer.stop_real_time_optimization()
    
    # Print final summary
    print_performance_summary(optimizer)
    
    print("\n✅ Constraint Monitoring Demo Completed!")

def main():
    """Run all real-time optimization demos"""
    print("🚀 REAL-TIME FUEL OPTIMIZATION DEMONSTRATION")
    print("="*60)
    print("This demo showcases the real-time optimization capabilities:")
    print("• Continuous monitoring of satellite parameters")
    print("• Real-time constraint violation detection")
    print("• Adaptive optimization based on changing conditions")
    print("• Performance tracking and alerting")
    print("• Multi-threaded optimization and monitoring")
    print("="*60)
    
    try:
        # Run basic demo
        demo_basic_real_time_optimization()
        
        # Run adaptive demo
        demo_adaptive_optimization()
        
        # Run constraint monitoring demo
        demo_constraint_monitoring()
        
        print("\n🎉 All Real-Time Optimization Demos Completed Successfully!")
        print("\nKey Features Demonstrated:")
        print("✅ Real-time parameter monitoring")
        print("✅ Constraint violation detection")
        print("✅ Adaptive optimization strategies")
        print("✅ Multi-threaded execution")
        print("✅ Event-driven alerting")
        print("✅ Performance tracking")
        print("✅ Graceful shutdown")
        
    except Exception as e:
        print(f"\n❌ Demo failed with error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
