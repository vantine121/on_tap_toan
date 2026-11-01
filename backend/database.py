import sqlite3
import os
import json
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data', 'exam.db')

def get_connection():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS submissions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_name TEXT NOT NULL,
            student_class TEXT,
            mode TEXT NOT NULL,
            topic_id INTEGER,
            topic_title TEXT,
            score REAL NOT NULL,
            correct_count INTEGER NOT NULL,
            total_questions INTEGER NOT NULL,
            time_spent INTEGER NOT NULL,
            details_json TEXT,
            created_at TEXT NOT NULL
        )
    ''')
    conn.commit()
    conn.close()

def save_submission(student_name, student_class, mode, topic_id, topic_title, score, correct_count, total_questions, time_spent, details):
    conn = get_connection()
    cursor = conn.cursor()
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    cursor.execute('''
        INSERT INTO submissions (
            student_name, student_class, mode, topic_id, topic_title,
            score, correct_count, total_questions, time_spent, details_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        student_name.strip(),
        (student_class or "").strip(),
        mode,
        topic_id,
        topic_title,
        round(score, 1),
        correct_count,
        total_questions,
        time_spent,
        json.dumps(details, ensure_ascii=False),
        now_str
    ))
    conn.commit()
    sub_id = cursor.lastrowid
    conn.close()
    return sub_id

def get_submissions(limit=100, topic_id=None, search=None):
    conn = get_connection()
    cursor = conn.cursor()
    query = "SELECT id, student_name, student_class, mode, topic_id, topic_title, score, correct_count, total_questions, time_spent, created_at FROM submissions WHERE 1=1"
    params = []
    
    if topic_id:
        query += " AND topic_id = ?"
        params.append(topic_id)
    if search:
        query += " AND (student_name LIKE ? OR student_class LIKE ?)"
        params.append(f"%{search}%")
        params.append(f"%{search}%")
        
    query += " ORDER BY id DESC LIMIT ?"
    params.append(limit)
    
    cursor.execute(query, params)
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return rows

def get_submission_detail(sub_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM submissions WHERE id = ?", (sub_id,))
    row = cursor.fetchone()
    conn.close()
    if not row:
        return None
    res = dict(row)
    if res.get('details_json'):
        res['details'] = json.loads(res['details_json'])
    return res

def get_stats():
    conn = get_connection()
    cursor = conn.cursor()
    
    # Total submissions
    cursor.execute("SELECT COUNT(*), AVG(score), MAX(score) FROM submissions")
    total, avg_score, max_score = cursor.fetchone()
    
    # Recent submissions
    cursor.execute("SELECT id, student_name, student_class, mode, topic_title, score, correct_count, total_questions, time_spent, created_at FROM submissions ORDER BY id DESC LIMIT 50")
    recent = [dict(r) for r in cursor.fetchall()]
    
    # Distribution of scores: 0-4.9 (Yếu/Kém), 5-6.4 (Trung bình), 6.5-7.9 (Khá), 8-8.9 (Giỏi), 9-10 (Xuất sắc)
    cursor.execute('''
        SELECT 
            SUM(CASE WHEN score < 5.0 THEN 1 ELSE 0 END) as poor,
            SUM(CASE WHEN score >= 5.0 AND score < 6.5 THEN 1 ELSE 0 END) as average,
            SUM(CASE WHEN score >= 6.5 AND score < 8.0 THEN 1 ELSE 0 END) as good,
            SUM(CASE WHEN score >= 8.0 AND score < 9.0 THEN 1 ELSE 0 END) as very_good,
            SUM(CASE WHEN score >= 9.0 THEN 1 ELSE 0 END) as excellent
        FROM submissions
    ''')
    dist_row = cursor.fetchone()
    
    conn.close()
    return {
        "total_submissions": total or 0,
        "average_score": round(avg_score, 1) if avg_score is not None else 0.0,
        "highest_score": round(max_score, 1) if max_score is not None else 0.0,
        "distribution": {
            "poor": dist_row[0] or 0,
            "average": dist_row[1] or 0,
            "good": dist_row[2] or 0,
            "very_good": dist_row[3] or 0,
            "excellent": dist_row[4] or 0
        },
        "recent": recent
    }

def clear_all_data():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM submissions")
    conn.commit()
    conn.close()

init_db()
