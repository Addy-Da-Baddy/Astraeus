# orbital_pipeline/model_training.py
import os
import pandas as pd
import numpy as np
from tqdm import tqdm
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.preprocessing import StandardScaler
from imblearn.over_sampling import SMOTE
from sklearn.metrics import (accuracy_score, classification_report, confusion_matrix, 
                           roc_curve, auc, precision_recall_curve, f1_score, 
                           precision_score, recall_score, mean_squared_error, 
                           mean_absolute_error, r2_score)
from sklearn.ensemble import RandomForestClassifier
import xgboost as xgb
import lightgbm as lgb
from catboost import CatBoostClassifier
import joblib
import matplotlib.pyplot as plt
import seaborn as sns
from itertools import cycle
import json
from datetime import datetime

# --------------------------
# Create directories
# --------------------------
os.makedirs("saved_models", exist_ok=True)
os.makedirs("train_metrics", exist_ok=True)

# Set style for plots
plt.style.use('seaborn-v0_8')
sns.set_palette("husl")

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
# Visualization Functions
# --------------------------
def plot_confusion_matrix(y_true, y_pred, model_name, save_path):
    """Plot and save confusion matrix"""
    cm = confusion_matrix(y_true, y_pred)
    plt.figure(figsize=(8, 6))
    sns.heatmap(cm, annot=True, fmt='d', cmap='Blues', 
                xticklabels=['Normal', 'Debris'], 
                yticklabels=['Normal', 'Debris'])
    plt.title(f'Confusion Matrix - {model_name}')
    plt.xlabel('Predicted')
    plt.ylabel('Actual')
    plt.tight_layout()
    plt.savefig(f"{save_path}/confusion_matrix_{model_name.lower()}.png", dpi=300, bbox_inches='tight')
    plt.close()

def plot_roc_curves(models_data, save_path):
    """Plot ROC curves for all models"""
    plt.figure(figsize=(10, 8))
    colors = cycle(['aqua', 'darkorange', 'cornflowerblue', 'red', 'green'])
    
    for (model_name, y_true, y_proba), color in zip(models_data, colors):
        fpr, tpr, _ = roc_curve(y_true, y_proba[:, 1])
        roc_auc = auc(fpr, tpr)
        plt.plot(fpr, tpr, color=color, lw=2,
                label=f'{model_name} (AUC = {roc_auc:.3f})')
    
    plt.plot([0, 1], [0, 1], 'k--', lw=2)
    plt.xlim([0.0, 1.0])
    plt.ylim([0.0, 1.05])
    plt.xlabel('False Positive Rate')
    plt.ylabel('True Positive Rate')
    plt.title('ROC Curves - Detection Models')
    plt.legend(loc="lower right")
    plt.grid(alpha=0.3)
    plt.tight_layout()
    plt.savefig(f"{save_path}/roc_curves.png", dpi=300, bbox_inches='tight')
    plt.close()

def plot_precision_recall_curves(models_data, save_path):
    """Plot Precision-Recall curves for all models"""
    plt.figure(figsize=(10, 8))
    colors = cycle(['aqua', 'darkorange', 'cornflowerblue', 'red', 'green'])
    
    for (model_name, y_true, y_proba), color in zip(models_data, colors):
        precision, recall, _ = precision_recall_curve(y_true, y_proba[:, 1])
        avg_precision = auc(recall, precision)
        plt.plot(recall, precision, color=color, lw=2,
                label=f'{model_name} (AP = {avg_precision:.3f})')
    
    plt.xlim([0.0, 1.0])
    plt.ylim([0.0, 1.05])
    plt.xlabel('Recall')
    plt.ylabel('Precision')
    plt.title('Precision-Recall Curves - Detection Models')
    plt.legend(loc="lower left")
    plt.grid(alpha=0.3)
    plt.tight_layout()
    plt.savefig(f"{save_path}/precision_recall_curves.png", dpi=300, bbox_inches='tight')
    plt.close()

