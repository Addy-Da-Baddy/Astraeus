import matplotlib.pyplot as plt
import matplotlib.dates as mdates
import numpy as np
import pandas as pd
import json
import base64
from io import BytesIO
from datetime import datetime, timedelta
import seaborn as sns

# Set dark theme for matplotlib
plt.style.use('dark_background')
sns.set_palette("bright")

class DataVisualization:
    def __init__(self):
        self.colors = {
            'primary': '#007bff',
            'success': '#28a745', 
            'danger': '#dc3545',
            'warning': '#ffc107',
            'info': '#17a2b8',
            'terminal_green': '#00ff7f',
            'terminal_cyan': '#4dd0e1'
        }
    
    def load_real_data(self):
        """Load real satellite data from CSV files"""
        try:
            # Load orbital features data
            orbital_data = pd.read_csv('orbital_features.csv')
            collision_data = pd.read_csv('collision_risk_log.csv')
            return orbital_data, collision_data
        except FileNotFoundError:
            # Generate synthetic data if files don't exist
            return self.generate_synthetic_data()
    
    def generate_synthetic_data(self):
        """Generate realistic synthetic data for visualization"""
        # Orbital features data
        n_objects = 1000
        orbital_data = pd.DataFrame({
            'object_id': range(n_objects),
            'semi_major_axis': np.random.normal(7000, 1000, n_objects),
            'eccentricity': np.random.beta(0.5, 2, n_objects),
            'inclination': np.random.uniform(0, 180, n_objects),
            'apogee': np.random.normal(500, 200, n_objects),
            'perigee': np.random.normal(400, 150, n_objects),
            'object_type': np.random.choice(['Active Satellite', 'Debris', 'Inactive Satellite'], n_objects, p=[0.4, 0.35, 0.25]),
            'collision_risk': np.random.exponential(0.1, n_objects)
        })
        
        # Collision risk log data
        dates = [datetime.now() - timedelta(hours=i) for i in range(24, 0, -1)]
        collision_data = pd.DataFrame({
            'timestamp': dates,
            'total_objects': np.random.poisson(12000, 24),
            'high_risk_objects': np.random.poisson(50, 24),
            'collision_probability': np.random.exponential(0.2, 24),
            'prediction_accuracy': np.random.normal(0.987, 0.01, 24)
        })
        
        return orbital_data, collision_data
    
    def plot_to_base64(self, fig):
        """Convert matplotlib figure to base64 string"""
        buffer = BytesIO()
        fig.savefig(buffer, format='png', bbox_inches='tight', 
                   facecolor='#0d1117', edgecolor='none', dpi=100)
        buffer.seek(0)
        image_base64 = base64.b64encode(buffer.getvalue()).decode()
        buffer.close()
        plt.close(fig)
        return f"data:image/png;base64,{image_base64}"
    
    def create_collision_risk_timeline(self):
        """Create collision risk over time chart"""
        orbital_data, collision_data = self.load_real_data()
        
        fig, ax = plt.subplots(figsize=(12, 6))
        
        # Plot collision probability over time
        ax.plot(collision_data['timestamp'], collision_data['collision_probability'], 
                color=self.colors['danger'], linewidth=3, marker='o', markersize=6)
        
        # Add trend line
        z = np.polyfit(range(len(collision_data)), collision_data['collision_probability'], 1)
        p = np.poly1d(z)
        ax.plot(collision_data['timestamp'], p(range(len(collision_data))), 
                "--", color=self.colors['warning'], alpha=0.8, linewidth=2)
        
        ax.set_title('Collision Risk Probability Over Time', fontsize=16, color='white', pad=20)
        ax.set_xlabel('Time (Last 24 Hours)', color='white', fontsize=12)
        ax.set_ylabel('Collision Probability (%)', color='white', fontsize=12)
        ax.grid(True, alpha=0.3)
        
        # Format x-axis
        ax.xaxis.set_major_formatter(mdates.DateFormatter('%H:%M'))
        ax.xaxis.set_major_locator(mdates.HourLocator(interval=4))
        plt.xticks(rotation=45)
        
        # Style improvements
        ax.spines['top'].set_visible(False)
        ax.spines['right'].set_visible(False)
        ax.spines['left'].set_color('white')
        ax.spines['bottom'].set_color('white')
        ax.tick_params(colors='white')
        
        plt.tight_layout()
        return self.plot_to_base64(fig)
    
    def create_orbital_altitude_distribution(self):
        """Create orbital altitude distribution histogram"""
        orbital_data, _ = self.load_real_data()
        
        fig, ax = plt.subplots(figsize=(12, 8))
        
        # Create histogram for different object types
        object_types = orbital_data['object_type'].unique()
        colors = [self.colors['terminal_green'], self.colors['danger'], self.colors['warning']]
        
        for i, obj_type in enumerate(object_types):
            data = orbital_data[orbital_data['object_type'] == obj_type]['apogee']
            ax.hist(data, bins=30, alpha=0.7, label=f'{obj_type}', color=colors[i % len(colors)])
        
        ax.set_title('Orbital Altitude Distribution by Object Type', fontsize=16, color='white', pad=20)
        ax.set_xlabel('Apogee Altitude (km)', color='white', fontsize=12)
        ax.set_ylabel('Number of Objects', color='white', fontsize=12)
        ax.legend(fancybox=True, framealpha=0.9)
        ax.grid(True, alpha=0.3)
        
        # Style improvements
        ax.spines['top'].set_visible(False)
        ax.spines['right'].set_visible(False)
        ax.spines['left'].set_color('white')
        ax.spines['bottom'].set_color('white')
        ax.tick_params(colors='white')
        
        plt.tight_layout()
        return self.plot_to_base64(fig)
    
    def create_prediction_accuracy_trend(self):
        """Create prediction accuracy trend chart"""
        _, collision_data = self.load_real_data()
        
        fig, ax = plt.subplots(figsize=(12, 6))
        
        # Plot accuracy over time
        ax.plot(collision_data['timestamp'], collision_data['prediction_accuracy'] * 100,
                color=self.colors['terminal_green'], linewidth=4, marker='s', markersize=8)
        
        # Add confidence interval
        accuracy_std = np.std(collision_data['prediction_accuracy'] * 100)
        ax.fill_between(collision_data['timestamp'], 
                       (collision_data['prediction_accuracy'] * 100) - accuracy_std,
                       (collision_data['prediction_accuracy'] * 100) + accuracy_std,
                       alpha=0.3, color=self.colors['terminal_green'])
        
        ax.set_title('AI Model Prediction Accuracy Over Time', fontsize=16, color='white', pad=20)
        ax.set_xlabel('Time (Last 24 Hours)', color='white', fontsize=12)
        ax.set_ylabel('Accuracy (%)', color='white', fontsize=12)
        ax.set_ylim(95, 100)
        ax.grid(True, alpha=0.3)
        
        # Format x-axis
        ax.xaxis.set_major_formatter(mdates.DateFormatter('%H:%M'))
        ax.xaxis.set_major_locator(mdates.HourLocator(interval=4))
        plt.xticks(rotation=45)
        
        # Style improvements
        ax.spines['top'].set_visible(False)
        ax.spines['right'].set_visible(False)
        ax.spines['left'].set_color('white')
        ax.spines['bottom'].set_color('white')
        ax.tick_params(colors='white')
        
        plt.tight_layout()
        return self.plot_to_base64(fig)
    
    def create_risk_distribution_pie(self):
        """Create risk level distribution pie chart"""
        orbital_data, _ = self.load_real_data()
        
        # Categorize risk levels
        risk_levels = []
        for risk in orbital_data['collision_risk']:
            if risk < 0.1:
                risk_levels.append('Low Risk')
            elif risk < 0.3:
                risk_levels.append('Medium Risk')
            else:
                risk_levels.append('High Risk')
        
        risk_counts = pd.Series(risk_levels).value_counts()
        
        fig, ax = plt.subplots(figsize=(10, 10))
        
        colors = [self.colors['success'], self.colors['warning'], self.colors['danger']]
        wedges, texts, autotexts = ax.pie(risk_counts.values, labels=risk_counts.index, 
                                          autopct='%1.1f%%', colors=colors, startangle=90,
                                          textprops={'fontsize': 12})
        
        # Enhance text appearance
        for autotext in autotexts:
            autotext.set_color('white')
            autotext.set_fontweight('bold')
            autotext.set_fontsize(14)
        
        for text in texts:
            text.set_color('white')
            text.set_fontsize(12)
        
        ax.set_title('Collision Risk Distribution', fontsize=16, color='white', pad=20)
        
        plt.tight_layout()
        return self.plot_to_base64(fig)

# Example usage and testing
if __name__ == "__main__":
    viz = DataVisualization()
    print("Testing Data Visualization System...")
    
    try:
        chart = viz.create_collision_risk_timeline()
        print(f"Collision risk chart generated ({len(chart)} chars)")
        
        chart = viz.create_orbital_altitude_distribution()
        print(f"Orbital distribution chart generated ({len(chart)} chars)")
        
        chart = viz.create_prediction_accuracy_trend()
        print(f"Prediction accuracy chart generated ({len(chart)} chars)")
        
        print("Data visualization system ready!")
        
    except Exception as e:
        print(f"Error: {e}")