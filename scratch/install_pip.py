import urllib.request
import os
import subprocess
import sys

python_exe = r"C:\Program Files\MODA ODF Application Tools\program\python.exe"
get_pip_url = "https://bootstrap.pypa.io/pip/3.8/get-pip.py"
get_pip_path = "scratch/get-pip.py"

print("Downloading get-pip.py for Python 3.8...")
try:
    urllib.request.urlretrieve(get_pip_url, get_pip_path)
    print("Download completed.")
except Exception as e:
    print(f"Failed to download get-pip.py: {e}")
    sys.exit(1)

print("Installing pip locally...")
try:
    # Run with --user to install in user's local application data
    result = subprocess.run([python_exe, get_pip_path, "--user"], capture_output=True, text=True)
    print("STDOUT:", result.stdout)
    print("STDERR:", result.stderr)
    if result.returncode != 0:
        print("Failed to install pip.")
        sys.exit(1)
except Exception as e:
    print(f"Error running get-pip.py: {e}")
    sys.exit(1)

print("Installing required packages...")
try:
    result = subprocess.run([python_exe, "-m", "pip", "install", "--user", "google-generativeai", "requests", "python-dotenv", "pandas"], capture_output=True, text=True)
    print("STDOUT:", result.stdout)
    print("STDERR:", result.stderr)
    if result.returncode == 0:
        print("All packages installed successfully!")
    else:
        print("Failed to install packages.")
except Exception as e:
    print(f"Error running pip install: {e}")
