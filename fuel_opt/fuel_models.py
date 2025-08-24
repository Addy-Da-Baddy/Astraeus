"""
Fuel Models Module
==================

Provides comprehensive fuel consumption and propulsion models for satellites:
- Chemical propulsion systems
- Electric propulsion systems
- Fuel consumption calculations
- Thrust and specific impulse models
- Fuel mass calculations
"""

import numpy as np
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from enum import Enum

class PropulsionType(Enum):
    """Types of propulsion systems"""
    CHEMICAL = "chemical"
    ELECTRIC = "electric"
    ION = "ion"
    HALL_EFFECT = "hall_effect"
    SOLAR_SAIL = "solar_sail"
    NUCLEAR = "nuclear"

@dataclass
class PropulsionSystem:
    """Represents a propulsion system"""
    name: str
    propulsion_type: PropulsionType
    thrust: float  # N
    specific_impulse: float  # seconds
    power_consumption: float  # W (for electric propulsion)
    efficiency: float  # dimensionless
    dry_mass: float  # kg
    fuel_mass: float  # kg
    
    def __post_init__(self):
        if not 0 <= self.efficiency <= 1:
            raise ValueError("Efficiency must be between 0 and 1")

@dataclass
class FuelConsumption:
    """Fuel consumption data"""
    delta_v: float  # km/s
    fuel_mass: float  # kg
    burn_time: float  # seconds
    energy_consumed: float  # J

