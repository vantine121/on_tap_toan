import os, sys, glob, re, json, zipfile, io
import docx
from PIL import Image
from docx.text.paragraph import Paragraph
from docx.table import Table

sys.stdout.reconfigure(encoding='utf-8')

TOPIC_TITLES = {
    1: "Tập hợp số tự nhiên & phần tử",
    2: "Biểu diễn số tự nhiên trong hệ thập phân",
    3: "Số tự nhiên & Ghi số La Mã",
    4: "Thuật ngữ tập hợp, phần tử thuộc / không thuộc",
    5: "Thứ tự thực hiện các phép tính",
    6: "Phép tính cộng, trừ, nhân, chia số tự nhiên",
    7: "Vận dụng tính chất các phép tính",
    8: "Phép tính lũy thừa với số mũ tự nhiên",
    9: "Vận dụng tính chất để tính nhẩm, tính nhanh",
    10: "Toán thực tế gắn với phép tính (Phần 1)",
    11: "Toán thực tế gắn với phép tính (Phần 2)",
    12: "Quan hệ chia hết, ước và bội",
    13: "Số nguyên tố, hợp số",
    14: "Phép chia có dư & Định lý chia có dư",
    15: "Nhận biết phân số tối giản",
    16: "Dấu hiệu chia hết cho 2, 3, 5, 9",
    17: "Phân tích một số ra thừa số nguyên tố",
    18: "Ước chung, ƯCLN, Bội chung, BCNN",
    19: "Vận dụng số học giải quyết thực tế (Cơ bản)",
    20: "Vận dụng số học giải quyết thực tế (Vận dụng cao)",
    21: "Số nguyên âm & Tập hợp các số nguyên",
    22: "Số đối của một số nguyên",
    23: "Thứ tự trong tập hợp số nguyên",
    24: "Ý nghĩa của số nguyên âm trong đời sống",
    25: "Biểu diễn số nguyên trên trục số",
    26: "So sánh hai số nguyên",
    27: "Bội và ước của một số nguyên",
    28: "Các phép tính cộng, trừ, nhân, chia số nguyên",
    29: "Quy tắc dấu ngoặc & tính chất phép tính số nguyên",
    30: "Toán thực tế phép tính số nguyên (Cơ bản)",
    31: "Toán thực tế phép tính số nguyên (Nâng cao)",
    33: "Khái niệm & Quy tắc hai phân số bằng nhau",
    34: "Hai tính chất cơ bản của phân số",
    35: "Số đối của một phân số",
    36: "Nhận biết hỗn số dương",
    37: "So sánh hai phân số",
    38: "Phép tính cộng, trừ, nhân, chia phân số",
    39: "Tính chất phép tính & Quy tắc dấu ngoặc với phân số",
    40: "Tìm giá trị phân số của một số & Tìm một số",
    41: "Toán thực tế về phép tính phân số (Cơ bản)",
    42: "Toán thực tế về phép tính phân số (Nâng cao)",
    52: "Tam giác đều, hình vuông, lục giác đều (Nhận biết)",
    53: "Tam giác vuông, hình vuông, lục giác đều (Tính chất)",
    54: "Tam giác đều, hình vuông, lục giác đều (Ứng dụng)"
}

def clean_text(text):
    if not text:
        return ""
    text = re.sub(r'[\r\t]+', ' ', text)
    text = re.sub(r' +', ' ', text)
    return text.strip()

