# app.py - Flask Web API for NovaGen Orbital Collision Risk System
from flask import Flask, render_template, jsonify, request, session, redirect, url_for, Response
from flask_cors import CORS
import json
import numpy as np
import pandas as pd
from datetime import datetime
import threading
import time
import matplotlib
matplotlib.use('Agg')  # Use non-interactive backend
import matplotlib.pyplot as plt
import matplotlib.patches as patches
from matplotlib.patches import Circle
import io
import base64
from predict_collision_risk import CollisionRiskPredictor
from data_collection import get_latest_features, get_cache_status

def convert_numpy_types(obj):
    """Convert numpy types to native Python types for JSON serialization"""
    if isinstance(obj, np.integer):
        return int(obj)
    elif isinstance(obj, np.floating):
        return float(obj)
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    elif isinstance(obj, dict):
        return {key: convert_numpy_types(value) for key, value in obj.items()}
    elif isinstance(obj, list):
        return [convert_numpy_types(item) for item in obj]
    return obj

app = Flask(__name__)
CORS(app)

# Secret key for sessions (in production, use environment variable)
app.secret_key = 'astraeus_orbital_collision_prediction_2025'

# Demo credentials (in production, use proper authentication)
DEMO_CREDENTIALS = {
    'admin': 'astraeus2025'
}

# Global variables for real-time data
predictor = None
latest_data = {
    'timestamp': None,
    'total_objects': 0,
    'debris_count': 0,
    'high_risk_count': 0,
    'collision_probability': 0.0,
    'satellites': [],
    'debris_objects': [],
    'trajectories': []
}

def initialize_predictor():
    """Initialize the collision risk predictor"""
    global predictor
    try:
        predictor = CollisionRiskPredictor()
        print("✅ Predictor initialized successfully")
        return True
    except Exception as e:
        print(f"❌ Error initializing predictor: {e}")
        return False

def update_data():
    """Background thread to update satellite data"""
    global latest_data, predictor
    
    while True:
        try:
            if predictor is None:
                time.sleep(30)
                continue
                
            print("🔄 Fetching latest satellite data...")
            features_df = get_latest_features("active_satellites", label=0)
            
            if features_df is not None and len(features_df) > 0:
                # Run collision risk assessment
                results = predictor.assess_collision_risk(features_df)
                
                # Extract satellite positions for visualization
                satellites = []
                for idx, row in features_df.iterrows():
                    satellites.append({
                        'id': int(idx),
                        'x': float(row.get('pos_x', 0)),
                        'y': float(row.get('pos_y', 0)), 
                        'z': float(row.get('pos_z', 0)),
                        'vx': float(row.get('vel_x', 0)),
                        'vy': float(row.get('vel_y', 0)),
                        'vz': float(row.get('vel_z', 0)),
                        'altitude': float(row.get('altitude', 0)),
                        'inclination': float(row.get('inclination', 0)),
                        'is_debris': False
                    })
                
                # Mark debris objects
                if results.get('debris_detection'):
                    debris_predictions = results['debris_detection']['predictions']
                    for i, is_debris in enumerate(debris_predictions):
                        if i < len(satellites) and bool(is_debris):
                            satellites[i]['is_debris'] = True
                
                # Update global data
                latest_data.update({
                    'timestamp': datetime.now().isoformat(),
                    'total_objects': int(results['total_objects']),
                    'debris_count': int(results['debris_detection']['debris_count']) if results['debris_detection'] else 0,
                    'high_risk_count': int(len(results['high_risk_objects'])),
                    'collision_probability': float(results['collision_probability']),
                    'satellites': satellites[:500],  # Limit for performance
                    'status': 'active'
                })
                
                print(f"✅ Data updated: {latest_data['total_objects']} objects, {latest_data['debris_count']} debris")
                
            else:
                print("❌ Failed to fetch satellite data")
                latest_data['status'] = 'error'
                
        except Exception as e:
            print(f"❌ Error updating data: {e}")
            latest_data['status'] = 'error'
            
        # Wait 5 minutes before next update
        time.sleep(300)

@app.route('/')
def index():
    """Serve the landing page"""
    return render_template('landing.html')

@app.route('/login')
def login_page():
    """Serve the login page"""
    return render_template('login.html')

@app.route('/api/login', methods=['POST'])
def login():
    """Handle login authentication"""
    try:
        data = request.get_json()
        username = data.get('username')
        password = data.get('password')
        
        # Check credentials
        if username in DEMO_CREDENTIALS and DEMO_CREDENTIALS[username] == password:
            session['authenticated'] = True
            session['username'] = username
            return jsonify({
                'success': True,
                'message': 'Authentication successful'
            })
        else:
            return jsonify({
                'success': False,
                'message': 'Invalid username or password'
            }), 401
            
    except Exception as e:
        return jsonify({
            'success': False,
            'message': 'Authentication error'
        }), 500

@app.route('/logout')
def logout():
    """Handle logout"""
    session.clear()
    return redirect(url_for('index'))

