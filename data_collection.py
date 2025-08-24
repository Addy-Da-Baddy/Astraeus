# orbital_pipeline/data_collection.py
import os
import requests
import pandas as pd
from datetime import datetime, timedelta
from feature_extraction import parse_tle_lines, parse_tle_file

TLE_URLS = {
    "cosmos_1408": "https://celestrak.org/NORAD/elements/gp.php?GROUP=cosmos-1408-debris&FORMAT=tle",
    "fengyun_1c": "https://celestrak.org/NORAD/elements/gp.php?GROUP=fengyun-1c-debris&FORMAT=tle",
    "iridium_33": "https://celestrak.org/NORAD/elements/gp.php?GROUP=iridium-33-debris&FORMAT=tle",
    "cosmos_2251": "https://celestrak.org/NORAD/elements/gp.php?GROUP=cosmos-2251-debris&FORMAT=tle",
    "active_satellites": "https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle"
}

SAVE_DIR = "tle_data"
CACHE_DIR = "tle_cache"
os.makedirs(SAVE_DIR, exist_ok=True)
os.makedirs(CACHE_DIR, exist_ok=True)

# Fixed download times (24-hour format): 6 AM, 2 PM, 10 PM
DOWNLOAD_HOURS = [6, 14, 22]

def should_download_fresh_data():
    """
    Check if we should download fresh data based on fixed schedule:
    - Download only at 6 AM, 2 PM, and 10 PM
    - Allow downloads within 30 minutes of these times
    """
    now = datetime.now()
    current_hour = now.hour
    current_minute = now.minute
    
    for hour in DOWNLOAD_HOURS:
        # Allow downloads within 30 minutes of scheduled times
        if hour <= current_hour < hour + 1 and current_minute <= 30:
            return True
        # Also allow if we're close to the scheduled time (e.g., 5:45 AM for 6 AM download)
        if hour - 1 <= current_hour < hour and current_minute >= 45:
            return True
    
    return False

def get_cache_filename(source):
    """Get the cache filename for today's data"""
    today = datetime.now().strftime("%Y-%m-%d")
    return os.path.join(CACHE_DIR, f"{source}_{today}.txt")

def get_latest_cache_file(source):
    """Get the most recent cache file for a source (in case today's doesn't exist)"""
    cache_files = []
    for file in os.listdir(CACHE_DIR):
        if file.startswith(f"{source}_") and file.endswith(".txt"):
            cache_files.append(os.path.join(CACHE_DIR, file))
    
    if cache_files:
        # Sort by modification time, return most recent
        cache_files.sort(key=os.path.getmtime, reverse=True)
        return cache_files[0]
    return None

def download_and_cache_tle(source):
    """Download TLE data and cache it"""
    url = TLE_URLS[source]
    try:
        print(f"🔄 Downloading fresh TLE data for {source}...")
        r = requests.get(url, timeout=10)
        if r.status_code == 200:
            # Save to cache
            cache_file = get_cache_filename(source)
            with open(cache_file, 'w') as f:
                f.write(r.text)
            
            # Also save to regular TLE directory with timestamp
            timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M")
            tle_file = os.path.join(SAVE_DIR, f"{source}_{timestamp}.txt")
            with open(tle_file, 'w') as f:
                f.write(r.text)
            
            print(f"✅ Fresh data cached for {source}")
            return r.text.strip().splitlines()
        else:
            print(f"❌ Download failed with status {r.status_code}")
            return None
    except Exception as e:
        print(f"❌ Download error: {e}")
        return None

def load_cached_tle(source):
    """Load TLE data from cache"""
    # First try today's cache
    cache_file = get_cache_filename(source)
    if os.path.exists(cache_file):
        print(f"📁 Using today's cached data for {source}")
        with open(cache_file, 'r') as f:
            return f.read().strip().splitlines()
    
    # If no cache for today, use most recent cache
    recent_cache = get_latest_cache_file(source)
    if recent_cache:
        cache_date = os.path.basename(recent_cache).split('_')[1].replace('.txt', '')
        print(f"📁 Using cached data from {cache_date} for {source}")
        with open(recent_cache, 'r') as f:
            return f.read().strip().splitlines()
    
    # Fallback to existing TLE files in tle_data directory
    tle_files = [f for f in os.listdir(SAVE_DIR) if f.startswith(source) and f.endswith('.txt')]
    if tle_files:
        # Sort by filename (which includes timestamp) and use most recent
        tle_files.sort(reverse=True)
        fallback_file = os.path.join(SAVE_DIR, tle_files[0])
        print(f"📁 Using fallback TLE file: {tle_files[0]}")
        with open(fallback_file, 'r') as f:
            return f.read().strip().splitlines()
    
    print(f"❌ No cached data found for {source}")
    return None
