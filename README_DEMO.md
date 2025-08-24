# NovaGen Web Demo - Deployment Guide

## 🚀 Quick Start for Hackathon Demo

### Prerequisites
- Python 3.8+
- Trained models (run `model_training.py` first if needed)

### Installation
```bash
# Install dependencies
pip install -r requirements.txt

# Ensure models are trained
python model_training.py  # if models don't exist

# Start the web server
python app.py
```

### Access the Demo
Open your browser to: `http://localhost:5000`

## 🎨 Features

### Real-time 3D Visualization
- Interactive 3D Earth model with satellites
- Real-time orbital animation
- Debris highlighting in red
- Mouse controls for camera movement
- Zoom with mouse wheel

### Live Data Dashboard
- Real-time collision risk metrics
- Debris detection counter
- High-risk object alerts
- System status monitoring

### API Endpoints
- `/api/data` - Complete system status
- `/api/satellites` - 3D satellite positions
- `/api/debris` - Debris objects only
- `/api/predict` - Manual prediction trigger
- `/api/trajectory/<id>` - Individual satellite trajectory

### Controls
- **Debris Filter**: Show only space debris
- **Animation Speed**: Control orbital animation speed
- **Manual Update**: Force data refresh
- **Test Alert**: Simulate high-risk alert

## 🛰️ Technical Architecture

### Backend (Flask)
- Real-time data fetching from Celestrak
- ML model ensemble for debris detection
- Background data processing
- RESTful API endpoints

### Frontend (HTML/CSS/JS)
- Futuristic space-themed design
- Three.js 3D visualization
- Responsive layout
- Real-time data updates via AJAX

### Machine Learning Pipeline
- Ensemble of 4 ML models (RF, XGB, LGBM, CatBoost)
- LSTM/GRU neural networks for trajectory prediction
- Feature extraction from TLE orbital elements
- Real-time prediction and risk assessment

## 🎯 Hackathon Presentation Tips

1. **Start with the 3D visualization** - shows immediate impact
2. **Explain the real-time data** - live satellite tracking
3. **Demonstrate debris detection** - toggle debris filter
4. **Show risk alerts** - use test alert button
5. **Highlight the ensemble ML approach** - multiple models for accuracy

## 🚨 Demo Script

"This is NovaGen - a real-time orbital collision risk prediction system. We're tracking over 12,000 space objects in real-time, using machine learning to identify debris and predict collisions. The 3D visualization shows live satellite positions, with debris highlighted in red. Our ensemble ML models achieve high accuracy in debris detection, while neural networks predict future trajectories. The system provides immediate alerts when collision risks exceed safe thresholds."

## 🔧 Customization

### Styling
- Modify CSS variables in `templates/index.html`
- Change color scheme by updating `:root` colors
- Adjust animations in CSS keyframes

### Data Sources
- Update `TLE_URLS` in `data_collection.py` for different satellite catalogs
- Modify update intervals in `app.py`

### ML Models
- Retrain models with `model_training.py`
- Add new model types in the ensemble
- Adjust risk thresholds in `predict_collision_risk.py`

## 📱 Mobile Support
The interface is responsive and works on tablets/mobile devices with touch controls.

## 🎨 Design Elements
- **Orbitron font** for space-themed headers
- **Animated background stars**
- **Glassmorphism effects** with backdrop blur
- **Gradient color schemes**
- **Smooth animations** and transitions

Perfect for demonstrating cutting-edge space technology at hackathons! 🌟