def extract_para_text_and_images(p, doc_part, topic_id, img_map, media_zip, out_img_dir):
    parts = []
    for r in p.runs:
        t = r.text
        blips = r._element.xpath('.//@r:id') or r._element.xpath('.//@r:embed')
        for rel_id in blips:
            if rel_id in doc_part.rels:
                rel = doc_part.rels[rel_id]
                target = rel.target_ref
                if 'image' in target.lower():
                    img_filename = os.path.basename(target)
                    key = f"t{topic_id}_{img_filename}"
                    out_png_name = os.path.splitext(key)[0] + ".png"
                    out_png_path = os.path.join(out_img_dir, out_png_name)
                    
                    if key not in img_map:
                        zip_entry = "word/" + target
                        if zip_entry in media_zip.namelist():
                            try:
                                raw_bytes = media_zip.read(zip_entry)
                                img = Image.open(io.BytesIO(raw_bytes))
                                os.makedirs(out_img_dir, exist_ok=True)
                                img.save(out_png_path, format="PNG")
                                img_map[key] = f"/static/images/{out_png_name}"
                            except Exception:
                                pass
                    
                    if key in img_map:
                        parts.append(f'<img src="{img_map[key]}" class="math-img" alt="công thức" />')
        if t:
            parts.append(t)
    return clean_text(''.join(parts))

def parse_options_text(text):
    text = text.strip()
    p1 = r'A\s*[\.:\)](.*?)(?=B\s*[\.:\)])B\s*[\.:\)](.*?)(?=C\s*[\.:\)])C\s*[\.:\)](.*?)(?=D\s*[\.:\)])D\s*[\.:\)](.*)'
    m = re.search(p1, text, re.DOTALL)
    if m:
        return {
            'A': clean_opt(m.group(1)),
            'B': clean_opt(m.group(2)),
            'C': clean_opt(m.group(3)),
            'D': clean_opt(m.group(4))
        }
    return None

def clean_opt(opt):
    opt = opt.strip()
    opt = re.sub(r'^\s*[\.:\)]\s*', '', opt)
    opt = re.sub(r'\s*\.\s*$', '', opt)
    return opt.strip()

def clean_explanation(text):
    if not text:
        return ""
    lines = text.split('\n')
    filtered = []
    for l in lines:
        cleaned = l.strip()
        if cleaned.lower() == 'lời giải':
            continue
        filtered.append(cleaned)
    return ' '.join(filtered).strip()

