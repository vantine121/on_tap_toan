import os
import sys
import socket
import webbrowser
import uvicorn

def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

if __name__ == "__main__":
    local_ip = get_local_ip()
    port = 8000
    
    print("=" * 65)
    print("   HỆ THỐNG ÔN TẬP TRẮC NGHIỆM TOÁN 6 ONLINE")
    print("=" * 65)
    print(f"👉 Trên máy của Thầy/Cô: http://localhost:{port}")
    print(f"👉 Cho học sinh trong mạng WiFi/LAN: http://{local_ip}:{port}")
    print("=" * 65)
    print("Học sinh không cần tài khoản, chỉ cần nhập tên để làm bài.")
    print("Thầy/Cô bấm Ctrl + C trong cửa sổ này để tắt máy chủ.")
    print("=" * 65)
    
    # Open browser automatically after 1 second
    try:
        webbrowser.open(f"http://localhost:{port}")
    except Exception:
        pass
        
    uvicorn.run("backend.app:app", host="0.0.0.0", port=port, reload=False)
