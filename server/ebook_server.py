"""
Local ebook server for opening files with system default applications.
Run this script before using the bookshelf app to enable opening DJVU/PDF files.
"""

import os
import sys
import subprocess
import tempfile
import base64
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # Enable CORS for local web app

# Store temp files to prevent deletion while app is open
temp_files = []

def open_with_system(file_path: str) -> tuple[bool, str]:
    """Open a file with the system's default application."""
    file_path = os.path.normpath(file_path)
    
    if not os.path.exists(file_path):
        return False, f"File not found: {file_path}"
    
    try:
        if sys.platform == 'win32':
            os.startfile(file_path)
        elif sys.platform == 'darwin':  # macOS
            subprocess.call(['open', file_path])
        else:  # Linux
            subprocess.call(['xdg-open', file_path])
        return True, "File opened successfully"
    except Exception as e:
        return False, str(e)

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint."""
    return jsonify({"status": "ok"})

@app.route('/open', methods=['POST'])
def open_file():
    """Open a file with the system's default application.
    
    Accepts either:
    - {"path": "full/path/to/file"} - opens file by path
    - {"data": "base64...", "filename": "book.pdf"} - saves temp file and opens
    """
    data = request.get_json()
    
    if not data:
        return jsonify({"success": False, "error": "No data provided"}), 400
    
    # Method 1: Open by path (if user configured library path)
    if 'path' in data:
        file_path = data['path']
        success, message = open_with_system(file_path)
        if success:
            return jsonify({"success": True, "message": message})
        else:
            return jsonify({"success": False, "error": message}), 500
    
    # Method 2: Receive file data, save to temp, and open
    if 'data' in data and 'filename' in data:
        try:
            # Decode base64 file data
            file_data = base64.b64decode(data['data'])
            filename = data['filename']
            
            # Get file extension
            _, ext = os.path.splitext(filename)
            
            # Create temp file with proper extension
            fd, temp_path = tempfile.mkstemp(suffix=ext)
            os.write(fd, file_data)
            os.close(fd)
            
            # Keep reference to prevent early deletion
            temp_files.append(temp_path)
            
            # Open with system default
            success, message = open_with_system(temp_path)
            
            if success:
                return jsonify({"success": True, "message": message, "tempPath": temp_path})
            else:
                # Clean up on failure
                try:
                    os.unlink(temp_path)
                    temp_files.remove(temp_path)
                except:
                    pass
                return jsonify({"success": False, "error": message}), 500
                
        except Exception as e:
            return jsonify({"success": False, "error": str(e)}), 500
    
    return jsonify({"success": False, "error": "Provide 'path' or 'data'+'filename'"}), 400

@app.route('/convert', methods=['POST'])
def convert_to_pdf():
    """Convert an ebook to PDF using Calibre's ebook-convert.
    
    Accepts:
    - {"data": "base64...", "filename": "book.epub", "settings": {...}}
    
    Settings (all optional):
    - page_size: a4, letter, a5, legal
    - orientation: portrait, landscape
    - margin_top, margin_bottom, margin_left, margin_right: number (mm)
    - font_size: number (pt)
    - font_family: serif, sans-serif, monospace
    - line_height: number
    - include_images: boolean
    - include_toc: boolean
    """
    data = request.get_json()
    
    if not data or 'data' not in data or 'filename' not in data:
        return jsonify({"success": False, "error": "Provide 'data' and 'filename'"}), 400
    
    try:
        # Decode base64 file data
        file_data = base64.b64decode(data['data'])
        filename = data['filename']
        settings = data.get('settings', {})
        
        # Get file extension
        name, ext = os.path.splitext(filename)
        
        # Create temp input file
        fd_in, input_path = tempfile.mkstemp(suffix=ext)
        os.write(fd_in, file_data)
        os.close(fd_in)
        
        # Create temp output file
        fd_out, output_path = tempfile.mkstemp(suffix='.pdf')
        os.close(fd_out)
        
        # Build ebook-convert command
        cmd = ['ebook-convert', input_path, output_path]
        
        # Add page size
        page_size = settings.get('page_size', 'a4')
        if page_size:
            cmd.extend(['--paper-size', page_size])
        
        # Add orientation (swap width/height for landscape)
        if settings.get('orientation') == 'landscape':
            cmd.extend(['--pdf-page-landscape'])
        
        # Add margins (default unit is pt, convert from mm)
        for margin in ['top', 'bottom', 'left', 'right']:
            key = f'margin_{margin}'
            if key in settings:
                # Convert mm to pt (1mm = 2.834645669 pt)
                pt_value = float(settings[key]) * 2.834645669
                cmd.extend([f'--pdf-page-margin-{margin}', str(int(pt_value))])
        
        # Add font size
        if 'font_size' in settings:
            cmd.extend(['--pdf-default-font-size', str(settings['font_size'])])
        
        # Add font family
        font_family = settings.get('font_family', 'serif')
        if font_family == 'serif':
            cmd.extend(['--pdf-serif-family', 'Georgia'])
        elif font_family == 'sans-serif':
            cmd.extend(['--pdf-sans-family', 'Arial'])
            cmd.extend(['--change-justification', 'left'])
        elif font_family == 'monospace':
            cmd.extend(['--pdf-mono-family', 'Courier'])
        
        # Add line height
        if 'line_height' in settings:
            cmd.extend(['--minimum-line-height', str(int(float(settings['line_height']) * 100))])
        
        # Remove images if requested
        if not settings.get('include_images', True):
            cmd.extend(['--filter-css', 'img'])
        
        # Add TOC if requested
        if settings.get('include_toc', True):
            cmd.extend(['--pdf-add-toc'])
        
        # Run conversion
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=300  # 5 minute timeout
        )
        
        # Clean up input file
        try:
            os.unlink(input_path)
        except:
            pass
        
        if result.returncode != 0:
            # Clean up output file on failure
            try:
                os.unlink(output_path)
            except:
                pass
            error_msg = result.stderr or result.stdout or "Conversion failed"
            return jsonify({"success": False, "error": error_msg}), 500
        
        # Read the output PDF
        with open(output_path, 'rb') as f:
            pdf_data = f.read()
        
        # Clean up output file
        try:
            os.unlink(output_path)
        except:
            pass
        
        # Return base64-encoded PDF
        pdf_base64 = base64.b64encode(pdf_data).decode('utf-8')
        output_filename = f"{name}.pdf"
        
        return jsonify({
            "success": True,
            "pdf_data": pdf_base64,
            "filename": output_filename
        })
        
    except subprocess.TimeoutExpired:
        return jsonify({"success": False, "error": "Conversion timed out (>5 minutes)"}), 500
    except FileNotFoundError:
        return jsonify({
            "success": False,
            "error": "Calibre not found. Install Calibre and ensure 'ebook-convert' is in PATH."
        }), 500
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/cleanup', methods=['POST'])
def cleanup_temp():
    """Clean up temporary files."""
    global temp_files
    cleaned = 0
    for path in temp_files[:]:
        try:
            if os.path.exists(path):
                os.unlink(path)
            temp_files.remove(path)
            cleaned += 1
        except:
            pass
    return jsonify({"success": True, "cleaned": cleaned})

if __name__ == '__main__':
    print("=" * 50)
    print("Bookshelf Ebook Server")
    print("=" * 50)
    print("This server allows the bookshelf app to open")
    print("files with your system's default applications.")
    print()
    print("Keep this window open while using the bookshelf app.")
    print("=" * 50)
    print()
    app.run(host='127.0.0.1', port=5050, debug=False)
