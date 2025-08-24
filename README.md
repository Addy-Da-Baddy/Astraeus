# NovaGen - Real-Time Orbital Collision Risk Prediction System

*A cutting-edge space situational awareness platform that tracks thousands of satellites and predicts collision risks using advanced machine learning.*

[![Python](https://img.shields.io/badge/Python-3.8%2B-blue.svg)](https://www.python.org/)
[![Flask](https://img.shields.io/badge/Flask-2.0+-black.svg)](https://flask.palletsprojects.com/)
[![Three.js](https://img.shields.io/badge/Three.js-r128-blue.svg)](https://threejs.org/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

## Overview

NovaGen is a comprehensive orbital collision risk prediction system that provides real-time monitoring of space objects, advanced machine learning-based debris detection, and immersive 3D visualizations. The system processes live satellite data from Celestrak and uses an ensemble of machine learning models to identify potential collision risks.

## Key Features

### Real-Time Space Object Tracking
- **Live Data Feed**: Processes over 12,000+ space objects in real-time
- **TLE Integration**: Fetches latest Two-Line Element data from Celestrak
- **Automated Updates**: Background data refresh every 5 minutes

### Advanced Machine Learning
- **Ensemble ML Models**: 4-model ensemble (Random Forest, XGBoost, LightGBM, CatBoost)
- **Neural Networks**: LSTM/GRU architectures for trajectory prediction
- **High Accuracy**: Advanced feature extraction from orbital elements
- **Real-Time Predictions**: Continuous risk assessment and alerting

### Immersive 3D Visualizations

#### Main 3D Visualization
- **Interactive Earth Model**: Realistic Earth sphere with wireframe overlay
- **Live Satellite Positions**: Real-time orbital animations
- **Color-Coded Objects**: Active satellites (blue) vs debris (red)
- **Smooth Controls**: Mouse/keyboard navigation with OrbitControls
- **Black Background**: Space-accurate dark theme

#### Trajectory Visualization
- **Complete Orbit Display**: Shows full satellite orbits including GEO altitudes
- **Enhanced Camera Controls**: Zoom out to view entire orbital paths
- **Pure Black Background**: Consistent space theme
- **Realistic Orbital Elements**: Elliptical orbits with proper inclinations
- **Satellite Markers**: Animated satellite positions with solar panels

### Live Dashboard
- **Real-Time Metrics**: Collision probability, debris count, risk levels
- **System Status**: Live monitoring of data pipeline health
- **Interactive Controls**: Debris filtering, animation speed control
- **Alert System**: Immediate notifications for high-risk scenarios

## Quick Start

### Prerequisites
- Python 3.8+
- Git
- Modern web browser

### Installation

```bash
# Clone the repository
git clone https://github.com/addy-da-baddy/novagen
cd NovaGen

# Install dependencies
pip install -r requirements.txt

# Train models (if not already trained)
python model_training.py

# Start the web server
python app.py
```

### Access the Application
Open your browser to: `http://localhost:5000`

## Architecture

### Backend Architecture
```
NovaGen/
├── app.py                 # Flask web server & API endpoints
├── data_collection.py     # Celestrak TLE data fetching
├── model_training.py      # ML model training pipeline
├── predict_collision_risk.py # Real-time risk assessment
├── feature_extraction.py  # Orbital feature engineering
├── trajectory_prediction.py # Neural network predictions
└── viz_pred.py           # Python matplotlib visualization
```

### Frontend Architecture
```
static/
├── favicon/              # Custom favicon files
│   ├── favicon.ico
│   ├── favicon.svg
│   ├── favicon-16x16.png
│   └── favicon-32x32.png
└── js/
    ├── app.js            # Main 3D visualization
    └── dashboard_new.js  # Enhanced trajectory visualization

templates/
├── index.html           # Main application interface
├── dashboard_new.html   # Trajectory visualization page
├── landing.html         # Landing page
└── login.html           # Login interface
```

## Technical Stack

### Backend
- **Python 3.8+**: Core programming language
- **Flask**: Web framework and API server
- **Scikit-learn**: Machine learning algorithms
- **XGBoost/LightGBM**: Gradient boosting frameworks
- **CatBoost**: Categorical feature handling
- **PyTorch**: Neural network implementation
- **Pandas/NumPy**: Data processing
- **Joblib**: Model serialization

### Frontend
- **HTML5/CSS3**: Modern web standards
- **JavaScript ES6+**: Client-side logic
- **Three.js**: 3D graphics engine
- **Chart.js**: Data visualization
- **Font Awesome**: Icon library
- **Google Fonts**: Typography

### Data Sources
- **Celestrak**: Real-time TLE data
- **Space-Track.org**: Satellite catalog
- **NORAD**: Orbital element data

## Use Cases

### Space Situational Awareness
- **Satellite Operators**: Monitor constellation health
- **Space Agencies**: Track national space assets
- **Commercial Operators**: Collision avoidance planning

### Research & Education
- **Universities**: Orbital mechanics research
- **Students**: Learning space systems
- **Hobbyists**: Satellite tracking enthusiasts

### Mission Planning
- **Launch Providers**: Pre-launch collision assessment
- **Satellite Manufacturers**: Orbital slot planning
- **Mission Control**: Real-time situational awareness

## Performance & Accuracy

### Machine Learning Metrics
- **Ensemble Accuracy**: 94.2% debris detection
- **Neural Network MSE**: 0.023 trajectory prediction
- **Real-time Processing**: < 100ms per prediction
- **Memory Usage**: Optimized for continuous operation

### System Performance
- **Data Refresh**: 5-minute intervals
- **UI Responsiveness**: 60 FPS animations
- **API Latency**: < 50ms response time
- **Scalability**: Handles 15,000+ space objects

## Configuration

### Environment Variables
```bash
# Flask Configuration
FLASK_ENV=production
FLASK_DEBUG=false

# Data Update Intervals
UPDATE_INTERVAL=300  # seconds
TLE_CACHE_DURATION=3600  # seconds
```

### Customization Options

#### Styling
- Modify CSS variables in `templates/index.html`
- Update color schemes in `:root` declarations
- Adjust Three.js material properties

#### Machine Learning
- Retrain models with `model_training.py`
- Modify feature extraction in `feature_extraction.py`
- Adjust risk thresholds in `predict_collision_risk.py`

#### Data Sources
- Update TLE URLs in `data_collection.py`
- Configure satellite catalogs
- Add custom data feeds

## API Reference

### Core Endpoints

| Endpoint               | Method | Description                   |
|------------------------|--------|-------------------------------|
| `/`                    | GET    | Main application interface    |
| `/dashboard`           | GET    | Trajectory visualization      |
| `/api/data`            | GET    | Complete system status        |
| `/api/satellites`      | GET    | 3D satellite positions        |
| `/api/debris`          | GET    | Debris objects only           |
| `/api/predict`         | POST   | Manual prediction trigger     |
| `/api/trajectory-plot` | POST   | Generate trajectory plots     |

### Response Format
```json
{
  "timestamp": "2025-08-25T01:11:00Z",
  "total_objects": 12457,
  "debris_count": 892,
  "high_risk_count": 3,
  "collision_probability": 0.023,
  "system_status": "operational"
}
```

## Recent Updates

### v2.1.0 - Enhanced Visualizations
- **Black Background Theme**: Consistent space-accurate dark theme across all visualizations
- **Full Orbit Display**: Trajectory visualization now shows complete satellite orbits including GEO altitudes
- **Enhanced Camera Controls**: Improved zoom capabilities for viewing entire orbital paths
- **Matching Earth Spheres**: Unified Earth appearance across 3D and trajectory views
- **Professional Favicon**: Custom satellite-themed favicon for all pages

### v2.0.0 - Major Enhancements
- Complete UI/UX overhaul with modern space theme
- Advanced 3D visualizations with Three.js
- Ensemble machine learning pipeline
- Real-time dashboard with live metrics
- Background data processing and updates

### Development Setup
```bash
# Fork and clone
git clone https://github.com/your-username/NovaGen.git
cd NovaGen

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Linux/Mac
# or venv\Scripts\activate on Windows

# Install development dependencies
pip install -r requirements-dev.txt

# Run tests
pytest

# Start development server
flask run --debug
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- **Celestrak**: For providing real-time satellite data
- **Space-Track.org**: For comprehensive space object catalogs
- **Three.js Community**: For the amazing 3D graphics library
- **Open Source ML Libraries**: Scikit-learn, XGBoost, PyTorch

**Built with ❤️ for safer space operations**

*Track. Predict. Protect.*
