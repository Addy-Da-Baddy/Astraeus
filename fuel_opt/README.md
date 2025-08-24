# Fuel Optimization Module

A comprehensive satellite fuel optimization system that provides real-time optimization capabilities for satellite operations.

## 🚀 Features

### Core Optimization
- **Orbital Mechanics**: Precise calculations for satellite motion and orbital transfers
- **Propulsion Modeling**: Support for chemical, electric, and advanced propulsion systems
- **Trajectory Optimization**: Multiple algorithms including Hohmann transfers, multi-impulse, and continuous thrust
- **Fuel Consumption Analysis**: Detailed fuel usage modeling and prediction
- **Mission Planning**: Comprehensive mission optimization with multiple objectives

### 🆕 Real-Time Optimization
- **Continuous Monitoring**: Live tracking of satellite parameters (fuel, power, altitude, temperature)
- **Real-Time Constraints**: Dynamic constraint violation detection and response
- **Adaptive Optimization**: Automatic optimization strategy adjustment based on changing conditions
- **Multi-Threaded Execution**: Concurrent monitoring and optimization for real-time performance
- **Event-Driven Alerts**: Immediate notification of critical events and constraint violations
- **Performance Tracking**: Live metrics and historical performance analysis

## 🏗️ Architecture

```
fuel_opt/
├── __init__.py              # Main module interface
├── orbital_mechanics.py     # Orbital dynamics and calculations
├── fuel_models.py          # Propulsion systems and fuel consumption
├── trajectory_optimizer.py  # Trajectory optimization algorithms
├── fuel_optimizer.py       # Main optimization engine
├── realtime_optimizer.py   # 🆕 Real-time optimization engine
├── demo.py                 # Basic optimization demonstrations
├── realtime_demo.py        # 🆕 Real-time optimization demonstrations
├── requirements.txt        # Dependencies
└── README.md              # This file
```

## 🚀 Quick Start

### Basic Optimization
```python
from fuel_opt import FuelOptimizer, MissionRequirements
from fuel_opt.orbital_mechanics import OrbitalElements

# Create mission requirements
requirements = MissionRequirements(
    initial_altitude=500.0,      # km
    target_altitude=800.0,       # km
    max_mission_time=86400.0,    # 24 hours
    max_fuel_mass=100.0,         # kg
    max_total_mass=1000.0,       # kg
    max_power=1000.0,            # W
    optimization_priority="fuel"
)

# Create optimizer and run
optimizer = FuelOptimizer()
result = optimizer.optimize_mission(requirements)
print(f"Fuel used: {result.fuel_consumption.fuel_mass:.2f} kg")
```

### 🆕 Real-Time Optimization
```python
from fuel_opt import RealTimeOptimizer, RealTimeConstraints
from fuel_opt.orbital_mechanics import OrbitalElements

# Create real-time constraints
constraints = RealTimeConstraints(
    min_fuel_mass=15.0,          # kg
    min_power_level=0.3,         # 30%
    optimization_interval=60.0,   # 60 seconds
    constraint_check_interval=10.0 # 10 seconds
)

# Create real-time optimizer
rt_optimizer = RealTimeOptimizer(requirements, constraints)

# Add alert callback
def alert_handler(event):
    print(f"Alert: {event.description}")

rt_optimizer.add_alert_callback(alert_handler)

# Start real-time optimization
rt_optimizer.start_real_time_optimization(initial_state, propulsion_system)

# Monitor status
while True:
    status = rt_optimizer.get_current_status()
    print(f"Fuel: {status['fuel_mass']:.1f} kg, Status: {status['status']}")
    time.sleep(30)
```

## 🔧 Core Components

### OrbitalMechanics
Handles all orbital dynamics calculations:
- State vector ↔ Orbital elements conversion
- Orbit propagation with J2 perturbations
- Hohmann transfer calculations
- Lambert problem solutions

### PropulsionModel
Models different propulsion systems:
- Chemical thrusters (high thrust, low efficiency)
- Electric thrusters (low thrust, high efficiency)
- Fuel consumption calculations using Tsiolkovsky equation
- Optimal propulsion system selection

### TrajectoryOptimizer
Implements optimization algorithms:
- Hohmann transfer optimization
- Multi-impulse trajectories using genetic algorithms
- Continuous thrust optimization using gradient methods
- Constellation deployment strategies

### FuelOptimizer
Main optimization engine that integrates all components:
- Mission-level optimization
- Multi-objective optimization (fuel, time, mass, balanced)
- Constellation deployment optimization
- Performance analysis and comparison

