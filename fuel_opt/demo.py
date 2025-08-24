#!/usr/bin/env python3
"""
Fuel Optimization Demo Script
=============================

Demonstrates the capabilities of the NovaGen fuel optimization system
"""

import numpy as np
from datetime import datetime
import sys
import os

# Add the parent directory to the path so we can import the fuel_opt module
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fuel_opt import FuelOptimizer, MissionRequirements
from fuel_opt.orbital_mechanics import OrbitalElements
from fuel_opt.fuel_models import PropulsionModel

def demo_basic_optimization():
    """Demonstrate basic mission optimization"""
    print("🚀 Basic Mission Optimization Demo")
    print("=" * 50)
    
    # Create mission requirements
    requirements = MissionRequirements(
        initial_altitude=200.0,      # km (LEO)
        target_altitude=800.0,       # km (higher LEO)
        max_mission_time=86400,      # 24 hours
        max_fuel_mass=50.0,          # kg
        max_total_mass=1000.0,       # kg
        max_power=5000.0,            # W
        optimization_priority="fuel"  # Optimize for fuel efficiency
    )
    
    # Create optimizer
    optimizer = FuelOptimizer()
    
    # Optimize mission
    print("🔍 Optimizing mission for fuel efficiency...")
    result = optimizer.optimize_mission(requirements)
    
    # Display results
    print(f"✅ Optimization completed!")
    print(f"   Propulsion System: {result.propulsion_system.name}")
    print(f"   Total Delta-V: {result.trajectory.total_delta_v:.3f} km/s")
    print(f"   Fuel Consumption: {result.fuel_consumption.fuel_mass:.2f} kg")
    print(f"   Mission Duration: {result.trajectory.total_time/3600:.1f} hours")
    print(f"   Optimization Method: {result.trajectory.optimization_method}")
    print(f"   Number of Maneuvers: {len(result.trajectory.segments)}")
    
    return result

def demo_propulsion_comparison():
    """Demonstrate propulsion system comparison"""
    print("\n🔧 Propulsion System Comparison Demo")
    print("=" * 50)
    
    # Create mission requirements
    requirements = MissionRequirements(
        initial_altitude=300.0,
        target_altitude=600.0,
        max_mission_time=86400,
        max_fuel_mass=100.0,
        max_total_mass=1500.0,
        max_power=10000.0,
        optimization_priority="balanced"
    )
    
    # Create optimizer
    optimizer = FuelOptimizer()
    
    # Compare propulsion systems
    print("🔍 Comparing propulsion systems...")
    comparison = optimizer.compare_propulsion_systems(requirements)
    
    # Display comparison
    print("📊 Propulsion System Comparison:")
    print(f"{'System':<25} {'Fuel (kg)':<10} {'Power (W)':<10} {'Efficiency':<10}")
    print("-" * 65)
    
    for system_name, data in comparison.items():
        if 'error' not in data:
            print(f"{system_name:<25} {data['fuel_consumption']:<10.2f} "
                  f"{data['power_requirement']:<10.0f} {data['efficiency_score']:<10.3f}")
        else:
            print(f"{system_name:<25} {'ERROR':<10} {'N/A':<10} {'N/A':<10}")
    
    return comparison

def demo_constellation_deployment():
    """Demonstrate constellation deployment optimization"""
    print("\n🌟 Constellation Deployment Demo")
    print("=" * 50)
    
    # Constellation configuration
    constellation_config = {
        'num_satellites': 6,
        'deployment_altitude': 550.0,  # km
        'spacing_angle': 60.0          # degrees
    }
    
    # Mission requirements
    requirements = MissionRequirements(
        initial_altitude=200.0,
        target_altitude=550.0,
        max_mission_time=172800,  # 48 hours
        max_fuel_mass=80.0,
        max_total_mass=1200.0,
        max_power=8000.0,
        optimization_priority="balanced"
    )
    
    # Create optimizer
    optimizer = FuelOptimizer()
    
    # Optimize constellation deployment
    print("🔍 Optimizing constellation deployment...")
    results = optimizer.optimize_constellation_deployment(constellation_config, requirements)
    
    # Display results
    print(f"✅ Constellation optimization completed!")
    print(f"   Number of satellites: {len(results)}")
    
    total_fuel = sum(r.fuel_consumption.fuel_mass for r in results)
    total_delta_v = sum(r.trajectory.total_delta_v for r in results)
    avg_mission_time = np.mean([r.trajectory.total_time for r in results])
    
    print(f"   Total fuel consumption: {total_fuel:.2f} kg")
    print(f"   Total delta-V: {total_delta_v:.3f} km/s")
    print(f"   Average mission time: {avg_mission_time/3600:.1f} hours")
    
    # Show individual satellite results
    print("\n📡 Individual Satellite Results:")
    for i, result in enumerate(results):
        print(f"   Satellite {i+1}: {result.fuel_consumption.fuel_mass:.2f} kg fuel, "
              f"{result.trajectory.total_delta_v:.3f} km/s delta-V")
    
    return results

