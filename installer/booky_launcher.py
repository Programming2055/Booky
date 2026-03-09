"""
Booky Desktop Launcher
Runs the production build of Booky with an embedded HTTP server.
This file is bundled with PyInstaller to create the executable.
"""

import os
import sys
import webbrowser
import threading
import time
import signal
from http.server import HTTPServer, SimpleHTTPRequestHandler
import subprocess
import tempfile
import base64
import json
from urllib.parse import parse_qs

# Get the directory where the executable/script is located
if getattr(sys, 'frozen', False):
    # Running as compiled executable
    BASE_DIR = sys._MEIPASS
    APP_DIR = os.path.dirname(sys.executable)
else:
    # Running as script
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    APP_DIR = BASE_DIR

# Configuration
HTTP_PORT = 5173
API_PORT = 5001
DIST_DIR = os.path.join(BASE_DIR, 'dist')

# Store temp files to prevent deletion while app is open
temp_files = []

def open_with_system(file_path: str) -> tuple:
    """Open a file with the system's default application."""
    file_path = os.path.normpath(file_path)
    
    if not os.path.exists(file_path):
        return False, f"File not found: {file_path}"
    
    try:
        if sys.platform == 'win32':
            os.startfile(file_path)
        elif sys.platform == 'darwin':
            subprocess.call(['open', file_path])
        else:
            subprocess.call(['xdg-open', file_path])
        return True, "File opened successfully"
    except Exception as e:
        return False, str(e)


class BookyHTTPHandler(SimpleHTTPRequestHandler):
    """Custom HTTP handler that serves static files and handles API requests."""
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIST_DIR, **kwargs)
    
    def log_message(self, format, *args):
        """Suppress default logging."""
        pass
    
    def do_GET(self):
        """Handle GET requests - serve static files or API endpoints."""
        if self.path == '/api/health':
            self._send_json_response({"status": "ok"})
        elif self.path.startswith('/api/'):
            self._send_json_response({"error": "Unknown API endpoint"}, 404)
        else:
            # Handle /Booky/ base path (for GitHub Pages compatibility)
            if self.path == '/' or self.path == '':
                self.send_response(302)
                self.send_header('Location', '/Booky/')
                self.end_headers()
                return
            
            # Strip /Booky/ prefix for file serving
            if self.path.startswith('/Booky/'):
                self.path = self.path[6:]  # Remove '/Booky'
            elif self.path == '/Booky':
                self.path = '/'
            
            # For SPA routing, serve index.html for non-file paths
            if '.' not in os.path.basename(self.path) and self.path != '/':
                self.path = '/index.html'
            super().do_GET()
    
    def do_POST(self):
        """Handle POST requests for API."""
        if self.path == '/api/open':
            self._handle_open_file()
        else:
            self._send_json_response({"error": "Unknown API endpoint"}, 404)
    
    def do_OPTIONS(self):
        """Handle CORS preflight requests."""
        self.send_response(200)
        self._send_cors_headers()
        self.end_headers()
    
    def _send_cors_headers(self):
        """Add CORS headers to response."""
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
    
    def _send_json_response(self, data: dict, status: int = 200):
        """Send a JSON response."""
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self._send_cors_headers()
        self.end_headers()
        self.wfile.write(json.dumps(data).encode('utf-8'))
    
    def _handle_open_file(self):
        """Handle file open requests."""
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            data = json.loads(body.decode('utf-8'))
            
            if not data:
                self._send_json_response({"success": False, "error": "No data provided"}, 400)
                return
            
            # Method 1: Open by path
            if 'path' in data:
                success, message = open_with_system(data['path'])
                if success:
                    self._send_json_response({"success": True, "message": message})
                else:
                    self._send_json_response({"success": False, "error": message}, 500)
                return
            
            # Method 2: Receive file data, save to temp, and open
            if 'data' in data and 'filename' in data:
                file_data = base64.b64decode(data['data'])
                filename = data['filename']
                _, ext = os.path.splitext(filename)
                
                fd, temp_path = tempfile.mkstemp(suffix=ext)
                os.write(fd, file_data)
                os.close(fd)
                
                temp_files.append(temp_path)
                success, message = open_with_system(temp_path)
                
                if success:
                    self._send_json_response({"success": True, "message": message, "tempPath": temp_path})
                else:
                    try:
                        os.unlink(temp_path)
                        temp_files.remove(temp_path)
                    except:
                        pass
                    self._send_json_response({"success": False, "error": message}, 500)
                return
            
            self._send_json_response({"success": False, "error": "Provide 'path' or 'data'+'filename'"}, 400)
            
        except Exception as e:
            self._send_json_response({"success": False, "error": str(e)}, 500)


def cleanup_temp_files():
    """Clean up temporary files on exit."""
    for temp_path in temp_files:
        try:
            os.unlink(temp_path)
        except:
            pass


def run_server():
    """Run the HTTP server."""
    server_address = ('localhost', HTTP_PORT)
    
    try:
        httpd = HTTPServer(server_address, BookyHTTPHandler)
        print(f"Booky is running at http://localhost:{HTTP_PORT}")
        httpd.serve_forever()
    except OSError as e:
        if e.errno == 10048:  # Port already in use
            print(f"Port {HTTP_PORT} is already in use. Trying alternative port...")
            for alt_port in range(HTTP_PORT + 1, HTTP_PORT + 10):
                try:
                    server_address = ('localhost', alt_port)
                    httpd = HTTPServer(server_address, BookyHTTPHandler)
                    print(f"Booky is running at http://localhost:{alt_port}")
                    webbrowser.open(f'http://localhost:{alt_port}')
                    httpd.serve_forever()
                    break
                except OSError:
                    continue
        else:
            raise


def main():
    """Main entry point."""
    print("=" * 40)
    print("        Booky - Ebook Manager")
    print("=" * 40)
    print()
    
    # Check if dist directory exists
    if not os.path.exists(DIST_DIR):
        print(f"Error: Distribution directory not found at {DIST_DIR}")
        print("Please ensure the app was built correctly.")
        input("Press Enter to exit...")
        sys.exit(1)
    
    # Register cleanup on exit
    import atexit
    atexit.register(cleanup_temp_files)
    
    # Handle Ctrl+C gracefully
    def signal_handler(sig, frame):
        print("\nShutting down Booky...")
        cleanup_temp_files()
        sys.exit(0)
    
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    # Open browser after a short delay
    def open_browser():
        time.sleep(1)
        webbrowser.open(f'http://localhost:{HTTP_PORT}')
    
    threading.Thread(target=open_browser, daemon=True).start()
    
    # Start the server
    try:
        run_server()
    except KeyboardInterrupt:
        print("\nShutting down Booky...")
        cleanup_temp_files()


if __name__ == '__main__':
    main()