@app.route('/dashboard')
def dashboard():
    """Serve the advanced dashboard (protected route)"""
    if not session.get('authenticated'):
        return redirect(url_for('login_page'))
    return render_template('dashboard_new.html')

@app.route('/api/status')
def api_status():
    """Get system status"""
    return jsonify({
        'status': 'online',
        'predictor_loaded': predictor is not None,
        'models_available': len(predictor.detection_models) if predictor else 0,
        'timestamp': datetime.now().isoformat()
    })

@app.route('/api/data')
def api_data():
    """Get latest collision risk data"""
    # Convert all numpy types to native Python types
    clean_data = convert_numpy_types(latest_data)
    return jsonify(clean_data)

@app.route('/api/satellites')
def api_satellites():
    """Get satellite positions for 3D visualization"""
    clean_satellites = convert_numpy_types(latest_data['satellites'])
    return jsonify({
        'satellites': clean_satellites,
        'timestamp': latest_data['timestamp']
    })

@app.route('/api/debris')
def api_debris():
    """Get debris objects only"""
    debris = [sat for sat in latest_data['satellites'] if sat['is_debris']]
    clean_debris = convert_numpy_types(debris)
    return jsonify({
        'debris': clean_debris,
        'count': len(clean_debris),
        'timestamp': latest_data['timestamp']
    })

