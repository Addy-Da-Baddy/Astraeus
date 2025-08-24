# orbital_pipeline/feature_extraction.py
import os
import pandas as pd
import numpy as np
from sgp4.api import Satrec, jday
from datetime import datetime

EARTH_RADIUS = 6371
MU = 398600.4418  # km^3/s^2

TLE_DIR = "tle_data"
OUTPUT_FILE = "orbital_features.csv"

def parse_tle_file(file_path, label):
    data = []
    with open(file_path, 'r') as f:
        lines = [l.strip() for l in f if l.strip()]  # remove empty lines

    i = 0
    while i < len(lines) - 1:
        # Check if lines start with proper TLE markers
        if lines[i].startswith('1 ') and lines[i+1].startswith('2 '):
            try:
                sat = Satrec.twoline2rv(lines[i], lines[i+1])
                mm = sat.no_kozai  # revs/day
                if mm == 0:
                    i += 2
                    continue  # skip invalid TLEs

                # Orbital elements
                ecc = sat.ecco
                inc = sat.inclo
                raan = sat.nodeo
                argp = sat.argpo
                ma = sat.mo

                # Semi-major axis (km)
                a = (MU / ((mm*2*np.pi/86400)**2))**(1/3)
                alt = a - EARTH_RADIUS
                perigee = a * (1 - ecc)
                apogee = a * (1 + ecc)
                orbital_period = 2*np.pi*np.sqrt(a**3 / MU)

                # Propagate current position/velocity
                jd, fr = jday(datetime.utcnow().year, datetime.utcnow().month, datetime.utcnow().day,
                              datetime.utcnow().hour, datetime.utcnow().minute, datetime.utcnow().second)
                e_code, r, v = sat.sgp4(jd, fr)
                if e_code != 0:
                    i += 2
                    continue  # skip TLEs that fail propagation

                distance = np.linalg.norm(r)
                velocity = np.linalg.norm(v)
                energy = velocity**2 / 2 - MU/distance

                data.append({
                    'eccentricity': ecc,
                    'inclination': inc,
                    'raan': raan,
                    'arg_perigee': argp,
                    'mean_anomaly': ma,
                    'mean_motion': mm,
                    'semi_major_axis': a,
                    'altitude': alt,
                    'perigee': perigee,
                    'apogee': apogee,
                    'orbital_period': orbital_period,
                    'distance': distance,
                    'velocity': velocity,
                    'energy': energy,
                    'label': label
                })
            except Exception as ex:
                print(f"Skipping invalid TLE in {file_path} at lines {i}-{i+1}: {ex}")
            i += 2
        else:
            # Skip any non-TLE lines (titles, comments)
            i += 1
    return data


# orbital_pipeline/feature_extraction.py
def parse_tle_lines(lines, label=0):
    """
    Same as parse_tle_file but works on raw TLE lines in memory.
    Returns a DataFrame with orbital features.
    """
    data = []
    i = 0
    while i < len(lines) - 1:
        if lines[i].startswith('1 ') and lines[i+1].startswith('2 '):
            try:
                sat = Satrec.twoline2rv(lines[i], lines[i+1])
                mm = sat.no_kozai
                if mm == 0:
                    i += 2
                    continue

                ecc = sat.ecco
                inc = sat.inclo
                raan = sat.nodeo
                argp = sat.argpo
                ma = sat.mo

                a = (MU / ((mm*2*np.pi/86400)**2))**(1/3)
                alt = a - EARTH_RADIUS
                perigee = a * (1 - ecc)
                apogee = a * (1 + ecc)
                orbital_period = 2*np.pi*np.sqrt(a**3 / MU)

                jd, fr = jday(datetime.utcnow().year, datetime.utcnow().month, datetime.utcnow().day,datetime.utcnow().hour, datetime.utcnow().minute, datetime.utcnow().second)
                e_code, r, v = sat.sgp4(jd, fr)
                if e_code != 0:
                    i += 2
                    continue

                distance = np.linalg.norm(r)
                velocity = np.linalg.norm(v)
                energy = velocity**2 / 2 - MU/distance

                data.append({
                    'eccentricity': ecc,
                    'inclination': inc,
                    'raan': raan,
                    'arg_perigee': argp,
                    'mean_anomaly': ma,
                    'mean_motion': mm,
                    'semi_major_axis': a,
                    'altitude': alt,
                    'perigee': perigee,
                    'apogee': apogee,
                    'orbital_period': orbital_period,
                    'distance': distance,
                    'velocity': velocity,
                    'energy': energy,
                    'label': label
                })
            except Exception as ex:
                print(f"Skipping invalid TLE at lines {i}-{i+1}: {ex}")
            i += 2
        else:
            i += 1
    return pd.DataFrame(data)


def create_dataset():
    all_data = []
    for file in os.listdir(TLE_DIR):
        if not file.endswith('.txt'):
            continue
        # Label: 0 = active satellite, 1 = debris
        label = 0 if 'active' in file.lower() else 1
        data = parse_tle_file(os.path.join(TLE_DIR, file), label)
        all_data.extend(data)

    if not all_data:
        print("No valid TLEs found!")
        return

    df = pd.DataFrame(all_data)
    df.to_csv(OUTPUT_FILE, index=False)
    print(f"Dataset saved to {OUTPUT_FILE}, total rows: {len(df)}")

if __name__ == "__main__":
    create_dataset()