### 🆕 RealTimeOptimizer
Real-time optimization engine with:
- Continuous parameter monitoring
- Constraint violation detection
- Adaptive optimization strategies
- Multi-threaded execution
- Event-driven alerting system

## 🎯 Optimization Priorities

The system supports multiple optimization objectives:

- **"fuel"**: Minimize fuel consumption (primary objective)
- **"time"**: Minimize mission duration
- **"mass"**: Minimize total spacecraft mass
- **"balanced"**: Balanced optimization across all objectives

## 🆕 Real-Time Features

### Continuous Monitoring
- **Satellite Parameters**: Fuel mass, power level, orbital altitude, temperature
- **Environmental Factors**: Collision risk, orbital decay, thermal conditions
- **System Performance**: Optimization status, convergence, execution time

### Constraint Management
- **Fuel Constraints**: Minimum fuel thresholds and consumption rates
- **Power Constraints**: Power level monitoring and efficiency tracking
- **Orbital Constraints**: Decay rate monitoring and altitude maintenance
- **Safety Constraints**: Collision risk assessment and thermal limits

### Adaptive Optimization
- **Dynamic Strategy Selection**: Automatic priority adjustment based on conditions
- **Constraint-Driven Optimization**: Immediate response to constraint violations
- **Performance Adaptation**: Strategy modification based on historical performance

### Event System
- **Real-Time Alerts**: Immediate notification of critical events
- **Severity Levels**: Low, medium, high, and critical event classification
- **Custom Callbacks**: User-defined event handling functions
- **Event History**: Comprehensive logging and analysis

## 📊 Performance Metrics

The system tracks comprehensive performance metrics:

- **Optimization Performance**: Success rate, convergence time, iteration count
- **Fuel Efficiency**: Consumption rates, efficiency scores, optimization gains
- **Constraint Compliance**: Violation rates, response times, resolution success
- **System Performance**: Execution times, resource usage, scalability metrics

## 🧪 Testing and Validation

### Running Demos
```bash
# Basic optimization demo
cd fuel_opt
python3 demo.py

# 🆕 Real-time optimization demo
python3 realtime_demo.py
```

### Demo Features
- **Basic Demo**: Core optimization capabilities
- **Real-Time Demo**: Live monitoring and optimization
- **Adaptive Demo**: Dynamic strategy adjustment
- **Constraint Demo**: Violation detection and response

## 📈 Advanced Features

### Constellation Deployment
```python
# Optimize deployment of multiple satellites
constellation_config = {
    'num_satellites': 12,
    'deployment_altitude': 550.0,
    'spacing_angle': 30.0
}

results = optimizer.optimize_constellation_deployment(
    constellation_config, mission_requirements
)
```

### Propulsion System Comparison
```python
# Compare different propulsion systems
comparison = optimizer.compare_propulsion_systems(
    mission_requirements, ['chemical', 'ion', 'hall_effect']
)
```

### Fuel Efficiency Analysis
```python
# Analyze fuel efficiency
efficiency = optimizer.analyze_fuel_efficiency(optimization_result)
```

## 🔮 Future Enhancements

- **Machine Learning Integration**: AI-powered optimization strategies
- **Advanced Perturbations**: Solar radiation pressure, third-body effects
- **Multi-Satellite Coordination**: Fleet-level optimization
- **Real-Time Data Integration**: Live telemetry and ground station data
- **Predictive Maintenance**: AI-driven maintenance scheduling
- **Cloud Deployment**: Scalable cloud-based optimization services

## 📋 Requirements

### Core Dependencies
- `numpy >= 1.21.0`: Numerical computations
- `scipy >= 1.7.0`: Scientific computing and optimization

### Optional Dependencies
- `matplotlib >= 3.5.0`: Visualization and plotting
- `pandas >= 1.3.0`: Data analysis and manipulation
- `scikit-learn >= 1.0.0`: Machine learning algorithms
- `torch >= 1.10.0`: Deep learning optimization

## 🚀 Getting Started

1. **Install Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

2. **Run Basic Demo**:
   ```bash
   python3 demo.py
   ```

3. **Run Real-Time Demo**:
   ```bash
   python3 realtime_demo.py
   ```

4. **Import in Your Code**:
   ```python
   from fuel_opt import FuelOptimizer, RealTimeOptimizer
   ```

## 🤝 Contributing

We welcome contributions! Please see our contribution guidelines for:
- Code style and standards
- Testing requirements
- Documentation updates
- Performance improvements

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Check the documentation
- Run the demo scripts
- Review the example code
- Open an issue for bugs or feature requests

---

**🚀 Ready to optimize your satellite missions in real-time!**