def get_latest_features(source="active_satellites", label=0):
    """
    Smart TLE fetching with rate limit protection:
    - Download fresh data only at scheduled times (6 AM, 2 PM, 10 PM)
    - Use cached data otherwise
    - Fallback to existing TLE files if no cache available
    """
    tle_lines = None
    
    # Check if we should download fresh data
    if should_download_fresh_data():
        tle_lines = download_and_cache_tle(source)
    
    # If download failed or not scheduled, use cached data
    if tle_lines is None:
        tle_lines = load_cached_tle(source)
    
    # If we have TLE data, parse it into features
    if tle_lines:
        try:
            features_df = parse_tle_lines(tle_lines, label=label)
            print(f"✅ Processed {len(features_df)} satellites from {source}")
            return features_df
        except Exception as e:
            print(f"❌ Error processing TLE data: {e}")
            return None
    
    print(f"❌ No TLE data available for {source}")
    return None

def get_latest_tle(source="active_satellites"):
    """
    Get the latest TLE lines with smart caching.
    """
    tle_lines = None
    
    # Check if we should download fresh data
    if should_download_fresh_data():
        tle_lines = download_and_cache_tle(source)
    
    # If download failed or not scheduled, use cached data
    if tle_lines is None:
        tle_lines = load_cached_tle(source)
    
    return tle_lines

def cleanup_old_cache():
    """Clean up cache files older than 7 days"""
    try:
        cutoff_date = datetime.now() - timedelta(days=7)
        for file in os.listdir(CACHE_DIR):
            file_path = os.path.join(CACHE_DIR, file)
            if os.path.getmtime(file_path) < cutoff_date.timestamp():
                os.remove(file_path)
                print(f"🗑️ Cleaned up old cache file: {file}")
    except Exception as e:
        print(f"Warning: Cache cleanup failed: {e}")

def force_download_all():
    """Force download of all TLE sources (for manual updates)"""
    print("🔄 Force downloading all TLE sources...")
    for source in TLE_URLS.keys():
        download_and_cache_tle(source)
    cleanup_old_cache()

# Initialize by cleaning up old cache on import
cleanup_old_cache()

def get_cache_status():
    """Get status of cached data for dashboard display"""
    status = {
        'sources': {},
        'next_download': None,
        'cache_size': 0,
        'last_update': None
    }
    
    # Check each source
    for source in TLE_URLS.keys():
        cache_file = get_cache_filename(source)
        recent_cache = get_latest_cache_file(source)
        
        if os.path.exists(cache_file):
            # Today's cache exists
            stat = os.stat(cache_file)
            status['sources'][source] = {
                'status': 'current',
                'file': cache_file,
                'size': stat.st_size,
                'modified': datetime.fromtimestamp(stat.st_mtime).strftime('%Y-%m-%d %H:%M:%S')
            }
        elif recent_cache:
            # Recent cache exists
            stat = os.stat(recent_cache)
            cache_date = os.path.basename(recent_cache).split('_')[1].replace('.txt', '')
            status['sources'][source] = {
                'status': 'cached',
                'file': recent_cache,
                'size': stat.st_size,
                'modified': datetime.fromtimestamp(stat.st_mtime).strftime('%Y-%m-%d %H:%M:%S'),
                'cache_date': cache_date
            }
        else:
            status['sources'][source] = {
                'status': 'missing',
                'file': None,
                'size': 0,
                'modified': None
            }
    
    # Calculate next download time
    now = datetime.now()
    next_times = []
    for hour in DOWNLOAD_HOURS:
        next_time = now.replace(hour=hour, minute=0, second=0, microsecond=0)
        if next_time <= now:
            next_time = next_time + timedelta(days=1)
        next_times.append(next_time)
    
    status['next_download'] = min(next_times).strftime('%Y-%m-%d %H:%M:%S')
    
    # Calculate total cache size
    if os.path.exists(CACHE_DIR):
        total_size = sum(os.path.getsize(os.path.join(CACHE_DIR, f)) 
                        for f in os.listdir(CACHE_DIR) if f.endswith('.txt'))
        status['cache_size'] = total_size
    
    # Find most recent update
    recent_times = []
    for source_info in status['sources'].values():
        if source_info['modified']:
            recent_times.append(source_info['modified'])
    
    if recent_times:
        status['last_update'] = max(recent_times)
    
    return status