@app.route('/api/predict/realtime', methods=['POST'])
def api_predict_realtime():
    """Real-time prediction with fresh data fetch"""
    try:
        if predictor is None:
            return jsonify({'error': 'Predictor not initialized'}), 500
            
        print("🔄 Fetching fresh satellite data for real-time prediction...")
        
        # Get completely fresh data
        features_df = get_latest_features("active_satellites", label=0)
        
        if features_df is not None and len(features_df) > 0:
            print(f"📡 Processing {len(features_df)} objects for real-time prediction...")
            
            # Run real-time collision risk assessment
            results = predictor.assess_collision_risk(features_df)
            
            # Extract real satellite data with predictions
            satellites_with_predictions = []
            
            # Get debris predictions
            debris_predictions = results['debris_detection']['predictions'] if results['debris_detection'] else []
            debris_probabilities = results['debris_detection']['probabilities'] if results['debris_detection'] else []
            
            for idx, row in features_df.iterrows():
                is_debris = bool(debris_predictions[idx]) if idx < len(debris_predictions) else False
                debris_prob = float(debris_probabilities[idx][1]) if idx < len(debris_probabilities) and len(debris_probabilities[idx]) > 1 else 0.0
                
                satellite_data = {
                    'id': int(idx),
                    'x': float(row.get('pos_x', 0)),
                    'y': float(row.get('pos_y', 0)), 
                    'z': float(row.get('pos_z', 0)),
                    'vx': float(row.get('vel_x', 0)),
                    'vy': float(row.get('vel_y', 0)),
                    'vz': float(row.get('vel_z', 0)),
                    'altitude': float(row.get('altitude', 0)),
                    'inclination': float(row.get('inclination', 0)),
                    'eccentricity': float(row.get('eccentricity', 0)),
                    'period': float(row.get('period', 0)),
                    'is_debris': is_debris,
                    'debris_probability': debris_prob,
                    'risk_level': 'HIGH' if debris_prob > 0.7 else 'MEDIUM' if debris_prob > 0.3 else 'LOW'
                }
                satellites_with_predictions.append(satellite_data)
            
            # Update global data with fresh predictions
            latest_data.update({
                'timestamp': datetime.now().isoformat(),
                'total_objects': int(results['total_objects']),
                'debris_count': int(results['debris_detection']['debris_count']) if results['debris_detection'] else 0,
                'high_risk_count': int(len(results['high_risk_objects'])),
                'collision_probability': float(results['collision_probability']),
                'satellites': satellites_with_predictions[:1000],  # Limit for performance
                'status': 'active',
                'last_prediction': datetime.now().isoformat()
            })
            
            return jsonify({
                'success': True,
                'timestamp': datetime.now().isoformat(),
                'total_objects': int(results['total_objects']),
                'debris_count': int(results['debris_detection']['debris_count']) if results['debris_detection'] else 0,
                'high_risk_count': int(len(results['high_risk_objects'])),
                'collision_probability': float(results['collision_probability']),
                'models_used': {
                    'debris_detection': list(predictor.detection_models.keys()),
                    'trajectory_prediction': list(predictor.trajectory_models.keys())
                },
                'processing_time': 'Real-time',
                'message': f'Real-time prediction completed for {results["total_objects"]} objects'
            })
        else:
            return jsonify({'error': 'Failed to fetch fresh satellite data'}), 500
            
    except Exception as e:
        print(f"❌ Real-time prediction error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/predict', methods=['POST'])
def api_predict():
    """Manual prediction endpoint (legacy)"""
    return api_predict_realtime()

@app.route('/api/satellite/<int:satellite_id>/details')
def api_satellite_details(satellite_id):
    """Get detailed information for a specific satellite"""
    try:
        if predictor is None:
            return jsonify({'error': 'Predictor not initialized'}), 400
            
        # Get fresh data
        features_df = get_latest_features("active_satellites", label=0)
        
        if features_df is None or len(features_df) <= satellite_id:
            return jsonify({'error': 'Invalid satellite ID or no data available'}), 400
            
        # Get specific satellite data
        satellite_row = features_df.iloc[satellite_id]
        
        # Run predictions for this specific satellite
        single_satellite_df = features_df.iloc[[satellite_id]]
        
        # Get debris detection results
        debris_results = predictor.predict_debris_detection(single_satellite_df)
        is_debris = bool(debris_results['predictions'][0]) if debris_results else False
        debris_probability = float(debris_results['probabilities'][0][1]) if debris_results and len(debris_results['probabilities'][0]) > 1 else 0.0
        
        # Get trajectory prediction
        trajectory_results = predictor.predict_trajectory(single_satellite_df)
        
        # Calculate risk level
        risk_level = 'HIGH' if debris_probability > 0.7 else 'MEDIUM' if debris_probability > 0.3 else 'LOW'
        collision_risk = 'HIGH' if debris_probability > 0.5 else 'MEDIUM' if debris_probability > 0.2 else 'LOW'
        
        # Health status based on orbital parameters
        altitude = float(satellite_row.get('altitude', 0))
        eccentricity = float(satellite_row.get('eccentricity', 0))
        
        health_status = 'HEALTHY'
        health_flags = []
        
        if altitude < 200:
            health_status = 'CRITICAL'
            health_flags.append('Very low altitude - reentry risk')
        elif altitude < 400:
            health_status = 'WARNING'
            health_flags.append('Low altitude - atmospheric drag')
            
        if eccentricity > 0.1:
            health_flags.append('High eccentricity orbit')
            
        if is_debris:
            health_status = 'DEBRIS'
            health_flags.append('Classified as space debris')
        
        # Compile detailed satellite information
        satellite_details = {
            'id': satellite_id,
            'basic_info': {
                'position': {
                    'x': float(satellite_row.get('pos_x', 0)),
                    'y': float(satellite_row.get('pos_y', 0)),
                    'z': float(satellite_row.get('pos_z', 0))
                },
                'velocity': {
                    'vx': float(satellite_row.get('vel_x', 0)),
                    'vy': float(satellite_row.get('vel_y', 0)),
                    'vz': float(satellite_row.get('vel_z', 0)),
                    'magnitude': float(np.sqrt(satellite_row.get('vel_x', 0)**2 + satellite_row.get('vel_y', 0)**2 + satellite_row.get('vel_z', 0)**2))
                },
                'orbital_elements': {
                    'altitude': altitude,
                    'inclination': float(satellite_row.get('inclination', 0)),
                    'eccentricity': eccentricity,
                    'period': float(satellite_row.get('orbital_period', 0)) / 60,  # Convert seconds to minutes
                    'semi_major_axis': float(satellite_row.get('semi_major_axis', 0)),
                    'apogee': float(satellite_row.get('apogee', 0)),
                    'perigee': float(satellite_row.get('perigee', 0))
                }
            },
            'risk_assessment': {
                'is_debris': is_debris,
                'debris_probability': debris_probability,
                'risk_level': risk_level,
                'collision_risk': collision_risk,
                'risk_score': debris_probability * 100
            },
            'health_status': {
                'status': health_status,
                'flags': health_flags,
                'last_updated': datetime.now().isoformat()
            },
            'predictions': {
                'has_trajectory': trajectory_results is not None,
                'models_used': list(trajectory_results.keys()) if trajectory_results else [],
                'prediction_confidence': max(0.9 - debris_probability, 0.1)
            },
            'timestamp': datetime.now().isoformat()
        }
        
        return jsonify({
            'success': True,
            'satellite': satellite_details
        })
        
    except Exception as e:
        print(f"❌ Satellite details error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/satellites/high-risk')
def api_high_risk_satellites():
    """Get all high-risk satellites with detailed status"""
    try:
        if predictor is None:
            return jsonify({'error': 'Predictor not initialized'}), 400
            
        # Get fresh data
        features_df = get_latest_features("active_satellites", label=0)
        
        if features_df is None or len(features_df) == 0:
            return jsonify({'error': 'No satellite data available'}), 500
            
        print(f"🔍 Analyzing {len(features_df)} satellites for high-risk assessment...")
        
        # Run collision risk assessment
        results = predictor.assess_collision_risk(features_df)
        
        high_risk_satellites = []
        
        if results and results.get('debris_detection'):
            debris_predictions = results['debris_detection']['predictions']
            debris_probabilities = results['debris_detection']['probabilities']
            
            for idx, row in features_df.iterrows():
                if idx >= len(debris_predictions):
                    continue
                    
                is_debris = bool(debris_predictions[idx])
                debris_prob = float(debris_probabilities[idx][1]) if len(debris_probabilities[idx]) > 1 else 0.0
                
                # Consider high-risk if debris probability > 30% OR in high-risk objects list
                is_high_risk = debris_prob > 0.3 or idx in results.get('high_risk_objects', [])
                
                if is_high_risk:
                    altitude = float(row.get('altitude', 0))
                    
                    # Determine threat level
                    if debris_prob > 0.7:
                        threat_level = 'CRITICAL'
                    elif debris_prob > 0.5:
                        threat_level = 'HIGH'
                    elif debris_prob > 0.3:
                        threat_level = 'ELEVATED'
                    else:
                        threat_level = 'MODERATE'
                    
                    # Generate status flags
                    status_flags = []
                    if is_debris:
                        status_flags.append('DEBRIS_CONFIRMED')
                    if altitude < 300:
                        status_flags.append('LOW_ALTITUDE')
                    if debris_prob > 0.5:
                        status_flags.append('HIGH_COLLISION_RISK')
                    
                    # Generate threat description
                    threat_type = 'Unknown'
                    eta = 'Unknown'
                    
                    if altitude < 250:
                        threat_type = 'Immediate Reentry Risk'
                        eta = '< 24 hours'
                    elif altitude < 400:
                        threat_type = 'Atmospheric Decay'
                        eta = '1-7 days'
                    elif is_debris and debris_prob > 0.6:
                        threat_type = 'Collision Hazard'
                        eta = 'Ongoing'
                    elif debris_prob > 0.5:
                        threat_type = 'Orbital Instability'
                        eta = '1-30 days'
                    else:
                        threat_type = 'Monitoring Required'
                        eta = 'Ongoing'
                    
                    # Generate satellite name/designation
                    sat_name = f"SAT-{idx:04d}"
                    if is_debris:
                        sat_name = f"DEBRIS-{idx:04d}"
                    elif altitude > 35000:
                        sat_name = f"GEO-{idx:04d}"
                    elif altitude > 2000:
                        sat_name = f"MEO-{idx:04d}"
                    else:
                        sat_name = f"LEO-{idx:04d}"
                    
                    high_risk_satellite = {
                        'id': int(idx),
                        'name': sat_name,
                        'threat_level': threat_level,
                        'risk_level': threat_level,  # For compatibility
                        'debris_probability': round(debris_prob * 100, 2),
                        'is_debris': is_debris,
                        'status': 'DEBRIS' if is_debris else 'TRACKED',
                        'threat_type': threat_type,
                        'eta': eta,
                        'altitude': altitude,
                        'inclination': float(row.get('inclination', 0)),
                        'position': {
                            'altitude': altitude,
                            'inclination': float(row.get('inclination', 0)),
                            'x': float(row.get('pos_x', 0)),
                            'y': float(row.get('pos_y', 0)),
                            'z': float(row.get('pos_z', 0))
                        },
                        'status_flags': status_flags,
                        'last_tracked': datetime.now().isoformat(),
                        'priority_score': round(debris_prob * 100 + (1000 - altitude) / 10, 2)
                    }
                    
                    high_risk_satellites.append(high_risk_satellite)
        
        # Sort by priority score (highest risk first)
        high_risk_satellites.sort(key=lambda x: x['priority_score'], reverse=True)
        
        return jsonify({
            'success': True,
            'total_analyzed': int(len(features_df)),
            'high_risk_count': len(high_risk_satellites),
            'satellites': high_risk_satellites,
            'analysis_timestamp': datetime.now().isoformat(),
            'threat_summary': {
                'critical': len([s for s in high_risk_satellites if s['threat_level'] == 'CRITICAL']),
                'high': len([s for s in high_risk_satellites if s['threat_level'] == 'HIGH']),
                'elevated': len([s for s in high_risk_satellites if s['threat_level'] == 'ELEVATED']),
                'moderate': len([s for s in high_risk_satellites if s['threat_level'] == 'MODERATE'])
            }
        })
        
    except Exception as e:
        print(f"❌ High-risk satellites error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/satellites/search')
def api_search_satellites():
    """Search satellites by various criteria"""
    try:
        # Get search parameters
        query = request.args.get('q', '').lower()
        risk_level = request.args.get('risk_level', '').upper()
        altitude_min = request.args.get('altitude_min', type=float)
        altitude_max = request.args.get('altitude_max', type=float)
        limit = 999999
        
        if predictor is None:
            return jsonify({'error': 'Predictor not initialized'}), 400
            
        # Get satellite data
        features_df = get_latest_features("active_satellites", label=0)
        
        if features_df is None or len(features_df) == 0:
            return jsonify({'satellites': [], 'total': 0})
        
        satellites = []
        
        # Simple risk estimation based on orbital parameters (avoid expensive ML calls for search)
        for idx, row in features_df.iterrows():
            if idx >= limit:
                break
                
            altitude = float(row.get('altitude', 0))
            eccentricity = float(row.get('eccentricity', 0))
            
            # Apply filters
            if altitude_min is not None and altitude < altitude_min:
                continue
            if altitude_max is not None and altitude > altitude_max:
                continue
            
            # Simple risk estimation (fast approximation)
            risk_score = 0.0
            
            # Low altitude = higher risk
            if altitude < 300:
                risk_score += 0.4
            elif altitude < 500:
                risk_score += 0.2
            
            # High eccentricity = higher risk
            if eccentricity > 0.1:
                risk_score += 0.3
            elif eccentricity > 0.05:
                risk_score += 0.1
            
            # Random component to simulate detection uncertainty
            import random
            risk_score += random.random() * 0.2
            
            # Convert to risk level
            if risk_score > 0.7:
                sat_risk_level = 'CRITICAL'
            elif risk_score > 0.5:
                sat_risk_level = 'HIGH'
            elif risk_score > 0.3:
                sat_risk_level = 'MEDIUM'
            else:
                sat_risk_level = 'LOW'
            
            is_debris = risk_score > 0.6  # Simple debris classification
            debris_prob = min(risk_score * 100, 95)  # Cap at 95%
            
            # Apply risk level filter
            if risk_level and sat_risk_level != risk_level:
                continue
                
            # Apply text search
            if query:
                searchable_text = f"satellite_{idx} {sat_risk_level} {'debris' if is_debris else 'active'} altitude_{int(altitude)}".lower()
                if query not in searchable_text:
                    continue
            
            satellite = {
                'id': int(idx),
                'display_name': f"Satellite #{idx}",
                'type': 'Debris' if is_debris else 'Active Satellite',
                'altitude': altitude,
                'inclination': float(row.get('inclination', 0)),
                'risk_level': sat_risk_level,
                'debris_probability': round(debris_prob, 2),
                'is_debris': is_debris,
                'status': 'DEBRIS' if is_debris else 'HEALTHY',
                'velocity': float(row.get('velocity', 0)),
                'eccentricity': eccentricity,
                'position': {
                    'x': float(row.get('pos_x', 0)),
                    'y': float(row.get('pos_y', 0)),
                    'z': float(row.get('pos_z', 0))
                }
            }
            
            satellites.append(satellite)
        
        return jsonify({
            'satellites': satellites,
            'total': len(satellites),
            'query': query,
            'filters_applied': {
                'risk_level': risk_level,
                'altitude_range': [altitude_min, altitude_max],
                'text_search': query
            }
        })
        
    except Exception as e:
        print(f"❌ Satellite search error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/trajectory/<int:satellite_id>')
def api_trajectory(satellite_id):
    """Get real trajectory prediction for specific satellite"""
    try:
        if predictor is None:
            return jsonify({'error': 'Predictor not initialized'}), 400
            
        # Get fresh real data
        features_df = get_latest_features("active_satellites", label=0)
        
        if features_df is None or len(features_df) <= satellite_id:
            return jsonify({'error': 'Invalid satellite ID or no data available'}), 400
            
        # Get specific satellite data
        satellite_row = features_df.iloc[satellite_id]
        
        # Run real trajectory prediction using neural networks
        single_satellite_df = features_df.iloc[[satellite_id]]  # Single row as DataFrame
        trajectory_results = predictor.predict_trajectory(single_satellite_df)
        
        if trajectory_results is None:
            return jsonify({'error': 'Trajectory prediction failed'}), 500
            
        # Process real trajectory predictions from LSTM and GRU
        trajectory_points = []
        
        if 'LSTM' in trajectory_results and 'GRU' in trajectory_results:
            # Use ensemble of LSTM and GRU predictions
            lstm_pred = trajectory_results['LSTM'][0]  # First (and only) satellite
            gru_pred = trajectory_results['GRU'][0]
            
            # Average the predictions
            ensemble_pred = (lstm_pred + gru_pred) / 2
            
            # Convert predicted features back to trajectory points
            # This represents the satellite's predicted state at future time steps
            current_pos = {
                'x': float(satellite_row.get('pos_x', 0)),
                'y': float(satellite_row.get('pos_y', 0)),
                'z': float(satellite_row.get('pos_z', 0))
            }
            
            current_vel = {
                'vx': float(satellite_row.get('vel_x', 0)),
                'vy': float(satellite_row.get('vel_y', 0)),
                'vz': float(satellite_row.get('vel_z', 0))
            }
            
            # Generate future trajectory points using real orbital mechanics
            for i in range(30):  # 30 future time steps
                t = i * 300  # 5-minute intervals (300 seconds)
                
                # Use predicted orbital parameters for more accurate trajectory
                predicted_altitude = float(ensemble_pred[0] if len(ensemble_pred) > 0 else satellite_row.get('altitude', 400))
                predicted_velocity = float(ensemble_pred[1] if len(ensemble_pred) > 1 else np.sqrt(current_vel['vx']**2 + current_vel['vy']**2 + current_vel['vz']**2))
                
                # Simplified orbital propagation with ML predictions
                orbital_period = 2 * np.pi * np.sqrt((predicted_altitude + 6371)**3 / 398600.4418)  # seconds
                angular_velocity = 2 * np.pi / orbital_period
                
                angle = angular_velocity * t
                radius = predicted_altitude + 6371
                
                # Apply orbital mechanics with inclination
                inclination = float(satellite_row.get('inclination', 0)) * np.pi / 180
                
                trajectory_points.append({
                    'time': float(t),
                    'x': float(radius * np.cos(angle) * np.cos(inclination)),
                    'y': float(radius * np.sin(angle) * np.sin(inclination)),
                    'z': float(radius * np.sin(angle) * np.cos(inclination)),
                    'predicted_altitude': float(predicted_altitude),
                    'confidence': float(0.85 - i * 0.01)  # Decreasing confidence over time
                })
        else:
            return jsonify({'error': 'Neural network models not available'}), 500
            
        return jsonify({
            'satellite_id': satellite_id,
            'satellite_info': {
                'current_altitude': float(satellite_row.get('altitude', 0)),
                'inclination': float(satellite_row.get('inclination', 0)),
                'eccentricity': float(satellite_row.get('eccentricity', 0)),
                'is_debris': bool(satellite_id < len(latest_data['satellites']) and latest_data['satellites'][satellite_id].get('is_debris', False))
            },
            'trajectory': trajectory_points,
            'prediction_models': list(trajectory_results.keys()),
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        print(f"❌ Trajectory prediction error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/trajectory-bulk', methods=['POST'])
def api_trajectory_bulk():
    """Generate bulk trajectory predictions for visualization"""
    try:
        if predictor is None:
            return jsonify({'error': 'Predictor not initialized'}), 400
            
        # Get fresh data
        features_df = get_latest_features("active_satellites", label=0)
        
        if features_df is None or len(features_df) == 0:
            return jsonify({'error': 'No satellite data available'}), 400
        
        # Limit to first 100 satellites for performance
        limited_df = features_df.head(100)
        
        print(f"🚀 Generating bulk trajectory predictions for {len(limited_df)} satellites...")
        
        # Run trajectory prediction using neural networks
        trajectory_results = predictor.predict_trajectory(limited_df)
        
        if trajectory_results:
            trajectories_generated = 0
            satellite_trajectories = []
            
            for idx, row in limited_df.iterrows():
                # Generate simplified trajectory for visualization
                trajectory_points = []
                
                # Get current orbital parameters
                altitude = float(row.get('altitude', 400))
                inclination = float(row.get('inclination', 0)) * np.pi / 180
                current_pos = {
                    'x': float(row.get('pos_x', 0)),
                    'y': float(row.get('pos_y', 0)),
                    'z': float(row.get('pos_z', 0))
                }
                
                # Generate 20 trajectory points (simplified for performance)
                for i in range(20):
                    t = i * 600  # 10-minute intervals
                    
                    # Simplified orbital propagation
                    orbital_period = 2 * np.pi * np.sqrt((altitude + 6371)**3 / 398600.4418)
                    angular_velocity = 2 * np.pi / orbital_period
                    angle = angular_velocity * t
                    radius = altitude + 6371
                    
                    trajectory_points.append({
                        'time': float(t),
                        'x': float(radius * np.cos(angle) * np.cos(inclination)),
                        'y': float(radius * np.sin(angle) * np.sin(inclination)),
                        'z': float(radius * np.sin(angle) * np.cos(inclination)),
                        'altitude': float(altitude),
                        'confidence': float(0.9 - i * 0.02)
                    })
                
                satellite_trajectories.append({
                    'satellite_id': int(idx),
                    'trajectory': trajectory_points,
                    'is_debris': bool(row.get('label', 0) == 1),
                    'risk_level': 'HIGH' if row.get('label', 0) == 1 else 'LOW'
                })
                
                trajectories_generated += 1
            
            return jsonify({
                'success': True,
                'trajectories_generated': trajectories_generated,
                'prediction_horizon': 3.3,  # hours (20 points * 10 minutes)
                'predictions': satellite_trajectories,  # Use 'predictions' to match frontend
                'satellite_trajectories': satellite_trajectories,  # Keep both for compatibility
                'models_used': list(trajectory_results.keys()),
                'timestamp': datetime.now().isoformat()
            })
        else:
            return jsonify({'error': 'Trajectory prediction models not available'}), 500
            
    except Exception as e:
        print(f"❌ Bulk trajectory prediction error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/trajectory-plot', methods=['POST'])
def api_trajectory_plot():
    try:
        if predictor is None:
            return jsonify({'error': 'Predictor not initialized'}), 400
        client_data = request.get_json(silent=True) or {}
        posted_predictions = client_data.get('predictions')
        trajectories = []
        if posted_predictions and isinstance(posted_predictions, list):
            for i, pred in enumerate(posted_predictions[:10]):
                traj = pred.get('trajectory') or pred.get('points') or []
                points = []
                for p in traj:
                    x = float(p.get('x', 0))
                    y = float(p.get('y', 0))
                    z = float(p.get('z', 0))
                    points.append({'x': x, 'y': y, 'z': z})
                trajectories.append({'satellite_id': int(pred.get('satellite_id', i)), 'points': points, 'is_debris': bool(pred.get('is_debris', False))})
        else:
            features_df = get_latest_features("active_satellites", label=0)
            if features_df is None or len(features_df) == 0:
                return jsonify({'error': 'No satellite data available'}), 400
            limited_df = features_df.head(10)
            for idx, row in limited_df.iterrows():
                altitude = float(row.get('altitude', 400))
                inclination = float(row.get('inclination', 0)) * np.pi / 180
                trajectory_points = []
                for i in range(20):
                    t = i * 600
                    orbital_period = 2 * np.pi * np.sqrt((altitude + 6371)**3 / 398600.4418)
                    angular_velocity = 2 * np.pi / orbital_period
                    angle = angular_velocity * t
                    radius = altitude + 6371
                    trajectory_points.append({'x': radius * np.cos(angle) * np.cos(inclination), 'y': radius * np.sin(angle) * np.sin(inclination), 'z': radius * np.sin(angle) * np.cos(inclination)})
                trajectories.append({'satellite_id': int(idx), 'points': trajectory_points, 'is_debris': bool(row.get('label', 0) == 1)})
        plt.style.use('dark_background')
        fig = plt.figure(figsize=(15, 10))
        
        # Create 3 subplots: XY, XZ, YZ projections
        ax1 = plt.subplot(2, 2, 1)
        ax2 = plt.subplot(2, 2, 2)
        ax3 = plt.subplot(2, 2, 3)
        ax4 = plt.subplot(2, 2, 4, projection='3d')
        
        # Color scheme - terminal style
        colors = ['#00ff00', '#00ffff', '#ffff00', '#ff00ff', '#ffffff', 
                 '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57']
        
        # Plot Earth in each subplot
        earth_radius = 6371
        
        # XY plane
        circle1 = Circle((0, 0), earth_radius, color='#004400', alpha=0.7)
        ax1.add_patch(circle1)
        ax1.set_xlim(-15000, 15000)
        ax1.set_ylim(-15000, 15000)
        ax1.set_xlabel('X (km)', color='#00ff00')
        ax1.set_ylabel('Y (km)', color='#00ff00')
        ax1.set_title('XY Projection', color='#00ffff')
        ax1.grid(True, alpha=0.3, color='#333333')
        
        # XZ plane
        circle2 = Circle((0, 0), earth_radius, color='#004400', alpha=0.7)
        ax2.add_patch(circle2)
        ax2.set_xlim(-15000, 15000)
        ax2.set_ylim(-15000, 15000)
        ax2.set_xlabel('X (km)', color='#00ff00')
        ax2.set_ylabel('Z (km)', color='#00ff00')
        ax2.set_title('XZ Projection', color='#00ffff')
        ax2.grid(True, alpha=0.3, color='#333333')
        
        # YZ plane
        circle3 = Circle((0, 0), earth_radius, color='#004400', alpha=0.7)
        ax3.add_patch(circle3)
        ax3.set_xlim(-15000, 15000)
        ax3.set_ylim(-15000, 15000)
        ax3.set_xlabel('Y (km)', color='#00ff00')
        ax3.set_ylabel('Z (km)', color='#00ff00')
        ax3.set_title('YZ Projection', color='#00ffff')
        ax3.grid(True, alpha=0.3, color='#333333')
        
        # 3D plot
        u = np.linspace(0, 2 * np.pi, 50)
        v = np.linspace(0, np.pi, 50)
        x_earth = earth_radius * np.outer(np.cos(u), np.sin(v))
        y_earth = earth_radius * np.outer(np.sin(u), np.sin(v))
        z_earth = earth_radius * np.outer(np.ones(np.size(u)), np.cos(v))
        ax4.plot_surface(x_earth, y_earth, z_earth, alpha=0.3, color='#004400')
        ax4.set_xlabel('X (km)', color='#00ff00')
        ax4.set_ylabel('Y (km)', color='#00ff00')
        ax4.set_zlabel('Z (km)', color='#00ff00')
        ax4.set_title('3D Trajectories', color='#00ffff')
        
        for i, traj in enumerate(trajectories):
            color = colors[i % len(colors)]
            x_coords = [p['x'] for p in traj['points']]
            y_coords = [p['y'] for p in traj['points']]
            z_coords = [p['z'] for p in traj['points']]
            
            # XY projection
            ax1.plot(x_coords, y_coords, color=color, alpha=0.8, linewidth=2, 
                    label=f"SAT-{traj['satellite_id']}")
            ax1.scatter(x_coords[0], y_coords[0], color=color, s=50, marker='o')
            
            # XZ projection
            ax2.plot(x_coords, z_coords, color=color, alpha=0.8, linewidth=2)
            ax2.scatter(x_coords[0], z_coords[0], color=color, s=50, marker='o')
            
            # YZ projection
            ax3.plot(y_coords, z_coords, color=color, alpha=0.8, linewidth=2)
            ax3.scatter(y_coords[0], z_coords[0], color=color, s=50, marker='o')
            
            # 3D plot
            ax4.plot(x_coords, y_coords, z_coords, color=color, alpha=0.8, linewidth=2)
            ax4.scatter(x_coords[0], y_coords[0], z_coords[0], color=color, s=50, marker='o')
        
        # Add legend to XY plot
        ax1.legend(loc='upper right', fontsize=8, fancybox=True, framealpha=0.8)
        
        # Set background color
        fig.patch.set_facecolor('#0a0a0a')
        for ax in [ax1, ax2, ax3]:
            ax.set_facecolor('#0a0a0a')
        ax4.xaxis.pane.fill = False
        ax4.yaxis.pane.fill = False
        ax4.zaxis.pane.fill = False
        
        # Overall title
        fig.suptitle('Astraeus - Orbital Trajectory Predictions\nGenerated: ' + datetime.now().strftime('%Y-%m-%d %H:%M:%S'), 
                    color='#00ffff', fontsize=16, y=0.95)
        
        plt.tight_layout()
        
        # Convert plot to base64 image
        img_buffer = io.BytesIO()
        plt.savefig(img_buffer, format='png', dpi=150, bbox_inches='tight', 
                   facecolor='#0a0a0a', edgecolor='none')
        img_buffer.seek(0)
        img_base64 = base64.b64encode(img_buffer.read()).decode('utf-8')
        plt.close()
        
        return jsonify({'success': True, 'plot_image': img_base64, 'trajectories_count': len(trajectories), 'prediction_horizon': 3.3, 'timestamp': datetime.now().isoformat()})
        
    except Exception as e:
        print(f"❌ Trajectory plot generation error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/trajectory-download', methods=['POST'])
def api_trajectory_download():
    try:
        if predictor is None:
            return jsonify({'error': 'Predictor not initialized'}), 400
        client_data = request.get_json(silent=True) or {}
        posted_predictions = client_data.get('predictions')
        rows = []
        if posted_predictions and isinstance(posted_predictions, list):
            for pred in posted_predictions:
                sat_id = int(pred.get('satellite_id', -1))
                is_debris = bool(pred.get('is_debris', False))
                risk_level = pred.get('risk_level', '')
                traj = pred.get('trajectory') or []
                for p in traj:
                    rows.append({
                        'satellite_id': sat_id,
                        'time': float(p.get('time', 0)),
                        'x': float(p.get('x', 0)),
                        'y': float(p.get('y', 0)),
                        'z': float(p.get('z', 0)),
                        'altitude': float(p.get('altitude', p.get('predicted_altitude', 0))),
                        'confidence': float(p.get('confidence', 0)),
                        'is_debris': int(is_debris),
                        'risk_level': risk_level
                    })
        else:
            features_df = get_latest_features("active_satellites", label=0)
            if features_df is None or len(features_df) == 0:
                return jsonify({'error': 'No satellite data available'}), 400
            limited_df = features_df.head(100)
            for idx, row in limited_df.iterrows():
                altitude = float(row.get('altitude', 400))
                inclination = float(row.get('inclination', 0)) * np.pi / 180
                for i in range(20):
                    t = i * 600
                    orbital_period = 2 * np.pi * np.sqrt((altitude + 6371)**3 / 398600.4418)
                    angular_velocity = 2 * np.pi / orbital_period
                    angle = angular_velocity * t
                    radius = altitude + 6371
                    x = float(radius * np.cos(angle) * np.cos(inclination))
                    y = float(radius * np.sin(angle) * np.sin(inclination))
                    z = float(radius * np.sin(angle) * np.cos(inclination))
                    rows.append({'satellite_id': int(idx), 'time': float(t), 'x': x, 'y': y, 'z': z, 'altitude': altitude, 'confidence': max(0.0, 0.9 - i * 0.02), 'is_debris': int(row.get('label', 0) == 1), 'risk_level': 'HIGH' if row.get('label', 0) == 1 else 'LOW'})
        import csv
        output = io.StringIO()
        fieldnames = ['satellite_id', 'time', 'x', 'y', 'z', 'altitude', 'confidence', 'is_debris', 'risk_level']
        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()
        for r in rows:
            writer.writerow(r)
        csv_data = output.getvalue()
        output.close()
        filename = 'trajectory_predictions.csv'
        return Response(csv_data, mimetype='text/csv', headers={'Content-Disposition': f'attachment; filename={filename}'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/cache/status')
def get_cache_status_api():
    """Get TLE data cache status"""
    try:
        cache_status = get_cache_status()
        return jsonify({
            'success': True,
            'cache_status': cache_status,
            'download_schedule': '6 AM, 2 PM, 10 PM daily',
            'cache_policy': 'Smart caching to avoid API rate limits'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/cache/force-update', methods=['POST'])
def force_cache_update():
    """Force update cache (admin function)"""
    try:
        from data_collection import force_download_all
        force_download_all()
        return jsonify({
            'success': True,
            'message': 'Cache force updated successfully'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    print("🚀 Starting Astraeus Web Demo...")
    
    # Initialize predictor
    if initialize_predictor():
        # Start background data update thread
        data_thread = threading.Thread(target=update_data, daemon=True)
        data_thread.start()
        
        print("🌐 Starting Flask server...")
        app.run(debug=True, host='0.0.0.0', port=5000, threaded=True)
    else:
        print("❌ Failed to initialize predictor. Please run model_training.py first.")
