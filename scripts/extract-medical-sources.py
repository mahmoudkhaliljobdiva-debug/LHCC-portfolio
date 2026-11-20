"""Read every available authorized source page locally. OCR is NEVER medical approval.

Requires the optional ignored QA venv: PyMuPDF + rapidocr_onnxruntime.
Outputs private page transcripts, confidence and render references under .test-artifacts.
No network, production writes, guessed answers or source modifications.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import concurrent.futures

ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = ROOT / ".test-artifacts" / "medical-sources"


def extract(source):
    import pymupdf
    selected_engine = source.get("_engine", "tesseract")
    if selected_engine == "rapidocr":
        import numpy as np
        import cv2
        import onnxruntime as ort
        original_options = ort.SessionOptions
        def bounded_options():
            options = original_options()
            options.intra_op_num_threads = 1
            options.inter_op_num_threads = 1
            options.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL
            return options
        ort.SessionOptions = bounded_options
        cv2.setNumThreads(1)
        from rapidocr_onnxruntime import RapidOCR
    path = ARTIFACTS / (source["driveFileId"] + ".pdf")
    if not path.exists():
        return {"name": source["name"], "status": "MISSING_SOURCE"}
    fingerprint = hashlib.file_digest(path.open("rb"), "sha256").hexdigest()
    if fingerprint != source["sha256"]:
        return {"name": source["name"], "status": "INCOMPLETE_OR_CHANGED_SOURCE", "bytes": path.stat().st_size}
    destination = ARTIFACTS / source["driveFileId"]
    destination.mkdir(exist_ok=True)
    document = pymupdf.open(path)
    if len(document) != source["pages"]:
        return {"name": source["name"], "status": "PAGE_COUNT_CONFLICT", "actualPages": len(document)}
    engine = None
    for index, page in enumerate(document):
        output = destination / (str(index + 1) + ".json")
        if output.exists() and source.get("_retry_unreadable") and json.loads(output.read_text(encoding="utf-8"))["text"].strip():
            continue
        if output.exists() and not source.get("_refresh"):
            continue
        if output.exists():
            previous = output.read_bytes()
            history = destination / "previous-ocr"
            history.mkdir(exist_ok=True)
            (history / (str(index + 1) + "-" + hashlib.sha256(previous).hexdigest()[:12] + ".json")).write_bytes(previous)
        text = page.get_text(sort=True)
        mode, blocks = "TEXT_LAYER", []
        pix = page.get_pixmap(matrix=pymupdf.Matrix(min(1.0, 2000 / page.rect.width), min(1.0, 2000 / page.rect.width)), alpha=False)
        image_path = destination / (str(index + 1) + ".jpg")
        pix.save(image_path, jpg_quality=85)
        if len(text.strip()) < 40:
            if selected_engine == "tesseract":
                tp = page.get_textpage_ocr(language="eng", dpi=source.get("_dpi", 72), full=True, tessdata=str(ARTIFACTS / "tessdata"))
                structured = page.get_text("dict", textpage=tp)
                scale = pix.width / page.rect.width
                for block in structured["blocks"]:
                    for line in block.get("lines", []):
                        x0, y0, x1, y1 = [coordinate * scale for coordinate in line["bbox"]]
                        blocks.append({"box": [[x0,y0],[x1,y0],[x1,y1],[x0,y1]], "text": "".join(span["text"] for span in line["spans"]), "confidence": None})
            else:
                if engine is None:
                    engine = RapidOCR()
                result, _ = engine(np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n))
                blocks = [{"box": row[0], "text": row[1], "confidence": float(row[2])} for row in (result or [])]
            # Fixed exam-player chrome is not part of the question. Preserve it in
            # raw OCR blocks, while parsing only the central source content region.
            body = [block for block in blocks if min(point[1] for point in block["box"]) > pix.height * .065 and max(point[1] for point in block["box"]) < pix.height * .935]
            text = "\n".join(block["text"] for block in body)
            mode = "OCR_UNVERIFIED"
        warnings = ["OCR and medical content require explicit visual comparison and Admin review."] if mode == "OCR_UNVERIFIED" else ["Extracted text requires original-page and diagram/table review."]
        if not text.strip():
            warnings.append("No readable text detected; manual transcription required.")
        if selected_engine == "tesseract" and mode == "OCR_UNVERIFIED":
            warnings.append("Tesseract confidence is not exposed by this PDF API. Original-page comparison is mandatory.")
        if any(block["confidence"] is not None and block["confidence"] < .9 for block in blocks):
            warnings.append("Low-confidence OCR lines are present. Do not approve without correction.")
        output.write_text(json.dumps({"page": index + 1, "text": text, "mode": mode, "engine": selected_engine, "hasImages": bool(page.get_images()), "warnings": warnings, "blocks": blocks, "render": str(image_path.relative_to(ROOT))}, ensure_ascii=False), encoding="utf-8")
        print(json.dumps({"source": source["name"], "page": index + 1, "total": len(document), "mode": mode}), flush=True)
    pages = [json.loads((destination / (str(i + 1) + ".json")).read_text(encoding="utf-8")) for i in range(len(document))]
    candidates = sum(len(re.findall(r"(?m)^(?:[Qq]uestion\s+)?\d+\s*[.)]\s+\S", page["text"])) for page in pages)
    result = {"name": source["name"], "status": "PAGES_EXTRACTED_PENDING_REVIEW", "pages": len(document), "ocrPages": sum(p["mode"] == "OCR_UNVERIFIED" for p in pages), "candidateStarts": candidates, "verifiedAnswers": 0, "approved": 0}
    (destination / "summary.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--workers", type=int, choices=range(1, 5), default=2)
    parser.add_argument("--subject")
    parser.add_argument("--exclude-subject")
    parser.add_argument("--engine", choices=["tesseract", "rapidocr"], default="tesseract")
    parser.add_argument("--refresh", action="store_true")
    parser.add_argument("--retry-unreadable", action="store_true")
    parser.add_argument("--dpi", type=int, choices=[72,144], default=72)
    args = parser.parse_args()
    sources = json.loads((ROOT / ".test-artifacts" / "medical-source-manifest.json").read_text(encoding="utf-8"))
    if args.subject:
        sources = [source for source in sources if source["name"] == args.subject]
    if args.exclude_subject:
        sources = [source for source in sources if source["name"] != args.exclude_subject]
    sources = [{**source, "_engine": args.engine, "_refresh": args.refresh or args.retry_unreadable, "_retry_unreadable": args.retry_unreadable, "_dpi": args.dpi} for source in sources]
    with concurrent.futures.ProcessPoolExecutor(max_workers=args.workers) as executor:
        results = list(executor.map(extract, sources))
    (ARTIFACTS / "extraction-summary.json").write_text(json.dumps(results, indent=2), encoding="utf-8")
    print(json.dumps({"results": results}), flush=True)
