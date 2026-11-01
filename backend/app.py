import os
import json
import random
import io
import csv
from datetime import datetime
from fastapi import FastAPI, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse
from pydantic import BaseModel
from typing import Dict, Optional, List

from .database import save_submission, get_submissions, get_submission_detail, get_stats, clear_all_data

app = FastAPI(title="Website Ôn tập Trắc nghiệm Toán 6", version="1.0.0")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data', 'questions.json')
STATIC_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'static')
INDEX_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'index.html')

def load_data():
    if not os.path.exists(DATA_FILE):
        return {"summary": {"totalTopics": 0, "totalQuestions": 0}, "topics": []}
    with open(DATA_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)

# Mount static files
os.makedirs(STATIC_DIR, exist_ok=True)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

@app.get("/", response_class=HTMLResponse)
def get_home():
    if os.path.exists(INDEX_FILE):
        with open(INDEX_FILE, 'r', encoding='utf-8') as f:
            return f.read()
    return "<h1>Hệ thống Ôn tập Trắc nghiệm Toán 6 đang khởi động...</h1>"

@app.get("/api/topics")
def get_topics():
    data = load_data()
    topics_list = []
    for t in data.get("topics", []):
        topics_list.append({
            "id": t["id"],
            "title": t["title"],
            "count": t["count"],
            "filename": t.get("filename", "")
        })
    return {
        "summary": data.get("summary", {}),
        "topics": topics_list
    }

@app.get("/api/topic/{topic_id}/questions")
def get_topic_questions(topic_id: int, limit: Optional[int] = Query(None, description="Số câu muốn làm")):
    data = load_data()
    for t in data.get("topics", []):
        if t["id"] == topic_id:
            qs = t.get("questions", [])
            # Return questions without correct answer / explanation to prevent cheating before submit
            clean_qs = []
            selected_qs = qs[:]
            if limit and limit < len(selected_qs):
                selected_qs = random.sample(selected_qs, limit)
            for q in selected_qs:
                clean_qs.append({
                    "id": q["id"],
                    "num": q["num"],
                    "topicId": q["topicId"],
                    "topicTitle": q["topicTitle"],
                    "content": q["content"],
                    "options": q["options"]
                })
            return {
                "topic": {
                    "id": t["id"],
                    "title": t["title"],
                    "totalAvailable": len(qs)
                },
                "questions": clean_qs
            }
    raise HTTPException(status_code=404, detail="Không tìm thấy chủ đề này")

@app.get("/api/exam/mock")
def get_mock_exam(count: int = Query(20, description="Số câu trong đề thi thử (20, 30, 40)"),
                  time_minutes: int = Query(45, description="Thời gian làm bài")):
    data = load_data()
    all_questions = []
    for t in data.get("topics", []):
        for q in t.get("questions", []):
            if q.get("correct"): # Only include questions with valid answer
                all_questions.append(q)
                
    if not all_questions:
        raise HTTPException(status_code=404, detail="Chưa có câu hỏi nào trong hệ thống")
        
    num_to_pick = min(count, len(all_questions))
    selected = random.sample(all_questions, num_to_pick)
    
    clean_qs = []
    for idx, q in enumerate(selected):
        clean_qs.append({
            "id": q["id"],
            "num": idx + 1,
            "topicId": q["topicId"],
            "topicTitle": q["topicTitle"],
            "content": q["content"],
            "options": q["options"]
        })
        
    return {
        "title": f"Đề thi thử tổng hợp Toán 6 ({num_to_pick} câu - {time_minutes} phút)",
        "time_minutes": time_minutes,
        "total_questions": num_to_pick,
        "questions": clean_qs
    }

class SubmitRequest(BaseModel):
    student_name: str
    student_class: Optional[str] = ""
    mode: str # 'topic' or 'mock'
    topic_id: Optional[int] = None
    topic_title: Optional[str] = ""
    time_spent: int # in seconds
    answers: Dict[str, str] # question_id -> chosen option ('A', 'B', 'C', 'D')
    question_ids: List[str] # list of question ids in the test