def plot_feature_importance(model, feature_names, model_name, save_path):
    """Plot feature importance for tree-based models"""
    if hasattr(model, 'feature_importances_'):
        importance = model.feature_importances_
        indices = np.argsort(importance)[::-1][:20]  # Top 20 features
        
        plt.figure(figsize=(12, 8))
        plt.title(f'Feature Importance - {model_name}')
        plt.bar(range(len(indices)), importance[indices])
        plt.xticks(range(len(indices)), [feature_names[i] for i in indices], rotation=45, ha='right')
        plt.ylabel('Importance')
        plt.tight_layout()
        plt.savefig(f"{save_path}/feature_importance_{model_name.lower()}.png", dpi=300, bbox_inches='tight')
        plt.close()

def plot_model_comparison(metrics_dict, save_path):
    """Plot comparison of model performance metrics"""
    models = list(metrics_dict.keys())
    metrics = ['accuracy', 'precision', 'recall', 'f1', 'roc_auc']
    
    fig, axes = plt.subplots(2, 3, figsize=(18, 12))
    axes = axes.flatten()
    
    for i, metric in enumerate(metrics):
        values = [metrics_dict[model][metric] for model in models]
        bars = axes[i].bar(models, values, color=['skyblue', 'lightcoral', 'lightgreen', 'gold', 'plum'][:len(models)])
        axes[i].set_title(f'{metric.title()} Comparison')
        axes[i].set_ylabel(metric.title())
        axes[i].set_ylim(0, 1)
        
        # Add value labels on bars
        for bar, value in zip(bars, values):
            axes[i].text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.01,
                        f'{value:.3f}', ha='center', va='bottom')
        
        axes[i].tick_params(axis='x', rotation=45)
    
    # Remove empty subplot
    axes[-1].remove()
    
    plt.tight_layout()
    plt.savefig(f"{save_path}/model_comparison.png", dpi=300, bbox_inches='tight')
    plt.close()

def plot_training_history(train_losses_lstm, train_losses_gru, save_path):
    """Plot training history for RNN models"""
    plt.figure(figsize=(12, 8))
    
    plt.subplot(2, 1, 1)
    plt.plot(train_losses_lstm, label='LSTM', color='blue', linewidth=2)
    plt.plot(train_losses_gru, label='GRU', color='red', linewidth=2)
    plt.title('Training Loss Over Epochs')
    plt.xlabel('Epoch')
    plt.ylabel('MSE Loss')
    plt.legend()
    plt.grid(alpha=0.3)
    
    plt.subplot(2, 1, 2)
    plt.plot(np.log(train_losses_lstm), label='LSTM (log)', color='blue', linewidth=2)
    plt.plot(np.log(train_losses_gru), label='GRU (log)', color='red', linewidth=2)
    plt.title('Training Loss Over Epochs (Log Scale)')
    plt.xlabel('Epoch')
    plt.ylabel('Log MSE Loss')
    plt.legend()
    plt.grid(alpha=0.3)
    
    plt.tight_layout()
    plt.savefig(f"{save_path}/training_history.png", dpi=300, bbox_inches='tight')
    plt.close()

def plot_trajectory_predictions(models, X_test, save_path, device, n_samples=5):
    """Plot trajectory predictions vs actual"""
    X_test_tensor = torch.tensor(X_test[:n_samples], dtype=torch.float32).unsqueeze(1).to(device)
    
    fig, axes = plt.subplots(n_samples, 2, figsize=(15, 3*n_samples))
    
    with torch.no_grad():
        lstm_preds = models['lstm'](X_test_tensor).cpu().numpy()
        gru_preds = models['gru'](X_test_tensor).cpu().numpy()
    
    for i in range(n_samples):
        # LSTM predictions
        axes[i, 0].plot(X_test[i], label='Actual', linewidth=2)
        axes[i, 0].plot(lstm_preds[i], label='LSTM Prediction', linewidth=2, linestyle='--')
        axes[i, 0].set_title(f'Sample {i+1} - LSTM Prediction')
        axes[i, 0].legend()
        axes[i, 0].grid(alpha=0.3)
        
        # GRU predictions
        axes[i, 1].plot(X_test[i], label='Actual', linewidth=2)
        axes[i, 1].plot(gru_preds[i], label='GRU Prediction', linewidth=2, linestyle='--')
        axes[i, 1].set_title(f'Sample {i+1} - GRU Prediction')
        axes[i, 1].legend()
        axes[i, 1].grid(alpha=0.3)
    
    plt.tight_layout()
    plt.savefig(f"{save_path}/trajectory_predictions.png", dpi=300, bbox_inches='tight')
    plt.close()