def demo_fuel_efficiency_analysis():
    """Demonstrate fuel efficiency analysis"""
    print("\n📈 Fuel Efficiency Analysis Demo")
    print("=" * 50)
    
    # Create a mission and analyze it
    requirements = MissionRequirements(
        initial_altitude=250.0,
        target_altitude=750.0,
        max_mission_time=86400,
        max_fuel_mass=60.0,
        max_total_mass=1100.0,
        max_power=6000.0,
        optimization_priority="fuel"
    )
    
    optimizer = FuelOptimizer()
    
    # Optimize mission
    print("🔍 Optimizing mission for analysis...")
    result = optimizer.optimize_mission(requirements)
    
    # Analyze fuel efficiency
    print("📊 Analyzing fuel efficiency...")
    efficiency_analysis = optimizer.analyze_fuel_efficiency(result)
    
    # Display analysis
    print("📈 Fuel Efficiency Analysis:")
    print(f"   Delta-V Efficiency: {efficiency_analysis['delta_v_efficiency']:.3f}")
    print(f"   Fuel Efficiency: {efficiency_analysis['fuel_efficiency']:.3f}")
    print(f"   ISP Efficiency: {efficiency_analysis['isp_efficiency']:.3f}")
    print(f"   Overall Efficiency: {efficiency_analysis['overall_efficiency']:.3f}")
    print(f"   Theoretical Min Delta-V: {efficiency_analysis['theoretical_minimum_delta_v']:.3f} km/s")
    print(f"   Actual Delta-V: {efficiency_analysis['actual_delta_v']:.3f} km/s")
    print(f"   Efficiency Loss: {efficiency_analysis['efficiency_loss']:.1%}")
    
    return efficiency_analysis

def demo_custom_orbital_elements():
    """Demonstrate optimization with custom orbital elements"""
    print("\n🎯 Custom Orbital Elements Demo")
    print("=" * 50)
    
    # Create custom initial orbital elements
    initial_elements = OrbitalElements(
        semi_major_axis=7000.0,           # km (628 km altitude)
        eccentricity=0.1,                 # Slightly elliptical
        inclination=np.radians(60.0),     # 60 degrees inclination
        argument_of_periapsis=np.radians(45.0),
        longitude_of_ascending_node=np.radians(30.0),
        true_anomaly=np.radians(90.0)
    )
    
    # Create custom target orbital elements
    target_elements = OrbitalElements(
        semi_major_axis=8000.0,           # km (1628 km altitude)
        eccentricity=0.05,                # Nearly circular
        inclination=np.radians(55.0),     # Different inclination
        argument_of_periapsis=np.radians(60.0),
        longitude_of_ascending_node=np.radians(45.0),
        true_anomaly=np.radians(180.0)
    )
    
    # Mission requirements
    requirements = MissionRequirements(
        initial_altitude=628.0,
        target_altitude=1628.0,
        max_mission_time=172800,  # 48 hours
        max_fuel_mass=100.0,
        max_total_mass=1500.0,
        max_power=10000.0,
        optimization_priority="balanced"
    )
    
    # Create optimizer
    optimizer = FuelOptimizer()
    
    # Optimize with custom elements
    print("🔍 Optimizing mission with custom orbital elements...")
    result = optimizer.optimize_mission(requirements, initial_elements)
    
    # Display results
    print(f"✅ Custom optimization completed!")
    print(f"   Initial Eccentricity: {initial_elements.eccentricity:.3f}")
    print(f"   Initial Inclination: {np.degrees(initial_elements.inclination):.1f}°")
    print(f"   Target Eccentricity: {target_elements.eccentricity:.3f}")
    print(f"   Target Inclination: {np.degrees(target_elements.inclination):.1f}°")
    print(f"   Total Delta-V: {result.trajectory.total_delta_v:.3f} km/s")
    print(f"   Fuel Consumption: {result.fuel_consumption.fuel_mass:.2f} kg")
    print(f"   Optimization Method: {result.trajectory.optimization_method}")
    
    return result

def main():
    """Run all demos"""
    print("🚀 NovaGen Fuel Optimization System Demo")
    print("=" * 60)
    print(f"📅 Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()
    
    try:
        # Run all demos
        basic_result = demo_basic_optimization()
        propulsion_comparison = demo_propulsion_comparison()
        constellation_results = demo_constellation_deployment()
        efficiency_analysis = demo_fuel_efficiency_analysis()
        custom_result = demo_custom_orbital_elements()
        
        print("\n" + "=" * 60)
        print("🎉 All demos completed successfully!")
        print("📊 Summary:")
        print(f"   Basic Mission: {basic_result.fuel_consumption.fuel_mass:.2f} kg fuel")
        print(f"   Constellation: {len(constellation_results)} satellites optimized")
        print(f"   Custom Mission: {custom_result.fuel_consumption.fuel_mass:.2f} kg fuel")
        print(f"   Best Propulsion: {max(propulsion_comparison.items(), key=lambda x: x[1].get('efficiency_score', 0) if 'error' not in x[1] else 0)[0]}")
        
    except Exception as e:
        print(f"\n❌ Demo failed with error: {str(e)}")
        import traceback
        traceback.print_exc()
        return 1
    
    return 0

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)
