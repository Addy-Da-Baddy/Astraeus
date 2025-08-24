# visualizer.py - Minor speed improvements on your working code
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d import Axes3D
from matplotlib.animation import FuncAnimation
from datetime import datetime, timedelta
import time
import random
import numpy as np
from sgp4.api import Satrec, jday
from data_collection import get_latest_tle

# Globals
satellite = None
last_fetch_time = 0
fetch_interval = 3 * 60 * 60  # 3 hours
traj_points = []

def fetch_new_tle():
    global satellite, last_fetch_time, traj_points
    
    now = time.time()
    if now - last_fetch_time < fetch_interval and satellite is not None:
        return
    
    tle_lines = get_latest_tle("active_satellites")
    if not tle_lines:
        print("⚠️ No TLE fetched")
        return
    
    tle_lines = [l.strip() for l in tle_lines if l.strip()]
    if len(tle_lines) < 3:
        print("⚠️ Not enough TLE lines")
        return
    
    num_sats = len(tle_lines) // 3
    sat_index = random.randint(0, num_sats - 1)
    idx = sat_index * 3
    
    try:
        name = tle_lines[idx]
        line1 = tle_lines[idx + 1]
        line2 = tle_lines[idx + 2]
        satellite = Satrec.twoline2rv(line1, line2)
        print(f"✅ Loaded satellite: {name}")
        
        # MAJOR SPEED FIX: Pre-calculate COMPLETE trajectory when new TLE loads
        print("🚀 Pre-calculating COMPLETE trajectory...")
        traj_points = []  # Reset trajectory
        current_time = datetime.utcnow()
        
        # Calculate 150 points over 150 minutes (complete orbit)
        for i in range(150):
            dt_offset = timedelta(minutes=i)  # 1 minute between points
            time_point = current_time + dt_offset
            
            jd, fr = jday(time_point.year, time_point.month, time_point.day,
                         time_point.hour, time_point.minute, time_point.second)
            
            e, r, v = satellite.sgp4(jd, fr)
            if e == 0:
                traj_points.append(r)
        
        print(f"✅ COMPLETE trajectory calculated: {len(traj_points)} points shown instantly!")
        last_fetch_time = now
        
    except IndexError:
        print("⚠️ Error picking satellite block")

# Initial fetch
fetch_new_tle()

# Set up plot
fig = plt.figure(figsize=(12, 8))
ax = fig.add_subplot(111, projection='3d')
scat = ax.scatter([], [], [], c='red', s=20, alpha=0.8)
ax.set_xlabel('X (km)')
ax.set_ylabel('Y (km)')
ax.set_zlabel('Z (km)')
ax.set_title('Satellite Trajectory (SGP4 Real-Time) - Faster')
ax.set_xlim(-20000, 20000)
ax.set_ylim(-20000, 20000)
ax.set_zlim(-20000, 20000)

def update(frame):
    global satellite, traj_points
    
    # Fetch new TLE every 3 hours
    fetch_new_tle()
    
    # SPEED FIX: Don't add points one-by-one, trajectory is already complete!
    # The complete trajectory was pre-calculated in fetch_new_tle()
    
    if traj_points:
        xs, ys, zs = zip(*traj_points)
        scat._offsets3d = (xs, ys, zs)
    
    return scat,

# SPEED IMPROVEMENT 4: Faster animation interval (500ms instead of 2000ms)
anim = FuncAnimation(fig, update, interval=500, blit=False)

print("🚀 Starting INSTANT visualization...")
print("📍 COMPLETE orbital trajectory appears immediately when TLE loads!")
plt.show()