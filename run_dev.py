import os
import sys
import subprocess
import time
import signal

root_dir = os.path.dirname(os.path.abspath(__file__))

backend_cmd = [
    sys.executable,
    "-m",
    "uvicorn",
    "backend.app.main:app",
    "--env-file",
    os.path.join(root_dir, ".env"),
    "--host",
    "127.0.0.1",
    "--port",
    "8000"
]

frontend_cmd = [
    "node",
    os.path.join(root_dir, "node_modules", "vite", "bin", "vite.js"),
    "--host",
    "0.0.0.0",
    "--port",
    "3000"
]

print(f"Starting backend: {' '.join(backend_cmd)}")
backend_proc = subprocess.Popen(backend_cmd, cwd=root_dir)

print(f"Starting frontend: {' '.join(frontend_cmd)}")
frontend_proc = subprocess.Popen(frontend_cmd, cwd=root_dir)

def cleanup(sig=None, frame=None):
    print("Terminating servers...")
    try:
        backend_proc.terminate()
    except Exception:
        pass
    try:
        frontend_proc.terminate()
    except Exception:
        pass
    sys.exit(0)

signal.signal(signal.SIGINT, cleanup)
signal.signal(signal.SIGTERM, cleanup)

try:
    while True:
        b_poll = backend_proc.poll()
        f_poll = frontend_proc.poll()
        if b_poll is not None:
            print(f"Backend exited with code {b_poll}")
            cleanup()
        if f_poll is not None:
            print(f"Frontend exited with code {f_poll}")
            cleanup()
        time.sleep(1)
except KeyboardInterrupt:
    cleanup()