@app.post("/api/exam/submit")
def submit_exam(req: SubmitRequest):
    if not req.student_name or not req.student_name.strip():
        raise HTTPException(status_code=400, detail="Vui lòng nhập họ và tên của học sinh")
        
    data = load_data()
    # Build question lookup map
    q_map = {}
    for t in data.get("topics", []):
        for q in t.get("questions", []):
            q_map[q["id"]] = q
            
    total_q = len(req.question_ids)
    if total_q == 0:
        raise HTTPException(status_code=400, detail="Đề thi không có câu hỏi nào")
        
    correct_count = 0
    detailed_results = []
    
    for qid in req.question_ids:
        q = q_map.get(qid)
        if not q:
            continue
        student_ans = req.answers.get(qid, "").upper().strip()
        correct_ans = q.get("correct", "").upper().strip()
        is_correct = (student_ans == correct_ans and student_ans != "")
        if is_correct:
            correct_count += 1
            
        detailed_results.append({
            "id": q["id"],
            "num": q["num"],
            "topicTitle": q.get("topicTitle", ""),
            "content": q["content"],
            "options": q["options"],
            "student_answer": student_ans,
            "correct_answer": correct_ans,
            "is_correct": is_correct,
            "explanation": q.get("explanation", "")
        })
        
    score = (correct_count / total_q) * 10.0
    
    # Generate Evaluation
    if score >= 9.0:
        eval_text = "🌟 Xuất sắc! Em nắm rất vững kiến thức và làm bài rất cẩn thận, chuẩn xác. Tiếp tục phát huy nhé!"
        badge = "badge-excellent"
    elif score >= 8.0:
        eval_text = "🎉 Giỏi lắm! Em đã hoàn thành bài thi rất tốt. Hãy xem lại vài câu chưa đúng để đạt điểm tuyệt đối nhé!"
        badge = "badge-good"
    elif score >= 6.5:
        eval_text = "👍 Khá tốt! Em đã nắm được hầu hết các kiến thức trọng tâm. Hãy đọc kỹ phần giải thích của những câu sai để nhớ lâu hơn."
        badge = "badge-fair"
    elif score >= 5.0:
        eval_text = "⚡ Đạt yêu cầu! Em cần ôn lại các công thức và quy tắc tính toán. Hãy bấm vào xem lời giải chi tiết bên dưới nhé!"
        badge = "badge-average"
    else:
        eval_text = "💪 Cần cố gắng hơn nữa! Em hãy bình tĩnh đọc kỹ lại từng phần lý thuyết và xem hướng dẫn giải chi tiết bên dưới để làm lại tốt hơn nhé!"
        badge = "badge-retry"
        
    topic_name = req.topic_title or ("Thi thử tổng hợp" if req.mode == "mock" else f"Chủ đề {req.topic_id}")
    
    # Save to SQLite
    sub_id = save_submission(
        student_name=req.student_name,
        student_class=req.student_class,
        mode=req.mode,
        topic_id=req.topic_id,
        topic_title=topic_name,
        score=score,
        correct_count=correct_count,
        total_questions=total_q,
        time_spent=req.time_spent,
        details=detailed_results
    )
    
    return {
        "submission_id": sub_id,
        "student_name": req.student_name,
        "student_class": req.student_class,
        "score": round(score, 1),
        "correct_count": correct_count,
        "total_questions": total_q,
        "time_spent": req.time_spent,
        "evaluation": eval_text,
        "badge": badge,
        "details": detailed_results
    }

@app.get("/api/stats")
def get_statistics():
    return get_stats()

@app.get("/api/stats/submissions")
def get_submissions_list(limit: int = 100, topic_id: Optional[int] = None, search: Optional[str] = None):
    return get_submissions(limit=limit, topic_id=topic_id, search=search)

@app.get("/api/stats/submission/{sub_id}")
def get_submission_by_id(sub_id: int):
    detail = get_submission_detail(sub_id)
    if not detail:
        raise HTTPException(status_code=404, detail="Không tìm thấy bài làm này")
    return detail

@app.get("/api/stats/export")
def export_csv():
    subs = get_submissions(limit=1000)
    output = io.StringIO()
    # Write UTF-8 BOM so Excel opens Vietnamese characters properly
    output.write('\ufeff')
    writer = csv.writer(output)
    writer.writerow(["Mã bài", "Họ và tên học sinh", "Lớp", "Chế độ ôn tập", "Chủ đề / Đề thi", "Điểm số (Thang 10)", "Số câu đúng", "Tổng số câu", "Thời gian làm (giây)", "Ngày giờ nộp"])
    
    for s in subs:
        writer.writerow([
            s["id"],
            s["student_name"],
            s.get("student_class", ""),
            "Ôn theo chủ đề" if s["mode"] == "topic" else "Thi thử tổng hợp",
            s.get("topic_title", ""),
            s["score"],
            s["correct_count"],
            s["total_questions"],
            s["time_spent"],
            s["created_at"]
        ])
        
    output.seek(0)
    headers = {
        'Content-Disposition': f'attachment; filename="thong_ke_lam_bai_toan6_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv"'
    }
    return Response(content=output.getvalue(), media_type="text/csv; charset=utf-8", headers=headers)

@app.delete("/api/stats/clear")
def clear_stats():
    clear_all_data()
    return {"message": "Đã xóa toàn bộ lịch sử làm bài thành công"}