def save_metrics_to_json(metrics_dict, filepath):
    """Save metrics dictionary to JSON file"""
    with open(filepath, 'w') as f:
        json.dump(metrics_dict, f, indent=4, default=str)

# --------------------------
# Functions
# --------------------------
def load_dataset():
    df = pd.read_csv("orbital_features.csv")
    X = df.drop(columns=['label']).values
    y = df['label'].values
    feature_names = df.drop(columns=['label']).columns.tolist()
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    return train_test_split(X_scaled, y, test_size=0.2, random_state=42, stratify=y), scaler, feature_names

def calculate_metrics(y_true, y_pred, y_proba):
    """Calculate comprehensive metrics"""
    return {
        'accuracy': accuracy_score(y_true, y_pred),
        'precision': precision_score(y_true, y_pred),
        'recall': recall_score(y_true, y_pred),
        'f1': f1_score(y_true, y_pred),
        'roc_auc': auc(*roc_curve(y_true, y_proba[:, 1])[:2])
    }

def train_detection_ensemble(X_train, y_train, X_test, y_test, feature_names):
    print("Training detection ensemble...")
    
    # Apply SMOTE
    sm = SMOTE(random_state=42)
    X_train_bal, y_train_bal = sm.fit_resample(X_train, y_train)
    print(f"After SMOTE - Training samples: {len(X_train_bal)}, Class distribution: {np.bincount(y_train_bal)}")

    # Initialize models
    models = {
        'RF': RandomForestClassifier(n_estimators=200, random_state=42),
        'XGB': xgb.XGBClassifier(n_estimators=200, learning_rate=0.05, use_label_encoder=False, eval_metric='logloss'),
        'LGBM': lgb.LGBMClassifier(n_estimators=200, learning_rate=0.05, verbose=-1),
        'CatBoost': CatBoostClassifier(iterations=200, learning_rate=0.05, verbose=0, random_state=42)
    }
    
    model_metrics = {}
    model_probabilities = []
    
    print("\nTraining individual models:")
    for name, model in models.items():
        print(f"Training {name}...")
        
        # Train model
        model.fit(X_train_bal, y_train_bal)
        
        # Make predictions
        y_pred = model.predict(X_test)
        y_proba = model.predict_proba(X_test)
        
        # Calculate metrics
        metrics = calculate_metrics(y_test, y_pred, y_proba)
        model_metrics[name] = metrics
        model_probabilities.append((name, y_test, y_proba))
        
        # Cross-validation score
        cv_scores = cross_val_score(model, X_train_bal, y_train_bal, cv=5, scoring='f1')
        model_metrics[name]['cv_f1_mean'] = cv_scores.mean()
        model_metrics[name]['cv_f1_std'] = cv_scores.std()
        
        print(f"{name} - Accuracy: {metrics['accuracy']:.4f}, F1: {metrics['f1']:.4f}, AUC: {metrics['roc_auc']:.4f}")
        
        # Save model
        joblib.dump(model, f"saved_models/{name}_detection.pkl")
        
        # Plot confusion matrix
        plot_confusion_matrix(y_test, y_pred, name, "train_metrics")
        
        # Plot feature importance
        plot_feature_importance(model, feature_names, name, "train_metrics")
    
    # Ensemble prediction
    print("\nCreating ensemble...")
    all_probas = np.array([prob[2] for prob in model_probabilities])
    ensemble_proba = np.mean(all_probas, axis=0)
    ensemble_pred = np.argmax(ensemble_proba, axis=1)
    
    # Ensemble metrics
    ensemble_metrics = calculate_metrics(y_test, ensemble_pred, ensemble_proba)
    model_metrics['Ensemble'] = ensemble_metrics
    model_probabilities.append(('Ensemble', y_test, ensemble_proba))
    
    print(f"Ensemble - Accuracy: {ensemble_metrics['accuracy']:.4f}, F1: {ensemble_metrics['f1']:.4f}, AUC: {ensemble_metrics['roc_auc']:.4f}")
    
    # Generate comprehensive plots
    plot_roc_curves(model_probabilities, "train_metrics")
    plot_precision_recall_curves(model_probabilities, "train_metrics")
    plot_model_comparison(model_metrics, "train_metrics")
    plot_confusion_matrix(y_test, ensemble_pred, 'Ensemble', "train_metrics")
    
    # Save detailed classification reports
    for name, model in models.items():
        y_pred = model.predict(X_test)
        report = classification_report(y_test, y_pred, output_dict=True)
        with open(f"train_metrics/{name}_classification_report.json", 'w') as f:
            json.dump(report, f, indent=4)
    
    # Save ensemble classification report
    ensemble_report = classification_report(y_test, ensemble_pred, output_dict=True)
    with open(f"train_metrics/Ensemble_classification_report.json", 'w') as f:
        json.dump(ensemble_report, f, indent=4)
    
    # Save all metrics
    save_metrics_to_json(model_metrics, "train_metrics/detection_metrics.json")
    
    print("\nDetection ensemble training completed!")
    return model_metrics

