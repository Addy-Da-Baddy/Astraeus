# orbital_pipeline/trajectory_prediction.py
import torch
import torch.nn as nn
import pandas as pd
import joblib
import os
import numpy as np
from model_training import TrajRNN

device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
print(f"Using device: {device}")

# Load data and scaler
df = pd.read_csv("orbital_features.csv")
feature_cols = df.drop(columns=['label']).columns
X = df[feature_cols].values
scaler = joblib.load("saved_models/scaler.pkl")
X_scaled = scaler.transform(X)
X_tensor = torch.tensor(X_scaled, dtype=torch.float32).unsqueeze(1).to(device)

# Load trajectory models
input_size = X_scaled.shape[1]
lstm_model = TrajRNN(input_size, rnn_type='LSTM').to(device)
gru_model = TrajRNN(input_size, rnn_type='GRU').to(device)
lstm_model.load_state_dict(torch.load("saved_models/lstm_traj.pth", map_location=device))
gru_model.load_state_dict(torch.load("saved_models/gru_traj.pth", map_location=device))
lstm_model.eval()
gru_model.eval()

# Ensemble prediction
with torch.no_grad():
    pred_lstm = lstm_model(X_tensor)
    pred_gru = gru_model(X_tensor)
    traj_pred = (pred_lstm + pred_gru) / 2

traj_pred_np = traj_pred.cpu().numpy()
print("Trajectory predictions shape:", traj_pred_np.shape)

# -----------------------------
# Apply simple Kalman Filter
# -----------------------------
def kalman_filter(predictions, R=0.01, Q=0.001):
    """
    Simple 1D Kalman Filter for each feature independently.
    predictions: np.array (N_samples, N_features)
    R: Measurement noise
    Q: Process noise
    """
    N, F = predictions.shape
    x_est = np.zeros_like(predictions)
    P = np.ones(F)  # initial estimate error covariance

    x_est[0] = predictions[0]  # first estimate

    for t in range(1, N):
        # Predict step
        x_pred = x_est[t-1]
        P_pred = P + Q

        # Update step
        K = P_pred / (P_pred + R)
        x_est[t] = x_pred + K * (predictions[t] - x_pred)
        P = (1 - K) * P_pred

    return x_est

traj_pred_kf = kalman_filter(traj_pred_np)

# Save predictions for visualization
os.makedirs("saved_models/predictions", exist_ok=True)
pd.DataFrame(traj_pred_np, columns=feature_cols).to_csv(
    "saved_models/predictions/trajectory_pred_raw.csv", index=False
)
pd.DataFrame(traj_pred_kf, columns=feature_cols).to_csv(
    "saved_models/predictions/trajectory_pred_kf.csv", index=False
)
print("Trajectory predictions saved (raw + Kalman Filtered).")
