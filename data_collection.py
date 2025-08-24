# orbital_pipeline/data_collection.py
import os
import requests
from feature_extraction import parse_tle_lines

TLE_URLS = {
    "cosmos_1408": "https://celestrak.org/NORAD/elements/gp.php?GROUP=cosmos-1408-debris&FORMAT=tle",
    "fengyun_1c": "https://celestrak.org/NORAD/elements/gp.php?GROUP=fengyun-1c-debris&FORMAT=tle",
    "iridium_33": "https://celestrak.org/NORAD/elements/gp.php?GROUP=iridium-33-debris&FORMAT=tle",
    "cosmos_2251": "https://celestrak.org/NORAD/elements/gp.php?GROUP=cosmos-2251-debris&FORMAT=tle",
    "active_satellites": "https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle"
}

SAVE_DIR = "tle_data"
os.makedirs(SAVE_DIR, exist_ok=True)

def get_latest_features(source="active_satellites", label=0):
    """
    Fetch the latest TLE from Celestrak and return features as a DataFrame.
    No files are written.
    """
    url = TLE_URLS[source]
    try:
        r = requests.get(url)
        if r.status_code == 200:
            tle_lines = r.text.strip().splitlines()
            features_df = parse_tle_lines(tle_lines, label=label)
            return features_df
        else:
            print(f"Failed {r.status_code}")
            return None
    except Exception as e:
        print(f"Error: {e}")
        return None

def get_latest_tle(source="active_satellites"):
    """
    Fetch the latest TLE from Celestrak and return raw lines.
    """
    url = TLE_URLS[source]
    try:
        r = requests.get(url)
        if r.status_code == 200:
            tle_lines = r.text.strip().splitlines()
            return tle_lines
        else:
            print(f"Failed {r.status_code}")
            return None
    except Exception as e:
        print(f"Error: {e}")
        return None
