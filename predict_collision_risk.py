# orbital_pipeline/predict_collision_risk.py
import os
import numpy as np
import pandas as pd
import joblib
import torch
import torch.nn as nn
from datetime import datetime
import time
from data_collection import get_latest_features
from model_training import TrajRNN

class CollisionRiskPredictor:
    def __init__(self, models_dir="saved_models"):
        self.models_dir = models_dir
        self.scaler = None
        self.detection_models = {}
        self.trajectory_models = {}
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        
        # Load all trained models
        self.load_models()
    
    def load_models(self):
        """Load all pre-trained models and scaler"""
        try:
            # Load scaler
            scaler_path = os.path.join(self.models_dir, "scaler.pkl")
            if os.path.exists(scaler_path):
                self.scaler = joblib.load(scaler_path)
                print("✅ Scaler loaded")
            else:
                print("⚠️ Scaler not found!")
                return
            
            # Load detection models
            detection_models = ["RF", "XGB", "LGBM", "CatBoost"]
            for model_name in detection_models:
                model_path = os.path.join(self.models_dir, f"{model_name}_detection.pkl")
                if os.path.exists(model_path):
                    self.detection_models[model_name] = joblib.load(model_path)
                    print(f"✅ {model_name} detection model loaded")
                else:
                    print(f"⚠️ {model_name} detection model not found!")
            
            # Load trajectory models (PyTorch)
            self.load_trajectory_models()
            
        except Exception as e:
            print(f"❌ Error loading models: {e}")
    
    def load_trajectory_models(self):
        """Load PyTorch trajectory models"""
        try:
            # Determine input size from a sample
            sample_features = self.get_sample_features()
            if sample_features is not None:
                input_size = sample_features.shape[1]
                
                # Load LSTM model
                lstm_path = os.path.join(self.models_dir, "lstm_traj.pth")
                if os.path.exists(lstm_path):
                    lstm_model = TrajRNN(input_size, rnn_type='LSTM').to(self.device)
                    lstm_model.load_state_dict(torch.load(lstm_path, map_location=self.device))
                    lstm_model.eval()
                    self.trajectory_models['LSTM'] = lstm_model
                    print("✅ LSTM trajectory model loaded")
                
                # Load GRU model
                gru_path = os.path.join(self.models_dir, "gru_traj.pth")
                if os.path.exists(gru_path):
                    gru_model = TrajRNN(input_size, rnn_type='GRU').to(self.device)
                    gru_model.load_state_dict(torch.load(gru_path, map_location=self.device))
                    gru_model.eval()
                    self.trajectory_models['GRU'] = gru_model
                    print("✅ GRU trajectory model loaded")
                    
        except Exception as e:
            print(f"⚠️ Error loading trajectory models: {e}")
    
    def get_sample_features(self):
        """Get sample features to determine input size"""
        try:
            # Try to get a small sample of features
            sample_df = get_latest_features("active_satellites", label=0)
            if sample_df is not None and len(sample_df) > 0:
                features = sample_df.drop(columns=['label'], errors='ignore')
                return self.scaler.transform(features) if self.scaler else features.values
        except:
            pass
        return None
    
    def predict_debris_detection(self, features_df):
        """Predict if objects are debris using ensemble of detection models"""
        if not self.detection_models or self.scaler is None:
            print("❌ Detection models or scaler not loaded!")
            return None
        
        try:
            # Prepare features
            X = features_df.drop(columns=['label'], errors='ignore').values
            X_scaled = self.scaler.transform(X)
            
            # Get predictions from all models
            predictions = []
            probabilities = []
            
            for model_name, model in self.detection_models.items():
                try:
                    pred = model.predict(X_scaled)
                    prob = model.predict_proba(X_scaled)
                    predictions.append(pred)
                    probabilities.append(prob)
                    print(f"📊 {model_name}: {np.sum(pred)} debris detected out of {len(pred)} objects")
                except Exception as e:
                    print(f"⚠️ Error with {model_name}: {e}")
            
            if predictions:
                # Ensemble prediction (majority vote)
                ensemble_pred = np.mean(predictions, axis=0)
                ensemble_pred_binary = (ensemble_pred > 0.5).astype(int)
                
                # Ensemble probability (average)
                ensemble_prob = np.mean(probabilities, axis=0)
                
                return {
                    'predictions': ensemble_pred_binary,
                    'probabilities': ensemble_prob,
                    'debris_count': np.sum(ensemble_pred_binary),
                    'total_objects': len(ensemble_pred_binary)
                }
            
        except Exception as e:
            print(f"❌ Error in debris detection: {e}")
            return None
    
    def predict_trajectory(self, features_df):
        """Predict future trajectories using RNN models"""
        if not self.trajectory_models or self.scaler is None:
            print("❌ Trajectory models or scaler not loaded!")
            return None
        
        try:
            # Prepare features
            X = features_df.drop(columns=['label'], errors='ignore').values
            X_scaled = self.scaler.transform(X)
            X_tensor = torch.tensor(X_scaled, dtype=torch.float32).unsqueeze(1).to(self.device)
            
            predictions = {}
            
            for model_name, model in self.trajectory_models.items():
                try:
                    with torch.no_grad():
                        pred = model(X_tensor)
                        predictions[model_name] = pred.cpu().numpy()
                        print(f"🚀 {model_name}: Predicted trajectories for {len(pred)} objects")
                except Exception as e:
                    print(f"⚠️ Error with {model_name}: {e}")
            
            return predictions
            
        except Exception as e:
            print(f"❌ Error in trajectory prediction: {e}")
            return None
    
    def assess_collision_risk(self, features_df):
        """Complete collision risk assessment"""
        print(f"\n🔍 Assessing collision risk for {len(features_df)} objects...")
        print(f"⏰ Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S UTC')}")
        
        results = {
            'timestamp': datetime.now(),
            'total_objects': len(features_df),
            'debris_detection': None,
            'trajectory_prediction': None,
            'high_risk_objects': [],
            'collision_probability': 0.0
        }
        
        # 1. Debris Detection
        print("\n1️⃣ Running debris detection...")
        debris_results = self.predict_debris_detection(features_df)
        if debris_results:
            results['debris_detection'] = debris_results
            print(f"   🗑️ Debris detected: {debris_results['debris_count']}/{debris_results['total_objects']}")
        
        # 2. Trajectory Prediction
        print("\n2️⃣ Running trajectory prediction...")
        traj_results = self.predict_trajectory(features_df)
        if traj_results:
            results['trajectory_prediction'] = traj_results
            print(f"   🎯 Trajectories predicted using {len(traj_results)} models")
        
        # 3. Risk Assessment
        print("\n3️⃣ Computing collision risk...")
        if debris_results and traj_results:
            # Simple risk assessment based on debris probability and orbital parameters
            high_risk_threshold = 0.7
            debris_probs = debris_results['probabilities'][:, 1]  # Probability of being debris
            
            # Check for objects in similar orbits (simplified)
            altitudes = features_df['altitude'].values if 'altitude' in features_df.columns else []
            
            high_risk_indices = []
            for i, prob in enumerate(debris_probs):
                if prob > high_risk_threshold:
                    high_risk_indices.append(i)
            
            results['high_risk_objects'] = high_risk_indices
            results['collision_probability'] = len(high_risk_indices) / len(features_df) * 100
            
            print(f"   ⚠️ High-risk objects: {len(high_risk_indices)}")
            print(f"   📈 Overall collision probability: {results['collision_probability']:.2f}%")
        
        return results
    
    def run_continuous_monitoring(self, interval_minutes=30):
        """Run continuous collision risk monitoring"""
        print(f"🚀 Starting continuous collision risk monitoring...")
        print(f"📡 Fetching data every {interval_minutes} minutes")
        print("Press Ctrl+C to stop")
        
        try:
            while True:
                print("\n" + "="*60)
                
                # Get latest satellite data
                features_df = get_latest_features("active_satellites", label=0)
                
                if features_df is not None and len(features_df) > 0:
                    # Run collision risk assessment
                    risk_results = self.assess_collision_risk(features_df)
                    
                    # Log results
                    self.log_results(risk_results)
                    
                    # Alert if high risk
                    if risk_results['collision_probability'] > 5.0:  # 5% threshold
                        print(f"\n🚨 HIGH COLLISION RISK ALERT! 🚨")
                        print(f"   Probability: {risk_results['collision_probability']:.2f}%")
                        print(f"   High-risk objects: {len(risk_results['high_risk_objects'])}")
                else:
                    print("❌ Failed to fetch satellite data")
                
                # Wait for next update
                print(f"\n💤 Waiting {interval_minutes} minutes for next update...")
                time.sleep(interval_minutes * 60)
                
        except KeyboardInterrupt:
            print("\n🛑 Monitoring stopped by user")
    
    def log_results(self, results):
        """Log results to file"""
        try:
            log_file = "collision_risk_log.csv"
            
            # Create log entry
            log_entry = {
                'timestamp': results['timestamp'],
                'total_objects': results['total_objects'],
                'debris_count': results['debris_detection']['debris_count'] if results['debris_detection'] else 0,
                'high_risk_count': len(results['high_risk_objects']),
                'collision_probability': results['collision_probability']
            }
            
            # Append to CSV
            log_df = pd.DataFrame([log_entry])
            if os.path.exists(log_file):
                log_df.to_csv(log_file, mode='a', header=False, index=False)
            else:
                log_df.to_csv(log_file, index=False)
                
        except Exception as e:
            print(f"⚠️ Error logging results: {e}")

