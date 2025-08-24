#!/usr/bin/env python3
"""
Initial setup script to download and cache TLE data
Run this once to populate the cache with initial data
"""

import os
from data_collection import force_download_all, CACHE_DIR, SAVE_DIR
from feature_extraction import create_dataset

def setup_initial_cache():
    print("🚀 Setting up NovaGen TLE data cache...")
    print("=" * 50)
    
    # Create directories
    os.makedirs(CACHE_DIR, exist_ok=True)
    os.makedirs(SAVE_DIR, exist_ok=True)
    
    # Force download all TLE sources
    print("📡 Downloading initial TLE data...")
    force_download_all()
    
    # Create initial dataset
    print("\n📊 Creating initial orbital features dataset...")
    create_dataset()
    
    print("\n✅ Setup complete!")
    print(f"📁 Cache directory: {CACHE_DIR}")
    print(f"📁 TLE directory: {SAVE_DIR}")
    print("🕐 Future downloads will only happen at 6 AM, 2 PM, and 10 PM")
    print("📝 The system will use cached data between scheduled downloads")

if __name__ == "__main__":
    setup_initial_cache()