class PropulsionModel:
    """Main class for propulsion system modeling"""
    
    def __init__(self):
        # Standard propulsion systems database
        self.propulsion_systems = self._initialize_propulsion_systems()
        
        # Standard gravitational acceleration (m/s²)
        self.g0 = 9.80665
        
    def _initialize_propulsion_systems(self) -> Dict[str, PropulsionSystem]:
        """Initialize standard propulsion systems"""
        systems = {}
        
        # Chemical propulsion systems
        systems['monopropellant'] = PropulsionSystem(
            name="Monopropellant Hydrazine",
            propulsion_type=PropulsionType.CHEMICAL,
            thrust=22.0,  # N
            specific_impulse=230.0,  # s
            power_consumption=0.0,  # W
            efficiency=0.95,
            dry_mass=2.5,  # kg
            fuel_mass=10.0  # kg
        )
        
        systems['bipropellant'] = PropulsionSystem(
            name="Bipropellant N2O4/MMH",
            propulsion_type=PropulsionType.CHEMICAL,
            thrust=490.0,  # N
            specific_impulse=310.0,  # s
            power_consumption=0.0,  # W
            efficiency=0.98,
            dry_mass=8.0,  # kg
            fuel_mass=25.0  # kg
        )
        
        # Electric propulsion systems
        systems['ion_thruster'] = PropulsionSystem(
            name="Ion Thruster XIPS-25",
            propulsion_type=PropulsionType.ION,
            thrust=0.165,  # N
            specific_impulse=3500.0,  # s
            power_consumption=4500.0,  # W
            efficiency=0.65,
            dry_mass=15.0,  # kg
            fuel_mass=5.0  # kg
        )
        
        systems['hall_thruster'] = PropulsionSystem(
            name="Hall Effect Thruster",
            propulsion_type=PropulsionType.HALL_EFFECT,
            thrust=0.83,  # N
            specific_impulse=1600.0,  # s
            power_consumption=1350.0,  # W
            efficiency=0.55,
            dry_mass=8.0,  # kg
            fuel_mass=3.0  # kg
        )
        
        return systems
    
    def calculate_fuel_consumption(self, propulsion_system: PropulsionSystem, 
                                 delta_v: float, satellite_mass: float) -> FuelConsumption:
        """
        Calculate fuel consumption for a given delta-v
        
        Args:
            propulsion_system: The propulsion system to use
            delta_v: Required velocity change (km/s)
            satellite_mass: Initial satellite mass (kg)
            
        Returns:
            FuelConsumption object with consumption data
        """
        # Convert delta-v to m/s
        delta_v_ms = delta_v * 1000
        
        # Calculate fuel mass using Tsiolkovsky rocket equation
        # m_fuel = m_initial * (1 - exp(-delta_v / (Isp * g0)))
        if propulsion_system.propulsion_type == PropulsionType.CHEMICAL:
            # Chemical propulsion: direct application of rocket equation
            fuel_mass = satellite_mass * (1 - np.exp(-delta_v_ms / (propulsion_system.specific_impulse * self.g0)))
            
            # Calculate burn time based on thrust
            burn_time = (fuel_mass * propulsion_system.specific_impulse * self.g0) / propulsion_system.thrust
            
            # Energy consumption (chemical energy)
            energy_consumed = fuel_mass * 1e6  # Approximate chemical energy (J/kg)
            
        elif propulsion_system.propulsion_type in [PropulsionType.ELECTRIC, PropulsionType.ION, PropulsionType.HALL_EFFECT]:
            # Electric propulsion: consider power limitations
            # For electric propulsion, we need to consider power and efficiency
            power_available = propulsion_system.power_consumption * propulsion_system.efficiency
            
            # Calculate thrust power
            thrust_power = propulsion_system.thrust * propulsion_system.specific_impulse * self.g0 / 2
            
            # Effective specific impulse considering power limitations
            effective_isp = propulsion_system.specific_impulse * min(1.0, power_available / thrust_power)
            
            # Calculate fuel mass
            fuel_mass = satellite_mass * (1 - np.exp(-delta_v_ms / (effective_isp * self.g0)))
            
            # Calculate burn time (electric propulsion typically has longer burn times)
            burn_time = (fuel_mass * effective_isp * self.g0) / propulsion_system.thrust
            
            # Energy consumption
            energy_consumed = power_available * burn_time
            
        else:
            # Other propulsion types (solar sail, nuclear, etc.)
            fuel_mass = 0.0
            burn_time = 0.0
            energy_consumed = 0.0
        
        return FuelConsumption(
            delta_v=delta_v,
            fuel_mass=fuel_mass,
            burn_time=burn_time,
            energy_consumed=energy_consumed
        )
    
    def calculate_optimal_propulsion(self, delta_v: float, satellite_mass: float, 
                                   constraints: Dict) -> Tuple[PropulsionSystem, FuelConsumption]:
        """
        Find the optimal propulsion system for given requirements
        
        Args:
            delta_v: Required velocity change (km/s)
            satellite_mass: Initial satellite mass (kg)
            constraints: Dictionary with constraints (max_mass, max_power, etc.)
            
        Returns:
            Tuple of (optimal_propulsion_system, fuel_consumption)
        """
        best_system = None
        best_consumption = None
        best_score = float('inf')
        
        for system_name, system in self.propulsion_systems.items():
            try:
                consumption = self.calculate_fuel_consumption(system, delta_v, satellite_mass)
                
                # Check constraints
                if not self._check_constraints(system, consumption, constraints):
                    continue
                
                # Calculate score (lower is better)
                score = self._calculate_system_score(system, consumption, constraints)
                
                if score < best_score:
                    best_score = score
                    best_system = system
                    best_consumption = consumption
                    
            except Exception:
                continue
        
        if best_system is None:
            raise ValueError("No suitable propulsion system found for given constraints")
        
        return best_system, best_consumption
    
    def _check_constraints(self, system: PropulsionSystem, consumption: FuelConsumption, 
                          constraints: Dict) -> bool:
        """Check if propulsion system meets constraints"""
        # Check mass constraints
        if 'max_total_mass' in constraints:
            total_mass = system.dry_mass + system.fuel_mass + consumption.fuel_mass
            if total_mass > constraints['max_total_mass']:
                return False
        
        # Check power constraints
        if 'max_power' in constraints and system.power_consumption > 0:
            if system.power_consumption > constraints['max_power']:
                return False
        
        # Check burn time constraints
        if 'max_burn_time' in constraints:
            if consumption.burn_time > constraints['max_burn_time']:
                return False
        
        # Check fuel mass constraints
        if 'max_fuel_mass' in constraints:
            if consumption.fuel_mass > constraints['max_fuel_mass']:
                return False
        
        return True
    
    def _calculate_system_score(self, system: PropulsionSystem, consumption: FuelConsumption, 
                               constraints: Dict) -> float:
        """Calculate a score for the propulsion system (lower is better)"""
        score = 0.0
        
        # Mass penalty
        mass_weight = constraints.get('mass_weight', 1.0)
        score += mass_weight * (system.dry_mass + consumption.fuel_mass)
        
        # Power penalty
        power_weight = constraints.get('power_weight', 0.1)
        score += power_weight * system.power_consumption
        
        # Burn time penalty
        time_weight = constraints.get('time_weight', 0.01)
        score += time_weight * consumption.burn_time
        
        # Efficiency bonus
        efficiency_bonus = constraints.get('efficiency_bonus', 0.5)
        score -= efficiency_bonus * system.efficiency
        
        return score
    
    def calculate_multi_burn_consumption(self, propulsion_system: PropulsionSystem,
                                       delta_v_sequence: List[float], 
                                       satellite_mass: float) -> List[FuelConsumption]:
        """
        Calculate fuel consumption for multiple burns
        
        Args:
            propulsion_system: The propulsion system to use
            delta_v_sequence: List of delta-v values for each burn
            satellite_mass: Initial satellite mass (kg)
            
        Returns:
            List of FuelConsumption objects for each burn
        """
        consumptions = []
        current_mass = satellite_mass
        
        for delta_v in delta_v_sequence:
            consumption = self.calculate_fuel_consumption(propulsion_system, delta_v, current_mass)
            consumptions.append(consumption)
            
            # Update mass for next burn
            current_mass -= consumption.fuel_mass
        
        return consumptions
    
    def calculate_total_mission_consumption(self, propulsion_system: PropulsionSystem,
                                          mission_profile: List[Dict]) -> Dict:
        """
        Calculate total fuel consumption for a mission profile
        
        Args:
            propulsion_system: The propulsion system to use
            mission_profile: List of mission phases with delta-v requirements
            
        Returns:
            Dictionary with total mission consumption data
        """
        total_fuel = 0.0
        total_energy = 0.0
        total_burn_time = 0.0
        phase_consumptions = []
        
        current_mass = mission_profile[0].get('initial_mass', 1000.0)  # Default 1000 kg
        
        for i, phase in enumerate(mission_profile):
            delta_v = phase['delta_v']
            phase_name = phase.get('name', f'Phase_{i+1}')
            
            # Calculate consumption for this phase
            consumption = self.calculate_fuel_consumption(propulsion_system, delta_v, current_mass)
            
            phase_data = {
                'phase_name': phase_name,
                'delta_v': delta_v,
                'fuel_mass': consumption.fuel_mass,
                'burn_time': consumption.burn_time,
                'energy_consumed': consumption.energy_consumed,
                'mass_before': current_mass,
                'mass_after': current_mass - consumption.fuel_mass
            }
            
            phase_consumptions.append(phase_data)
            
            # Update totals
            total_fuel += consumption.fuel_mass
            total_energy += consumption.energy_consumed
            total_burn_time += consumption.burn_time
            
            # Update mass for next phase
            current_mass -= consumption.fuel_mass
        
        return {
            'total_fuel_mass': total_fuel,
            'total_energy_consumed': total_energy,
            'total_burn_time': total_burn_time,
            'final_mass': current_mass,
            'phase_consumptions': phase_consumptions,
            'propulsion_system': propulsion_system.name
        }
    
    def add_custom_propulsion_system(self, system: PropulsionSystem):
        """Add a custom propulsion system to the database"""
        self.propulsion_systems[system.name] = system
    
    def get_propulsion_system(self, name: str) -> Optional[PropulsionSystem]:
        """Get a propulsion system by name"""
        return self.propulsion_systems.get(name)
    
    def list_propulsion_systems(self) -> List[str]:
        """List all available propulsion system names"""
        return list(self.propulsion_systems.keys())
    
    def calculate_specific_impulse_from_thrust_power(self, thrust: float, power: float, 
                                                   efficiency: float) -> float:
        """
        Calculate specific impulse from thrust and power (for electric propulsion)
        
        Args:
            thrust: Thrust in N
            power: Power in W
            efficiency: Propulsion efficiency
            
        Returns:
            Specific impulse in seconds
        """
        if thrust <= 0 or power <= 0 or efficiency <= 0:
            raise ValueError("Thrust, power, and efficiency must be positive")
        
        # Isp = (2 * P * efficiency) / (thrust * g0)
        specific_impulse = (2 * power * efficiency) / (thrust * self.g0)
        return specific_impulse
    
    def calculate_thrust_from_specific_impulse_power(self, specific_impulse: float, 
                                                   power: float, efficiency: float) -> float:
        """
        Calculate thrust from specific impulse and power (for electric propulsion)
        
        Args:
            specific_impulse: Specific impulse in seconds
            power: Power in W
            efficiency: Propulsion efficiency
            
        Returns:
            Thrust in N
        """
        if specific_impulse <= 0 or power <= 0 or efficiency <= 0:
            raise ValueError("Specific impulse, power, and efficiency must be positive")
        
        # thrust = (2 * P * efficiency) / (Isp * g0)
        thrust = (2 * power * efficiency) / (specific_impulse * self.g0)
        return thrust
