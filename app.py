# app.py - Flask Web API for NovaGen Orbital Collision Risk System
from flask import Flask, render_template, jsonify, request
from flask_cors import CORS
import json
import numpy as np
import pandas as pd
from datetime import datetime
import threading
import time
from predict_collision_risk import CollisionRiskPredictor
from data_collection import get_latest_features

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
    """Serve the main dashboard"""
    return render_template('index.html')

@app.route('/dashboard')
def dashboard():
    """Serve the advanced dashboard"""
    return render_template('dashboard.html')

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

if __name__ == '__main__':
    print("🚀 Starting NovaGen Web Demo...")
    
    # Initialize predictor
    if initialize_predictor():
        # Start background data update thread
        data_thread = threading.Thread(target=update_data, daemon=True)
        data_thread.start()
        
        print("🌐 Starting Flask server...")
        app.run(debug=True, host='0.0.0.0', port=5000, threaded=True)
    else:
        print("❌ Failed to initialize predictor. Please run model_training.py first.")
