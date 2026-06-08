import os
import shutil

log_path = r"C:\Users\aou\.gemini\antigravity\brain\07153d94-62f8-4473-8bb1-2d8162627c0f\.system_generated\tasks\task-1104.log"
dest_path = r"scratch/task_log.txt"

if os.path.exists(log_path):
    try:
        shutil.copy(log_path, dest_path)
        print("Success! Copied log to scratch/task_log.txt")
    except Exception as e:
        print(f"Error copying log: {e}")
else:
    print("Log file does not exist yet.")
