#!/usr/bin/env python3
"""
Quick port cleanup script for PlexDualSub
Use this if the main script reports port conflicts.
"""

import subprocess
import sys

def cleanup_port(port):
    """Kill any processes using the specified port"""
    try:
        # Find processes using the port
        result = subprocess.run(
            ["lsof", "-ti", f":{port}"],
            capture_output=True,
            text=True
        )
        
        if result.stdout.strip():
            pids = result.stdout.strip().split('\n')
            print(f"🧹 Cleaning up processes on port {port}...")
            
            for pid in pids:
                try:
                    subprocess.run(["kill", "-9", pid], check=True)
                    print(f"   Killed process {pid}")
                except subprocess.CalledProcessError:
                    print(f"   Process {pid} already gone")
        else:
            print(f"✅ Port {port} is already free")
            
    except Exception as e:
        print(f"❌ Error cleaning port {port}: {e}")

def main():
    print("🎬 PlexDualSub Port Cleanup")
    print("=" * 40)
    
    # Default ports
    ports = [8000, 5173]
    
    # Allow custom ports as arguments
    if len(sys.argv) > 1:
        try:
            ports = [int(port) for port in sys.argv[1:]]
        except ValueError:
            print("Usage: python cleanup.py [port1] [port2] ...")
            print("Example: python cleanup.py 8000 5173")
            sys.exit(1)
    
    for port in ports:
        cleanup_port(port)
    
    print("=" * 40)
    print("🎉 Cleanup complete! You can now run the application.")

if __name__ == "__main__":
    main()