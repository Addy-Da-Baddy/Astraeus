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
                        'id': idx,
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
                        if i < len(satellites) and is_debris:
                            satellites[i]['is_debris'] = True
                
                # Update global data
                latest_data.update({
                    'timestamp': datetime.now().isoformat(),
                    'total_objects': results['total_objects'],
                    'debris_count': results['debris_detection']['debris_count'] if results['debris_detection'] else 0,
                    'high_risk_count': len(results['high_risk_objects']),
                    'collision_probability': round(results['collision_probability'], 4),
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
    return jsonify(latest_data)

@app.route('/api/satellites')
def api_satellites():
    """Get satellite positions for 3D visualization"""
    return jsonify({
        'satellites': latest_data['satellites'],
        'timestamp': latest_data['timestamp']
    })

@app.route('/api/debris')
def api_debris():
    """Get debris objects only"""
    debris = [sat for sat in latest_data['satellites'] if sat['is_debris']]
    return jsonify({
        'debris': debris,
        'count': len(debris),
        'timestamp': latest_data['timestamp']
    })

@app.route('/api/predict', methods=['POST'])
def api_predict():
    """Manual prediction endpoint"""
    try:
        if predictor is None:
            return jsonify({'error': 'Predictor not initialized'}), 500
            
        # Get fresh data
        features_df = get_latest_features("active_satellites", label=0)
        
        if features_df is not None and len(features_df) > 0:
            results = predictor.assess_collision_risk(features_df)
            
            return jsonify({
                'success': True,
                'timestamp': datetime.now().isoformat(),
                'total_objects': results['total_objects'],
                'debris_count': results['debris_detection']['debris_count'] if results['debris_detection'] else 0,
                'high_risk_count': len(results['high_risk_objects']),
                'collision_probability': results['collision_probability'],
                'message': 'Prediction completed successfully'
            })
        else:
            return jsonify({'error': 'Failed to fetch satellite data'}), 500
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/trajectory/<int:satellite_id>')
def api_trajectory(satellite_id):
    """Get trajectory prediction for specific satellite"""
    try:
        if predictor is None or satellite_id >= len(latest_data['satellites']):
            return jsonify({'error': 'Invalid request'}), 400
            
        # Generate sample trajectory points (in real implementation, use actual trajectory prediction)
        satellite = latest_data['satellites'][satellite_id]
        trajectory_points = []
        
        for i in range(20):  # 20 future points
            t = i * 300  # 5-minute intervals
            # Simple orbital propagation simulation
            trajectory_points.append({
                'time': t,
                'x': satellite['x'] + satellite['vx'] * t * 0.001,
                'y': satellite['y'] + satellite['vy'] * t * 0.001,
                'z': satellite['z'] + satellite['vz'] * t * 0.001
            })
            
        return jsonify({
            'satellite_id': satellite_id,
            'trajectory': trajectory_points,
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
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
