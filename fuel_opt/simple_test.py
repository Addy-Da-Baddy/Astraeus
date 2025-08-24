#!/usr/bin/env python3
"""
Simple import test for real-time module
"""

print("Starting import test...")

try:
    print("1. Testing basic imports...")
    from fuel_opt.orbital_mechanics import OrbitalElements
    print("   ✅ OrbitalElements imported")
    
    from fuel_opt.fuel_models import PropulsionSystem
    print("   ✅ PropulsionSystem imported")
    
    from fuel_opt.fuel_optimizer import MissionRequirements
    print("   ✅ MissionRequirements imported")
    
    print("2. Testing real-time imports...")
    from fuel_opt.realtime_optimizer import RealTimeConstraints
    print("   ✅ RealTimeConstraints imported")
    
    from fuel_opt.realtime_optimizer import OptimizationStatus
    print("   ✅ OptimizationStatus imported")
    
    print("3. Testing optimizer creation...")
    constraints = RealTimeConstraints()
    print("   ✅ RealTimeConstraints created")
    
    mission_req = MissionRequirements(
        initial_altitude=500.0,
        target_altitude=800.0,
        max_mission_time=86400.0,
        max_fuel_mass=100.0,
        max_total_mass=1000.0,
        max_power=1000.0
    )
    print("   ✅ MissionRequirements created")
    
    print("4. All tests passed! 🎉")
    
except Exception as e:
    print(f"❌ Test failed: {e}")
    import traceback
    traceback.print_exc()
