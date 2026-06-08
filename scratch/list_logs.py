import os

base_dir = r"C:\Users\aou\.gemini\antigravity\brain\07153d94-62f8-4473-8bb1-2d8162627c0f"
tasks_dir = os.path.join(base_dir, ".system_generated", "tasks")

print(f"Checking directory: {tasks_dir}")
if os.path.exists(tasks_dir):
    print("Files found in tasks directory:")
    for f in os.listdir(tasks_dir):
        print(f"  - {f}")
else:
    print("Tasks directory does not exist!")

# Also check parents
parent = os.path.join(base_dir, ".system_generated")
if os.path.exists(parent):
    print(f"Files found in parent: {parent}")
    for f in os.listdir(parent):
        print(f"  - {f}")
else:
    print("Parent directory does not exist!")
