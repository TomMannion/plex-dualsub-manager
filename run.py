#!/usr/bin/env python3
"""
Plex Dual Subtitle Manager - Unified Run Script
Start backend, frontend, or both with a single command.
"""

import subprocess
import sys
import os
import time
import signal
import argparse
from pathlib import Path
import webbrowser
from typing import Optional

class Colors:
    """ANSI color codes for terminal output"""
    BLUE = '\033[94m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    BOLD = '\033[1m'
    RESET = '\033[0m'

class PlexDualSubRunner:
    def __init__(self):
        self.root_dir = Path(__file__).parent
        self.backend_process = None
        self.frontend_process = None
        
    def print_header(self):
        """Print application header"""
        print(f"{Colors.BOLD}{Colors.BLUE}")
        print("=" * 60)
        print("🎬 Plex Dual Subtitle Manager")
        print("=" * 60)
        print(f"{Colors.RESET}")
    
    def print_info(self, message: str):
        """Print info message"""
        print(f"{Colors.BLUE}ℹ️  {message}{Colors.RESET}")
    
    def print_success(self, message: str):
        """Print success message"""
        print(f"{Colors.GREEN}✅ {message}{Colors.RESET}")
    
    def print_error(self, message: str):
        """Print error message"""
        print(f"{Colors.RED}❌ {message}{Colors.RESET}")
    
    def print_warning(self, message: str):
        """Print warning message"""
        print(f"{Colors.YELLOW}⚠️  {message}{Colors.RESET}")
    
    def cleanup_ports(self, ports: list = [8000, 5173]):
        """Clean up any processes using the specified ports"""
        for port in ports:
            try:
                # Find processes using the port
                result = subprocess.run(
                    ["lsof", "-ti", f":{port}"],
                    capture_output=True,
                    text=True
                )
                
                if result.stdout.strip():
                    pids = result.stdout.strip().split('\n')
                    self.print_info(f"Cleaning up processes on port {port}...")
                    
                    for pid in pids:
                        try:
                            subprocess.run(["kill", "-9", pid], check=True)
                        except subprocess.CalledProcessError:
                            pass  # Process might already be gone
                    
                    time.sleep(1)  # Give processes time to clean up
                    
            except Exception:
                pass  # lsof might not be available or other issues
    
    def check_dependencies(self) -> bool:
        """Check if all dependencies are installed"""
        checks_passed = True
        
        # Check Python virtual environment
        venv_path = self.root_dir / "venv"
        if not venv_path.exists():
            self.print_error("Virtual environment not found!")
            self.print_warning("Run: python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt")
            checks_passed = False
        
        # Check Node modules
        node_modules = self.root_dir / "frontend" / "node_modules"
        if not node_modules.exists():
            self.print_error("Frontend dependencies not found!")
            self.print_warning("Run: cd frontend && npm install")
            checks_passed = False
        
        return checks_passed
    
    def start_backend(self, port: int = 8000) -> subprocess.Popen:
        """Start the backend server"""
        self.print_info("Starting backend server...")
        
        # Prepare environment with virtual environment
        env = os.environ.copy()
        venv_python = self.root_dir / "venv" / "bin" / "python"
        if not venv_python.exists():
            venv_python = self.root_dir / "venv" / "Scripts" / "python.exe"  # Windows
        
        # Start backend
        process = subprocess.Popen(
            [str(venv_python), "main.py"],
            cwd=self.root_dir / "backend",
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        
        # Wait for backend to start
        time.sleep(3)
        
        # Check if backend is running
        try:
            import requests
            response = requests.get(f"http://localhost:{port}/api/health")
            if response.status_code == 200:
                self.print_success(f"Backend running at http://localhost:{port}")
                self.print_info(f"API docs available at http://localhost:{port}/docs")
                return process
        except:
            pass
        
        self.print_warning("Backend may still be starting...")
        return process
    
    def start_frontend(self, port: int = 5173) -> subprocess.Popen:
        """Start the frontend server"""
        self.print_info("Starting frontend server...")
        
        # Start frontend
        process = subprocess.Popen(
            ["npm", "run", "dev"],
            cwd=self.root_dir / "frontend",
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        
        # Wait for frontend to start
        time.sleep(3)
        
        self.print_success(f"Frontend running at http://localhost:{port}")
        return process
    
    def get_network_ip(self) -> Optional[str]:
        """Get local network IP address"""
        try:
            import socket
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            ip = s.getsockname()[0]
            s.close()
            return ip
        except:
            return None
    
    def cleanup(self, signum=None, frame=None):
        """Clean up processes on exit"""
        print()  # New line after Ctrl+C
        self.print_warning("Shutting down...")
        
        if self.backend_process:
            self.backend_process.terminate()
            try:
                self.backend_process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.backend_process.kill()
            self.print_success("Backend stopped")
        
        if self.frontend_process:
            self.frontend_process.terminate()
            try:
                self.frontend_process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.frontend_process.kill()
            self.print_success("Frontend stopped")
        
        sys.exit(0)
    
    def run(self, backend_only: bool = False, frontend_only: bool = False, 
            open_browser: bool = False, backend_port: int = 8000, 
            frontend_port: int = 5173):
        """Run the application"""
        self.print_header()
        
        # Clean up any existing processes on our ports
        self.cleanup_ports([backend_port, frontend_port])
        
        # Check dependencies
        if not self.check_dependencies():
            self.print_error("Please install dependencies first!")
            self.print_info("Run: ./scripts/setup.sh")
            return 1
        
        # Set up signal handler for clean shutdown
        signal.signal(signal.SIGINT, self.cleanup)
        signal.signal(signal.SIGTERM, self.cleanup)
        
        try:
            # Start services based on arguments
            if not frontend_only:
                self.backend_process = self.start_backend(backend_port)
            
            if not backend_only:
                self.frontend_process = self.start_frontend(frontend_port)
            
            # Print access information
            print()
            self.print_success("Services are running!")
            print()
            
            if not frontend_only:
                print(f"  {Colors.BOLD}Backend:{Colors.RESET}")
                print(f"    Local:   {Colors.GREEN}http://localhost:{backend_port}{Colors.RESET}")
                print(f"    API Docs: {Colors.GREEN}http://localhost:{backend_port}/docs{Colors.RESET}")
            
            if not backend_only:
                print(f"  {Colors.BOLD}Frontend:{Colors.RESET}")
                print(f"    Local:   {Colors.GREEN}http://localhost:{frontend_port}{Colors.RESET}")
            
            # Show network access if available
            network_ip = self.get_network_ip()
            if network_ip:
                print()
                print(f"  {Colors.BOLD}Network Access:{Colors.RESET}")
                if not frontend_only:
                    print(f"    Backend:  {Colors.GREEN}http://{network_ip}:{backend_port}{Colors.RESET}")
                if not backend_only:
                    print(f"    Frontend: {Colors.GREEN}http://{network_ip}:{frontend_port}{Colors.RESET}")
            
            # Open browser if requested
            if open_browser and not backend_only:
                time.sleep(2)
                webbrowser.open(f"http://localhost:{frontend_port}")
            
            print()
            self.print_info("Press Ctrl+C to stop all services")
            print()
            
            # Keep running until interrupted
            while True:
                time.sleep(1)
                
                # Check if processes are still running
                if self.backend_process and self.backend_process.poll() is not None:
                    self.print_error("Backend process stopped unexpectedly!")
                    self.cleanup()
                
                if self.frontend_process and self.frontend_process.poll() is not None:
                    self.print_error("Frontend process stopped unexpectedly!")
                    self.cleanup()
                    
        except KeyboardInterrupt:
            self.cleanup()
        except Exception as e:
            self.print_error(f"Error: {e}")
            self.cleanup()

def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description="Plex Dual Subtitle Manager - Run Script",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python run.py              # Start both backend and frontend
  python run.py --backend    # Start backend only
  python run.py --frontend   # Start frontend only
  python run.py --open       # Start and open browser
  python run.py --backend-port 8080  # Use custom backend port
        """
    )
    
    parser.add_argument(
        '--backend', 
        action='store_true',
        help='Start backend only'
    )
    parser.add_argument(
        '--frontend', 
        action='store_true',
        help='Start frontend only'
    )
    parser.add_argument(
        '--open', '-o',
        action='store_true',
        help='Open browser automatically'
    )
    parser.add_argument(
        '--backend-port',
        type=int,
        default=8000,
        help='Backend port (default: 8000)'
    )
    parser.add_argument(
        '--frontend-port',
        type=int,
        default=5173,
        help='Frontend port (default: 5173)'
    )
    parser.add_argument(
        '--cleanup-only',
        action='store_true',
        help='Only cleanup ports and exit (useful for troubleshooting)'
    )
    
    args = parser.parse_args()
    
    # Create runner
    runner = PlexDualSubRunner()
    
    # Handle cleanup-only mode
    if args.cleanup_only:
        runner.print_header()
        print(f"{Colors.INFO}Cleaning up ports {args.backend_port} and {args.frontend_port}...{Colors.RESET}")
        runner.cleanup_ports([args.backend_port, args.frontend_port])
        print(f"{Colors.SUCCESS}Port cleanup complete!{Colors.RESET}")
        return
    
    # Run the application
    runner.run(
        backend_only=args.backend,
        frontend_only=args.frontend,
        open_browser=args.open,
        backend_port=args.backend_port,
        frontend_port=args.frontend_port
    )

if __name__ == "__main__":
    main()