def train_trajectory_models(X_train, X_test, device=torch.device('cpu'), epochs=30, batch_size=64):
    print(f"\nTraining trajectory models on {device}...")
    
    # Prepare data
    X_train_tensor = torch.tensor(X_train, dtype=torch.float32).unsqueeze(1).to(device)
    X_test_tensor = torch.tensor(X_test, dtype=torch.float32).unsqueeze(1).to(device)
    train_dataset = TensorDataset(X_train_tensor, X_train_tensor)
    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True)

    # Initialize models
    input_size = X_train_tensor.shape[2]
    lstm_model = TrajRNN(input_size, rnn_type='LSTM').to(device)
    gru_model = TrajRNN(input_size, rnn_type='GRU').to(device)
    
    criterion = nn.MSELoss()
    lstm_optimizer = torch.optim.Adam(lstm_model.parameters(), lr=0.001)
    gru_optimizer = torch.optim.Adam(gru_model.parameters(), lr=0.001)
    
    # Training history
    train_losses_lstm = []
    train_losses_gru = []
    
    print("Training progress:")
    for epoch in range(epochs):
        lstm_model.train()
        gru_model.train()
        epoch_loss_lstm = []
        epoch_loss_gru = []
        
        for xb, yb in tqdm(train_loader, desc=f"Epoch {epoch+1}/{epochs}", leave=False):
            xb, yb = xb.to(device), yb.to(device)
            
            # LSTM training
            lstm_optimizer.zero_grad()
            out_lstm = lstm_model(xb)
            loss_lstm = criterion(out_lstm, yb.squeeze(1))
            loss_lstm.backward()
            lstm_optimizer.step()
            epoch_loss_lstm.append(loss_lstm.item())
            
            # GRU training
            gru_optimizer.zero_grad()
            out_gru = gru_model(xb)
            loss_gru = criterion(out_gru, yb.squeeze(1))
            loss_gru.backward()
            gru_optimizer.step()
            epoch_loss_gru.append(loss_gru.item())
        
        # Record epoch losses
        avg_loss_lstm = np.mean(epoch_loss_lstm)
        avg_loss_gru = np.mean(epoch_loss_gru)
        train_losses_lstm.append(avg_loss_lstm)
        train_losses_gru.append(avg_loss_gru)
        
        if (epoch + 1) % 5 == 0:
            print(f"Epoch {epoch+1}/{epochs} - LSTM Loss: {avg_loss_lstm:.6f}, GRU Loss: {avg_loss_gru:.6f}")
    
    # Evaluate models
    lstm_model.eval()
    gru_model.eval()
    
    trajectory_metrics = {}
    
    with torch.no_grad():
        # LSTM evaluation
        lstm_preds = lstm_model(X_test_tensor).cpu().numpy()
        X_test_np = X_test_tensor.squeeze(1).cpu().numpy()
        
        lstm_mse = mean_squared_error(X_test_np, lstm_preds)
        lstm_mae = mean_absolute_error(X_test_np, lstm_preds)
        lstm_r2 = r2_score(X_test_np.flatten(), lstm_preds.flatten())
        
        trajectory_metrics['LSTM'] = {
            'mse': lstm_mse,
            'mae': lstm_mae,
            'r2': lstm_r2,
            'rmse': np.sqrt(lstm_mse),
            'final_train_loss': train_losses_lstm[-1]
        }
        
        # GRU evaluation
        gru_preds = gru_model(X_test_tensor).cpu().numpy()
        
        gru_mse = mean_squared_error(X_test_np, gru_preds)
        gru_mae = mean_absolute_error(X_test_np, gru_preds)
        gru_r2 = r2_score(X_test_np.flatten(), gru_preds.flatten())
        
        trajectory_metrics['GRU'] = {
            'mse': gru_mse,
            'mae': gru_mae,
            'r2': gru_r2,
            'rmse': np.sqrt(gru_mse),
            'final_train_loss': train_losses_gru[-1]
        }
    
    # Save models
    torch.save(lstm_model.state_dict(), "saved_models/lstm_traj.pth")
    torch.save(gru_model.state_dict(), "saved_models/gru_traj.pth")
    
    # Generate plots
    plot_training_history(train_losses_lstm, train_losses_gru, "train_metrics")
    plot_trajectory_predictions({'lstm': lstm_model, 'gru': gru_model}, X_test, "train_metrics", device)
    
    # Save training history
    history_data = {
        'lstm_losses': train_losses_lstm,
        'gru_losses': train_losses_gru,
        'epochs': list(range(1, epochs + 1))
    }
    save_metrics_to_json(history_data, "train_metrics/training_history.json")
    
    # Save trajectory metrics
    save_metrics_to_json(trajectory_metrics, "train_metrics/trajectory_metrics.json")
    
    # Print results
    print(f"\nTrajectory Model Results:")
    print(f"LSTM - MSE: {lstm_mse:.6f}, MAE: {lstm_mae:.6f}, R²: {lstm_r2:.6f}")
    print(f"GRU  - MSE: {gru_mse:.6f}, MAE: {gru_mae:.6f}, R²: {gru_r2:.6f}")
    
    print("Trajectory models saved and evaluated!")
    return trajectory_metrics

