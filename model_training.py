# orbital_pipeline/model_training.py
import os
import pandas as pd
import numpy as np
from tqdm import tqdm
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from imblearn.over_sampling import SMOTE
from sklearn.metrics import accuracy_score, classification_report
from sklearn.ensemble import RandomForestClassifier
import xgboost as xgb
import lightgbm as lgb
from catboost import CatBoostClassifier
import joblib

# --------------------------
# Paths to save models
# --------------------------
os.makedirs("saved_models", exist_ok=True)

# --------------------------
# RNN for trajectory prediction
# --------------------------
class TrajRNN(nn.Module):
    def __init__(self, input_size, hidden_size=64, num_layers=2, rnn_type='LSTM'):
        super().__init__()
        self.rnn_type = rnn_type
        if rnn_type=='LSTM':
            self.rnn = nn.LSTM(input_size, hidden_size, num_layers, batch_first=True)
        else:
            self.rnn = nn.GRU(input_size, hidden_size, num_layers, batch_first=True)
        self.fc = nn.Linear(hidden_size, input_size)

    def forward(self, x):
        out, _ = self.rnn(x)
        out = self.fc(out[:, -1, :])
        return out

# --------------------------
# Functions
# --------------------------
def load_dataset():
    df = pd.read_csv("orbital_features.csv")
    X = df.drop(columns=['label']).values
    y = df['label'].values
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    return train_test_split(X_scaled, y, test_size=0.2, random_state=42, stratify=y), scaler

def train_detection_ensemble(X_train, y_train, X_test, y_test):
    sm = SMOTE(random_state=42)
    X_train_bal, y_train_bal = sm.fit_resample(X_train, y_train)

    rf = RandomForestClassifier(n_estimators=200, random_state=42)
    xgb_clf = xgb.XGBClassifier(n_estimators=200, learning_rate=0.05, use_label_encoder=False, eval_metric='logloss')
    lgbm_clf = lgb.LGBMClassifier(n_estimators=200, learning_rate=0.05)
    cat_clf = CatBoostClassifier(iterations=200, learning_rate=0.05, verbose=0, random_state=42)

    for clf, name in zip([rf, xgb_clf, lgbm_clf, cat_clf], ["RF", "XGB", "LGBM", "CatBoost"]):
        print(f"Fitting {name}...")
        clf.fit(X_train_bal, y_train_bal)
        joblib.dump(clf, f"saved_models/{name}_detection.pkl")

    # Ensemble prediction
    probs = np.mean(
        np.array([
            rf.predict_proba(X_test),
            xgb_clf.predict_proba(X_test),
            lgbm_clf.predict_proba(X_test),
            cat_clf.predict_proba(X_test)
        ]), axis=0
    )
    y_pred = np.argmax(probs, axis=1)
    print("Detection Ensemble Accuracy:", accuracy_score(y_test, y_pred))
    print(classification_report(y_test, y_pred))

def train_trajectory_models(X_train, X_test, device=torch.device('cpu'), epochs=30, batch_size=64):
    X_train_tensor = torch.tensor(X_train, dtype=torch.float32).unsqueeze(1).to(device)
    X_test_tensor = torch.tensor(X_test, dtype=torch.float32).unsqueeze(1).to(device)
    train_dataset = TensorDataset(X_train_tensor, X_train_tensor)
    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True)

    input_size = X_train_tensor.shape[2]
    lstm_model = TrajRNN(input_size, rnn_type='LSTM').to(device)
    gru_model = TrajRNN(input_size, rnn_type='GRU').to(device)
    criterion = nn.MSELoss()
    lstm_optimizer = torch.optim.Adam(lstm_model.parameters(), lr=0.001)
    gru_optimizer = torch.optim.Adam(gru_model.parameters(), lr=0.001)

    print("Training trajectory models...")
    for epoch in range(epochs):
        lstm_model.train()
        gru_model.train()
        total_loss_lstm = 0
        total_loss_gru = 0
        for xb, yb in tqdm(train_loader, desc=f"Epoch {epoch+1}/{epochs}"):
            xb, yb = xb.to(device), yb.to(device)
            # LSTM
            lstm_optimizer.zero_grad()
            out_lstm = lstm_model(xb)
            loss_lstm = criterion(out_lstm, yb.squeeze(1))
            loss_lstm.backward()
            lstm_optimizer.step()
            total_loss_lstm += loss_lstm.item()
            # GRU
            gru_optimizer.zero_grad()
            out_gru = gru_model(xb)
            loss_gru = criterion(out_gru, yb.squeeze(1))
            loss_gru.backward()
            gru_optimizer.step()
            total_loss_gru += loss_gru.item()
        print(f"Epoch {epoch+1}: LSTM Loss={total_loss_lstm/len(train_loader):.6f}, GRU Loss={total_loss_gru/len(train_loader):.6f}")

    torch.save(lstm_model.state_dict(), "saved_models/lstm_traj.pth")
    torch.save(gru_model.state_dict(), "saved_models/gru_traj.pth")
    print("Trajectory models saved.")

# --------------------------
# Main
# --------------------------
if __name__ == "__main__":
    (X_train, X_test, y_train, y_test), scaler = load_dataset()
    joblib.dump(scaler, "saved_models/scaler.pkl")
    train_detection_ensemble(X_train, y_train, X_test, y_test)
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    train_trajectory_models(X_train, X_test, device=device)
