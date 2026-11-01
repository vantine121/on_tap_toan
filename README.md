# Website Ôn Tập Trắc Nghiệm Toán 6 Online

Hệ thống web trắc nghiệm Toán 6 hoàn chỉnh được xây dựng tự động từ **44 file Word (bộ câu hỏi trong thư mục `Theo bài`)**, chứa **721 câu hỏi trắc nghiệm ABCD** cùng đầy đủ công thức toán, hình ảnh minh họa và lời giải chi tiết.

---

## 🌟 Các Tính Năng Nổi Bật

1. **Không cần đăng nhập**: Học sinh chỉ cần điền **Họ và tên** (và Lớp nếu muốn). Hệ thống tự động lưu vào trình duyệt của học sinh.
2. **2 Chế độ ôn tập linh hoạt**:
   - **Ôn theo từng chủ đề**: Chọn 1 trong 44 bài học Toán 6 (Số tự nhiên, Số nguyên, Phân số, Hình học trực quan), chọn số lượng câu (10 câu, 15 câu, hoặc tất cả), không giới hạn thời gian.
   - **Thi thử / Ôn tập tổng hợp**: Hệ thống tự động bốc ngẫu nhiên câu hỏi từ tất cả các chủ đề Toán 6, có đồng hồ đếm ngược (30 phút, 45 phút, 60 phút) và tự nộp khi hết giờ.
3. **Chấm điểm & Nhận xét sư phạm tự động**:
   - Chấm điểm ngay lập tức theo thang điểm 10.
   - Nhận xét đánh giá năng lực của học sinh (Xuất sắc, Giỏi, Khá, Cần cố gắng...).
   - Hiển thị bảng tổng kết số câu đúng, độ chính xác, thời gian làm.
   - **Xem lại chi tiết từng câu**: Đánh dấu câu làm đúng (màu xanh), câu làm sai (màu đỏ) và hiển thị khung **Hướng dẫn giải chi tiết** từng bước.
4. **Bảng Thống kê & Quản lý dành cho Giáo viên**:
   - Bảng tổng hợp tất cả lượt học sinh vào làm bài: Họ tên, Lớp, Chủ đề, Điểm số, Số câu đúng, Thời gian làm, Ngày giờ nộp.
   - Các chỉ số: Tổng lượt nộp bài, Điểm trung bình, Điểm cao nhất.
   - Nút **📥 Xuất file Excel / CSV** chuẩn tiếng Việt (UTF-8 BOM) để thầy cô mở trực tiếp bằng Excel, gửi phụ huynh hoặc vào sổ điểm.
5. **Hiển thị công thức toán học hoàn hảo**: Tất cả công thức MathType và hình vẽ hình học trong 44 file Word đã được chuyển đổi thành ảnh PNG chất lượng cao, hiển thị mượt mà trên cả máy tính và điện thoại.

---

## 🚀 Cách Sử Dụng Ngay Trên Máy Tính / Mạng LAN (Offline & Nội Bộ)

Thầy/Cô có thể khởi động hệ thống chỉ với **1 cú nhấp chuột**:

1. **Nhấp đúp chuột vào file `run_server.bat`** (hoặc mở Terminal gõ `python run.py`).
2. Trình duyệt web sẽ tự động mở trang web tại địa chỉ:
   ```
   http://localhost:8000
   ```
3. **Cho học sinh trong lớp làm bài (cùng mạng WiFi với máy giáo viên)**:
   - Trong cửa sổ đen vừa bật lên, sẽ có dòng:
     `👉 Cho học sinh trong mạng WiFi/LAN: http://192.168.x.x:8000`
   - Thầy/Cô chỉ cần viết địa chỉ đó lên bảng (hoặc tạo mã QR cho link đó bằng qr-code-generator.com). Học sinh dùng điện thoại, máy tính bảng hoặc laptop trong lớp truy cập là vào làm bài được ngay!

---

## 🌐 Hướng Dẫn Đưa Lên Mạng Internet (Online 24/7 Miễn Phí)

Để học sinh ở nhà hoặc bất cứ đâu có thể truy cập qua Internet, Thầy/Cô có thể đưa trang web lên các dịch vụ máy chủ đám mây miễn phí:

### Cách 1: Triển khai lên Render.com (Khuyên dùng - Rất dễ & Miễn phí)
1. Tạo một tài khoản miễn phí trên [https://github.com](https://github.com) và [https://render.com](https://render.com).
2. Tạo một GitHub Repository mới và đẩy toàn bộ thư mục `webontap` lên GitHub.
3. Đăng nhập vào Render.com -> Bấm **New** -> Chọn **Web Service**.
4. Kết nối tới Repository GitHub vừa tạo.
5. Điền thông tin:
   - **Environment**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn backend.app:app --host 0.0.0.0 --port $PORT`
6. Bấm **Create Web Service**. Sau 1-2 phút, Render sẽ cung cấp cho Thầy/Cô một đường link dạng:
   `https://toan6-ontap.onrender.com`
   -> Thầy/Cô gửi link này vào nhóm Zalo lớp để học sinh vào ôn tập bất kỳ lúc nào!

### Cách 2: Triển khai lên Koyeb hoặc Railway
Tương tự như Render, chỉ cần kết nối GitHub là hệ thống sẽ tự động nhận diện `requirements.txt` và khởi chạy máy chủ.

---

## 📁 Cấu Trúc Thư Mục

- `Theo bài/Theo bài/`: 44 file đề Word gốc.
- `backend/`:
  - `app.py`: Máy chủ FastAPI xử lý API, nộp bài, tính điểm, xuất file Excel.
  - `database.py`: Cơ sở dữ liệu SQLite lưu lịch sử làm bài của học sinh.
  - `extract_data.py`: Bộ chuyển đổi tự động từ Word sang JSON và ảnh.
- `data/`:
  - `questions.json`: 721 câu hỏi Toán 6 phân theo 44 chủ đề.
  - `exam.db`: File SQLite lưu bảng điểm học sinh.
- `static/`:
  - `css/style.css`: Giao diện hiện đại, tối ưu cho máy tính và điện thoại.
  - `js/app.js`: Xử lý giao diện, làm bài, đồng hồ, nộp bài, chấm điểm.
  - `images/`: Hơn 15.000 hình ảnh công thức toán học và hình vẽ hình học.
- `index.html`: Giao diện chính của website.
- `run_server.bat`: File nhấp đúp để chạy ngay trên Windows.