# --------------------------
# Main execution
# --------------------------
if __name__ == "__main__":
    # Initialize predictor
    predictor = CollisionRiskPredictor()
    
    print("\n🛰️ Orbital Collision Risk Prediction System")
    print("==========================================")
    
    # Check if models loaded successfully
    if not predictor.detection_models and not predictor.trajectory_models:
        print("❌ No models loaded! Please run model_training.py first.")
        exit(1)
    
    # Options for running
    print("\nSelect mode:")
    print("1. Single prediction run")
    print("2. Continuous monitoring")
    
    try:
        choice = input("\nEnter choice (1 or 2): ").strip()
        
        if choice == "1":
            # Single run
            print("\n📡 Fetching latest satellite data...")
            features_df = get_latest_features("active_satellites", label=0)
            
            if features_df is not None and len(features_df) > 0:
                results = predictor.assess_collision_risk(features_df)
                print(f"\n✅ Analysis complete!")
                print(f"📊 Results logged to collision_risk_log.csv")
            else:
                print("❌ Failed to fetch satellite data")
        
        elif choice == "2":
            # Continuous monitoring
            interval = input("Enter monitoring interval in minutes (default: 30): ").strip()
            interval = int(interval) if interval.isdigit() else 30
            predictor.run_continuous_monitoring(interval)
        
        else:
            print("Invalid choice!")
    
    except KeyboardInterrupt:
        print("\n👋 Goodbye!")
    except Exception as e:
        print(f"❌ Error: {e}")