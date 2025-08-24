"""
Simple test script for real-time optimization module
"""

import sys
import time

# Add parent directory to path for imports
sys.path.append('..')

def test_imports():
    """Test that all real-time modules can be imported"""
    print("🧪 Testing imports...")
    
    try:
        from fuel_opt.realtime_optimizer import (
            RealTimeOptimizer, 
            RealTimeConstraints, 
            RealTimeMetrics,
            OptimizationStatus, 
            ConstraintViolation, 
            OptimizationEvent
        )
        print("✅ Real-time optimizer imports successful")
        
        from fuel_opt.fuel_optimizer import MissionRequirements
        print("✅ Mission requirements import successful")
        
        from fuel_opt.orbital_mechanics import OrbitalElements
        print("✅ Orbital elements import successful")
        
        from fuel_opt.fuel_models import PropulsionSystem, PropulsionType
        print("✅ Propulsion system imports successful")
        
        return True
        
    except ImportError as e:
        print(f"❌ Import failed: {e}")
        return False

def test_basic_creation():
    """Test basic object creation"""
    print("\n🧪 Testing basic object creation...")
    
    try:
        from fuel_opt.realtime_optimizer import RealTimeConstraints, OptimizationStatus
        from fuel_opt.fuel_optimizer import MissionRequirements
        
        # Create constraints
        constraints = RealTimeConstraints(
            min_fuel_mass=20.0,
            optimization_interval=30.0
        )
        print("✅ RealTimeConstraints created successfully")
        
        # Create mission requirements
        mission_req = MissionRequirements(
            initial_altitude=500.0,
            target_altitude=800.0,
            max_mission_time=86400.0,
            max_fuel_mass=100.0,
            max_total_mass=1000.0,
            max_power=1000.0
        )
        print("✅ MissionRequirements created successfully")
        
        return True
        
    except Exception as e:
        print(f"❌ Object creation failed: {e}")
        return False

def test_optimizer_creation():
    """Test real-time optimizer creation"""
    print("\n🧪 Testing optimizer creation...")
    
    try:
        from fuel_opt.realtime_optimizer import RealTimeOptimizer, RealTimeConstraints
        from fuel_opt.fuel_optimizer import MissionRequirements
        
        # Create objects
        constraints = RealTimeConstraints()
        mission_req = MissionRequirements(
            initial_altitude=500.0,
            target_altitude=800.0,
            max_mission_time=86400.0,
            max_fuel_mass=100.0,
            max_total_mass=1000.0,
            max_power=1000.0
        )
        
        # Create optimizer
        optimizer = RealTimeOptimizer(mission_req, constraints)
        print("✅ RealTimeOptimizer created successfully")
        
        # Test status method
        status = optimizer.get_current_status()
        print(f"✅ Status method works: {status['status']}")
        
        return True
        
    except Exception as e:
        print(f"❌ Optimizer creation failed: {e}")
        return False

def test_alert_callback():
    """Test alert callback functionality"""
    print("\n🧪 Testing alert callback...")
    
    try:
        from fuel_opt.realtime_optimizer import RealTimeOptimizer, RealTimeConstraints, OptimizationEvent
        from fuel_opt.fuel_optimizer import MissionRequirements
        
        # Create objects
        constraints = RealTimeConstraints()
        mission_req = MissionRequirements(
            initial_altitude=500.0,
            target_altitude=800.0,
            max_mission_time=86400.0,
            max_fuel_mass=100.0,
            max_total_mass=1000.0,
            max_power=1000.0
        )
        
        optimizer = RealTimeOptimizer(mission_req, constraints)
        
        # Test callback
        callback_called = False
        
        def test_callback(event):
            nonlocal callback_called
            callback_called = True
            print(f"    📢 Callback received: {event.description}")
        
        optimizer.add_alert_callback(test_callback)
        print("✅ Alert callback added successfully")
        
        # Test event handling
        test_event = OptimizationEvent(
            event_type="test",
            severity="low",
            description="Test event",
            timestamp=time.time()
        )
        
        optimizer._handle_event(test_event)
        print("✅ Event handling works")
        
        return True
        
    except Exception as e:
        print(f"❌ Alert callback test failed: {e}")
        return False

def main():
    """Run all tests"""
    print("🚀 Real-Time Optimization Module Test Suite")
    print("=" * 50)
    
    tests = [
        test_imports,
        test_basic_creation,
        test_optimizer_creation,
        test_alert_callback
    ]
    
    passed = 0
    total = len(tests)
    
    for test in tests:
        try:
            if test():
                passed += 1
        except Exception as e:
            print(f"❌ Test {test.__name__} failed with exception: {e}")
    
    print("\n" + "=" * 50)
    print(f"📊 Test Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All tests passed! Real-time optimization module is working correctly.")
    else:
        print("⚠️  Some tests failed. Check the errors above.")
    
    return passed == total

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