def process_all_files(input_folder, output_json, output_img_dir):
    os.makedirs(os.path.dirname(output_json), exist_ok=True)
    os.makedirs(output_img_dir, exist_ok=True)
    
    files = glob.glob(os.path.join(input_folder, '*.docx'))
    files = [f for f in files if not os.path.basename(f).startswith('~$')]
    
    def get_num(fname):
        m = re.search(r'TOAN6\s+(\d+)', fname)
        return int(m.group(1)) if m else 999
        
    files = sorted(files, key=lambda f: get_num(os.path.basename(f)))
    print(f"Bắt đầu xử lý {len(files)} file tài liệu Toán 6...", flush=True)
    
    img_map = {}
    all_topics = []
    total_questions = 0
    
    for f_idx, file_path in enumerate(files):
        bn = os.path.basename(file_path)
        lesson_num = get_num(bn)
        topic_title = TOPIC_TITLES.get(lesson_num, f"Bài {lesson_num}")
        full_title = f"Bài {lesson_num}: {topic_title}"
        
        try:
            with zipfile.ZipFile(file_path) as media_zip:
                doc = docx.Document(file_path)
                
                # 1. Parse answers
                answers = {}
                for tbl in doc.tables:
                    for row in tbl.rows:
                        for cell in row.cells:
                            t = clean_text(cell.text)
                            m = re.match(r'^(\d+)\s*[\.:\s]\s*([A-D])\b', t)
                            if m:
                                answers[int(m.group(1))] = m.group(2).upper()
                                
                # 2. Body elements
                body_elements = list(doc.element.body)
                sec1_start = 0
                sec1_end = len(body_elements)
                sec2_start = -1
                
                for idx, elem in enumerate(body_elements):
                    tag = elem.tag.split('}')[-1]
                    txt = ""
                    if tag == 'p':
                        txt = clean_text(Paragraph(elem, doc).text)
                    if 'PHẦN TRẮC NGHIỆM' in txt.upper() and sec1_start == 0:
                        sec1_start = idx + 1
                    elif 'PHẦN TỰ LUẬN' in txt.upper() or 'II. TỰ LUẬN' in txt.upper():
                        if sec1_end == len(body_elements):
                            sec1_end = idx
                    elif 'HƯỚNG DẪN GIẢI' in txt.upper() or 'LỜI GIẢI CHI TIẾT' in txt.upper():
                        if sec1_end == len(body_elements):
                            sec1_end = idx
                        if sec2_start == -1:
                            sec2_start = idx
                            
                # 3. Explanations from Section II
                explanations = {}
                if sec2_start != -1:
                    cur_q = None
                    cur_expl = []
                    for elem in body_elements[sec2_start:]:
                        tag = elem.tag.split('}')[-1]
                        if tag == 'p':
                            p_txt = extract_para_text_and_images(Paragraph(elem, doc), doc.part, lesson_num, img_map, media_zip, output_img_dir)
                            m_cq = re.match(r'^(?:ID\s*\d+.*?)?Câu\s+(\d+)[\.:\s]', p_txt)
                            if m_cq:
                                if cur_q and cur_expl:
                                    explanations[cur_q] = '\n'.join(cur_expl).strip()
                                cur_q = int(m_cq.group(1))
                                cur_expl = []
                            elif cur_q:
                                m_ans = re.search(r'Chọn\s+([A-D])\b', p_txt)
                                if m_ans and cur_q not in answers:
                                    answers[cur_q] = m_ans.group(1).upper()
                                if not re.match(r'^[A-D]\s*[\.:\)]', p_txt):
                                    cur_expl.append(p_txt)
                    if cur_q and cur_expl:
                        explanations[cur_q] = '\n'.join(cur_expl).strip()
                        
                # 4. Extract items from Section I
                questions = []
                raw_items = []
                for elem in body_elements[sec1_start:sec1_end]:
                    tag = elem.tag.split('}')[-1]
                    if tag == 'p':
                        p_txt = extract_para_text_and_images(Paragraph(elem, doc), doc.part, lesson_num, img_map, media_zip, output_img_dir)
                        if p_txt:
                            raw_items.append(('p', p_txt))
                    elif tag == 'tbl':
                        tbl_obj = Table(elem, doc)
                        row_cells = []
                        for row in tbl_obj.rows:
                            row_cells.append([extract_para_text_and_images(c.paragraphs[0], doc.part, lesson_num, img_map, media_zip, output_img_dir) if c.paragraphs else "" for c in row.cells])
                        raw_items.append(('tbl', row_cells))
                        
                # Assemble questions
                cur_q_num = None
                cur_q_text = []
                cur_options_text = []
                cur_tbl_options = None
                
                def save_q():
                    nonlocal cur_q_num, cur_q_text, cur_options_text, cur_tbl_options
                    if cur_q_num is None:
                        return
                    opts = None
                    if cur_tbl_options:
                        flat = [item for sub in cur_tbl_options for item in sub if item.strip()]
                        if len(flat) >= 4:
                            opts = {}
                            for i_opt, opt_l in enumerate(['A', 'B', 'C', 'D']):
                                clean_v = re.sub(r'^[A-D]\s*[\.:\)]\s*', '', flat[i_opt]).strip()
                                opts[opt_l] = clean_v
                    if not opts and cur_options_text:
                        joined = ' '.join(cur_options_text)
                        opts = parse_options_text(joined)
                        
                    ans = answers.get(cur_q_num, "")
                    expl = clean_explanation(explanations.get(cur_q_num, ""))
                    
                    if opts and len(opts) == 4 and (opts['A'] or opts['B']):
                        q_content = clean_text(' '.join(cur_q_text))
                        q_content = re.sub(r'^(?:ID\s*\d+.*?)?Câu\s+\d+[\.:\s]*', '', q_content).strip()
                        questions.append({
                            "id": f"t{lesson_num}_q{cur_q_num}",
                            "num": cur_q_num,
                            "topicId": lesson_num,
                            "topicTitle": full_title,
                            "content": q_content,
                            "options": opts,
                            "correct": ans,
                            "explanation": expl
                        })
                    
                    cur_q_num = None
                    cur_q_text = []
                    cur_options_text = []
                    cur_tbl_options = None

                for item_type, item_data in raw_items:
                    if item_type == 'p':
                        m_q = re.match(r'^(?:ID\s*\d+.*?)?Câu\s+(\d+)[\.:\s]*(.*)', item_data)
                        if m_q:
                            save_q()
                            cur_q_num = int(m_q.group(1))
                            rest = m_q.group(2).strip()
                            if rest:
                                cur_q_text.append(rest)
                        elif cur_q_num is not None:
                            if re.match(r'^[A-D]\s*[\.:\)]', item_data):
                                cur_options_text.append(item_data)
                            elif cur_options_text:
                                cur_options_text.append(item_data)
                            else:
                                cur_q_text.append(item_data)
                    elif item_type == 'tbl':
                        if cur_q_num is not None:
                            cur_tbl_options = item_data
                            save_q()
                            
                save_q()
                
                # Fallback for files without "Câu X" (like file 13)
                if not questions and raw_items:
                    q_c = 1
                    i_item = 0
                    while i_item < len(raw_items):
                        itype, idata = raw_items[i_item]
                        if itype == 'p':
                            if i_item + 1 < len(raw_items) and raw_items[i_item+1][0] == 'p' and re.match(r'^A\s*[\.:\)]', raw_items[i_item+1][1]):
                                q_txt = idata
                                opt_txt = raw_items[i_item+1][1]
                                if i_item + 2 < len(raw_items) and raw_items[i_item+2][0] == 'p' and re.match(r'^C\s*[\.:\)]', raw_items[i_item+2][1]):
                                    opt_txt += ' ' + raw_items[i_item+2][1]
                                    i_item += 1
                                i_item += 1
                                opts = parse_options_text(opt_txt)
                                if opts:
                                    ans = answers.get(q_c, "")
                                    expl = clean_explanation(explanations.get(q_c, ""))
                                    questions.append({
                                        "id": f"t{lesson_num}_q{q_c}",
                                        "num": q_c,
                                        "topicId": lesson_num,
                                        "topicTitle": full_title,
                                        "content": q_txt,
                                        "options": opts,
                                        "correct": ans,
                                        "explanation": expl
                                    })
                                    q_c += 1
                        i_item += 1
                
                print(f"[{f_idx+1:02d}/{len(files)}] {full_title} -> {len(questions)} câu hỏi", flush=True)
                total_questions += len(questions)
                all_topics.append({
                    "id": lesson_num,
                    "title": full_title,
                    "filename": bn,
                    "count": len(questions),
                    "questions": questions
                })
        except Exception as e:
            print(f"Lỗi file {bn}: {e}", flush=True)

    result_data = {
        "summary": {
            "totalTopics": len(all_topics),
            "totalQuestions": total_questions
        },
        "topics": all_topics
    }
    
    with open(output_json, 'w', encoding='utf-8') as out_f:
        json.dump(result_data, out_f, ensure_ascii=False, indent=2)
        
    print(f"\n HOÀN THÀNH! Đã chuyển đổi tổng cộng {len(all_topics)} chủ đề và {total_questions} câu hỏi trắc nghiệm Toán 6!", flush=True)
    print(f"File kết quả: {output_json}", flush=True)
    print(f"Thư mục ảnh công thức: {output_img_dir} ({len(img_map)} ảnh)", flush=True)

if __name__ == "__main__":
    in_dir = r"Theo bài\Theo bài"
    out_json = r"data\questions.json"
    out_img = r"static\images"
    process_all_files(in_dir, out_json, out_img)