# --------------------------
# Main
# --------------------------
if __name__ == "__main__":
    print("="*60)
    print("ORBITAL DEBRIS DETECTION - ENHANCED TRAINING PIPELINE")
    print("="*60)
    
    # Load dataset
    print("Loading dataset...")
    (X_train, X_test, y_train, y_test), scaler, feature_names = load_dataset()
    joblib.dump(scaler, "saved_models/scaler.pkl")
    
    print(f"Dataset loaded - Training: {len(X_train)}, Testing: {len(X_test)}")
    print(f"Feature count: {len(feature_names)}")
    print(f"Class distribution - Train: {np.bincount(y_train)}, Test: {np.bincount(y_test)}")
    
    # Train detection models
    detection_metrics = train_detection_ensemble(X_train, y_train, X_test, y_test, feature_names)
    
    # Train trajectory models
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f"Using device: {device}")
    trajectory_metrics = train_trajectory_models(X_train, X_test, device=device)
    
    # Create summary report
    summary = {
        'training_date': datetime.now().isoformat(),
        'dataset_info': {
            'train_samples': len(X_train),
            'test_samples': len(X_test),
            'features': len(feature_names),
            'train_class_dist': np.bincount(y_train).tolist(),
            'test_class_dist': np.bincount(y_test).tolist()
        },
        'detection_models': detection_metrics,
        'trajectory_models': trajectory_metrics,
        'device_used': str(device)
    }
    
    save_metrics_to_json(summary, "train_metrics/training_summary.json")
    
    print("\n" + "="*60)
    print("TRAINING COMPLETED SUCCESSFULLY!")
    print("="*60)
    print("All models, metrics, and visualizations saved to respective folders:")
    print("- Models: saved_models/")
    print("- Metrics & Plots: train_metrics/")
    print("="*60)