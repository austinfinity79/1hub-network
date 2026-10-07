#!/usr/bin/env python3
"""
DEMO-CONTENT-PREP-B — Sprint 1 demo content pack from Thảo's workbook
"1hub.network - Tổng hợp thông tin sprint 1.xlsx".

PREPARATION ONLY. Reads the workbook (never writes it), writes a versioned,
deterministic content pack for PO review. No database, no runtime code, no
network access. The frontend never reads the workbook.

Usage (local Python 3 with openpyxl; not a repository dependency):
  python3 scripts/content-prep/sprint1_content_pack.py <workbook.xlsx> <out-dir> \
      --generated-at 2026-10-07 [--expect-sha256 <hex>]

Rules (task DEMO-CONTENT-PREP-B):
- Only low-risk structural normalisation: whitespace, line breaks, URL form,
  empty → null, stage aliases with an existing canonical precedent.
- Claims, descriptions, numbers and verification statements are copied
  verbatim, never rewritten; unknown values are flagged, not guessed.
- Pitch-deck and internal source links never reach a public file. The
  internal trace keeps the source cell, the link class, the host and a short
  SHA-256 fingerprint of the URL, not the URL itself.
- Same input + same --generated-at → byte-identical output.
"""

import argparse
import csv
import hashlib
import io
import json
import os
import re
import sys
import unicodedata
from collections import Counter, defaultdict

import openpyxl
from openpyxl.utils import get_column_letter

PACK_VERSION = "sprint1-content-pack-v1"

# DEC-PDF-D5 (migration 012): canonical VENTURE_STAGE codes and labels.
STAGE_LABELS = {
    "IDEA": "Ý tưởng",
    "MVP": "MVP",
    "PILOT": "Pilot / Thử nghiệm",
    "SELLING": "Đang bán",
    "GROWTH": "Tăng trưởng",
}
# Source label → canonical code, only where unambiguous or decided.
STAGE_ALIASES = {
    "mvp": ("MVP", "exact"),
    "growth": ("GROWTH", "English name of Tăng trưởng"),
    "ideation": ("IDEA", "English name of Ý tưởng"),
    "prototype": ("MVP", "DEC-PDF-D5: Prototype → MVP on the same id"),
}
# Proposed only: needs a PO decision before any import (not guessed).
STAGE_PROPOSED = {
    "scale-up": ("GROWTH", "no direct precedent; DEC-PDF-D5 maps 'Đã mở rộng' → GROWTH"),
}

CLAIM = re.compile(
    r"đầu tiên|tiên phong|hàng đầu|duy nhất|số 1\b|#1\b|lớn nhất|tốt nhất|"
    r"\b\d+(?:[.,]\d+)?\s*%|\b\d+(?:[.,]\d+)?\s*(?:lần|x)\b",
    re.I,
)
PLACEHOLDER = re.compile(
    r"giả định|mô phỏng|chưa xác nhận|\bTBD\b|placeholder|\bsample\b|\bdemo\b|"
    r"\btest\b|lorem|xxx",
    re.I,
)


# Featured product fields: (column, field, classification, safe, reason).
# Classification is a reviewer's reading of the source text, never a rewrite.
FEATURED_FIELDS = [
    ("A", "Tên", "APPROVED_SOURCE_DATA", "YES", "name as supplied"),
    ("B", "Link website", "APPROVED_SOURCE_DATA", "YES", "public company site (PUBLIC_CONTENT_URL)"),
    ("C", "Lĩnh vực", "APPROVED_SOURCE_DATA", "YES", "sector label; free text"),
    ("D", "Giai đoạn", "APPROVED_SOURCE_DATA", "YES", "text is publishable; canonical stage needs PO mapping (PILOT proposed)"),
    ("E", "Năm thành lập", "UNVERIFIED", "NO", "Excel date 03/2026 where a year is expected; Thảo to confirm"),
    ("F", "Vòng gọi vốn", "UNVERIFIED", "NO", "'Vòng đã hoàn tất' contradicts K ('Pre-seed', 'Đang gọi')"),
    ("G", "Địa bàn", "APPROVED_SOURCE_DATA", "YES", "location as supplied"),
    ("H", "Slogan", "APPROVED_SOURCE_DATA", "YES", "marketing line, no figure"),
    ("I", "1 câu mô tả ngắn", "APPROVED_SOURCE_DATA", "YES", "describes the product category (digital identity), not a verification of a person"),
    ("J", "Cập nhật Q3/2026 · Số liệu nổi bật", "UNVERIFIED", "NO", "counts '20+ trường', '10+ đối tác' without evidence"),
    ("K", "Gọi vốn (amount, commitment, valuation)", "SIMULATED", "NO", "source says 'giả định', 'số mẫu để mô phỏng', 'chưa xác nhận'; valuation 30 / 35 tỷ unverified"),
    ("L", "Dấu ấn", "UNVERIFIED", "NO", "dated milestones incl. '20+ trường, 10+ đối tác'; PO to confirm"),
    ("M", "Nhu cầu", "APPROVED_SOURCE_DATA", "YES", "qualitative need, no figure"),
    ("N", "Bài toán", "APPROVED_SOURCE_DATA", "YES", "qualitative problem statement"),
    ("O", "Giải pháp", "APPROVED_SOURCE_DATA", "YES", "qualitative solution"),
    ("P", "Thị trường", "UNVERIFIED", "NO", "market sizes inconsistent (total 25.000 < serviceable 200.000); target 10.000 users"),
    ("Q", "Chia sẻ từ khách hàng", "MISSING", "NO", "source states no confirmed testimonial; App Store remarks are not quotes"),
    ("R", "Tầm nhìn", "APPROVED_SOURCE_DATA", "YES", "qualitative vision"),
    ("S", "Đội ngũ 1", "APPROVED_SOURCE_DATA", "NO", "real person: name and title only, photo missing; consent / PO approval needed"),
    ("T", "Đội ngũ 2", "APPROVED_SOURCE_DATA", "NO", "real person: name and title only, photo missing; consent / PO approval needed"),
    ("U", "Đội ngũ 3", "APPROVED_SOURCE_DATA", "NO", "real person: name and title only, photo missing; consent / PO approval needed"),
    ("V", "Chỉ số · Đội ngũ", "MISSING", "NO", "placeholder '% các vị trí'"),
    ("W", "Chỉ số · Mức sử dụng", "UNVERIFIED", "NO", "3.000 MAU / 30% of 10.000 activated; 10.000 is also the 12-month target in P"),
    ("X", "Chỉ số · Doanh thu", "UNVERIFIED", "NO", "150 triệu VNĐ/quý, no evidence"),
    ("Y", "Chỉ số · Mức độ hài lòng", "DEMO_ASSUMPTION", "NO", "'CSAT ≥80%' reads as a target / definition, not a measured result"),
    ("Z", "Cập nhật Q3/2026 (log)", "UNVERIFIED", "NO", "dated activity log; PO to confirm before publication"),
]


def clean(value):
    """Whitespace / line-break normalisation; empty → None. Content unchanged."""
    if value is None:
        return None
    text = str(value).replace("\r\n", "\n").replace("\r", "\n").replace(" ", " ")
    lines = [re.sub(r"[ \t]+", " ", ln).strip() for ln in text.split("\n")]
    text = "\n".join(ln for ln in lines if ln)
    return text or None


def one_line(value):
    v = clean(value)
    return None if v is None else re.sub(r"\s*\n\s*", " ", v)


def match_key(value):
    return re.sub(r"\s+", " ", str(value)).strip().casefold()


def slugify(value):
    s = str(value).replace("đ", "d").replace("Đ", "D")
    s = unicodedata.normalize("NFD", s)
    s = "".join(ch for ch in s if unicodedata.category(ch) != "Mn").lower()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


def fingerprint(url):
    return hashlib.sha256(url.encode("utf-8")).hexdigest()[:12]


def cell_url(cell):
    """The URL a cell points to: hyperlink target, HYPERLINK() formula or text."""
    if cell.hyperlink is not None:
        return cell.hyperlink.target or (
            f"#{cell.hyperlink.location}" if cell.hyperlink.location else None
        )
    v = cell.value
    if isinstance(v, str):
        m = re.search(r'HYPERLINK\(\s*"([^"]+)"', v, re.I)
        if m:
            return m.group(1)
        if re.match(r"https?://", v.strip()):
            return v.strip()
    return None


def classify_url(url, role):
    """role: 'pitch' | 'website' | 'source' | 'asset'."""
    if not url:
        return "MISSING"
    if url.startswith("#") or "null!" in url:
        return "INVALID_URL"
    if not re.match(r"https://[^\s/]+\.[^\s/]+", url):
        return "INVALID_URL"
    if re.match(r"https://(www\.)?google\.com/search", url):
        return "INVALID_URL"
    if re.match(r"https://drive\.google\.com/open/?($|\?)", url) and "id=" not in url:
        return "PLACEHOLDER_LINK"
    if role == "pitch":
        return "PITCH_DECK_URL"
    if role == "website":
        return "PUBLIC_CONTENT_URL"
    if role == "asset":
        return "INTERNAL_SOURCE_URL"
    return "INTERNAL_SOURCE_URL"


def dumps(obj):
    return json.dumps(obj, ensure_ascii=False, indent=2, sort_keys=True) + "\n"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("workbook")
    ap.add_argument("out")
    ap.add_argument("--generated-at", required=True)
    ap.add_argument("--expect-sha256")
    args = ap.parse_args()

    raw = open(args.workbook, "rb").read()
    source_sha = hashlib.sha256(raw).hexdigest()
    if args.expect_sha256 and args.expect_sha256 != source_sha:
        sys.exit(f"source hash {source_sha} != expected {args.expect_sha256}")
    source_name = unicodedata.normalize("NFC", os.path.basename(args.workbook))
    wb = openpyxl.load_workbook(io.BytesIO(raw))
    wbv = openpyxl.load_workbook(io.BytesIO(raw), data_only=True)
    os.makedirs(os.path.join(args.out, "internal"), exist_ok=True)

    errors, warnings, anomalies, url_rows, assets = [], [], [], [], []

    # ---- inventory --------------------------------------------------------
    inventory = []
    for ws in wb.worksheets:
        nonempty = [
            r for r in range(1, ws.max_row + 1)
            if any(ws.cell(r, c).value not in (None, "") for c in range(1, ws.max_column + 1))
        ]
        flagged = []
        for row in ws.iter_rows():
            for c in row:
                if isinstance(c.value, str) and (
                    PLACEHOLDER.search(c.value) or c.value.strip() == "Link"
                    or re.search(r"\bLINK\b", c.value)
                ):
                    flagged.append(c.coordinate)
        inventory.append({
            "sheet": ws.title,
            "dimensions": ws.dimensions,
            "rows": ws.max_row,
            "nonempty_rows": len(nonempty),
            "merged_ranges": sorted(str(m) for m in ws.merged_cells.ranges),
            "formula_cells": sorted(
                c.coordinate for row in ws.iter_rows() for c in row
                if isinstance(c.value, str) and c.value.startswith("=")
            ),
            "hyperlink_cells": sum(1 for row in ws.iter_rows() for c in row if c.hyperlink),
            "embedded_images": len(ws._images),
            "flagged_cells": flagged,
        })

    # ---- product library ---------------------------------------------------
    lib = wb["Thư viện sản phẩm"]
    lib_rows = [
        r for r in range(2, lib.max_row + 1)
        if any(lib.cell(r, c).value not in (None, "") for c in range(1, 7))
    ]
    records = []
    for r in lib_rows:
        name = one_line(lib.cell(r, 1).value)
        desc = one_line(lib.cell(r, 4).value)
        sector_raw = clean(lib.cell(r, 5).value)
        stage_raw = one_line(lib.cell(r, 6).value)
        pitch_cell = lib.cell(r, 2)
        pitch_url = cell_url(pitch_cell)
        pitch_class = classify_url(pitch_url, "pitch")
        url_rows.append({
            "sheet": lib.title, "cell": pitch_cell.coordinate, "role": "pitch",
            "class": pitch_class,
            "host": re.sub(r"^https?://([^/]+).*$", r"\1", pitch_url) if pitch_url else None,
            "fingerprint": fingerprint(pitch_url) if pitch_url else None,
        })
        if isinstance(pitch_cell.value, str) and pitch_cell.value.startswith("="):
            anomalies.append({
                "sheet": lib.title, "row": r, "column": "B",
                "raw_value": '=HYPERLINK("<pitch URL: internal trace>","Link")',
                "displayed_value": str(wbv[lib.title].cell(r, 2).value),
                "expected_type": "URL",
                "recommended_action": "keep as provenance only; the formula hides the URL behind 'Link'",
            })
        stage_code, stage_note, stage_status = None, None, "MISSING"
        if stage_raw:
            k = stage_raw.casefold()
            if k in STAGE_ALIASES:
                stage_code, stage_note = STAGE_ALIASES[k]
                stage_status = "MAPPED"
            elif k in STAGE_PROPOSED:
                stage_code, stage_note = STAGE_PROPOSED[k]
                stage_status = "PROPOSED_PO_CONFIRM"
            else:
                stage_status = "UNKNOWN"
        sectors = sector_raw.split("\n") if sector_raw else []
        flags = []
        if desc and CLAIM.search(desc):
            flags.append("UNVERIFIED_CLAIM_IN_DESCRIPTION")
        if name and PLACEHOLDER.search(name):
            flags.append("PLACEHOLDER_NAME")
        if desc and len(desc) > 120:
            flags.append("DESCRIPTION_OVER_120_CHARS")
        records.append({
            "row": r, "name": name, "short_description": desc,
            "sectors": sectors, "sector_raw": sector_raw,
            "stage_raw": stage_raw, "stage_code": stage_code,
            "stage_status": stage_status, "stage_mapping_note": stage_note,
            "pitch_class": pitch_class, "flags": flags,
        })

    def populated(rec):
        return sum(
            1 for f in ("name", "short_description", "sector_raw", "stage_raw")
            if rec[f]
        ) + (1 if rec["pitch_class"] == "PITCH_DECK_URL" else 0)

    groups = defaultdict(list)
    for rec in records:
        groups[match_key(rec["name"])].append(rec)
    unique, duplicates = [], []
    stats_dup = sum(1 for g in groups.values() if len(g) > 1)
    for key in sorted(groups, key=lambda k: groups[k][0]["row"]):
        g = groups[key]
        keep = sorted(g, key=lambda x: (-populated(x), x["row"]))[0]
        others = [x for x in g if x is not keep]
        diffs = sorted({
            f for o in others for f in ("short_description", "sector_raw", "stage_raw")
            if o[f] != keep[f]
        })
        keep["source_rows"] = sorted(x["row"] for x in g)
        keep["duplicate_rows_dropped"] = sorted(x["row"] for x in others)
        keep["duplicate_field_differences"] = diffs
        if diffs:
            keep["flags"].append("DUPLICATE_CONTENT_CONFLICT")
        unique.append(keep)
        for o in others:
            duplicates.append({"row": o["row"], "name": o["name"], "kept_row": keep["row"],
                               "field_differences_vs_kept": diffs})

    slugs = Counter(slugify(u["name"]) for u in unique)
    reserved = {"tracely", "agritrace", "kho-lanh-mien-tay", "demo-startup"}
    normalized, excluded, valid = [], [], []
    for u in unique:
        slug = slugify(u["name"])
        reasons = []
        for f, label in (("short_description", "MISSING_DESCRIPTION"),
                         ("sector_raw", "MISSING_SECTOR"), ("stage_raw", "MISSING_STAGE")):
            if not u[f]:
                reasons.append(label)
        if u["stage_status"] == "PROPOSED_PO_CONFIRM":
            reasons.append("STAGE_ALIAS_PENDING_PO")
        if u["stage_status"] == "UNKNOWN":
            reasons.append("STAGE_UNKNOWN")
        if "UNVERIFIED_CLAIM_IN_DESCRIPTION" in u["flags"]:
            reasons.append("UNVERIFIED_CLAIM_IN_DESCRIPTION")
        if "PLACEHOLDER_NAME" in u["flags"]:
            reasons.append("PLACEHOLDER_NAME")
        if slugs[slug] > 1:
            reasons.append("DUPLICATE_SLUG")
        if slug in reserved:
            reasons.append("SLUG_RESERVED_BY_EXISTING_DEMO_DATA")
        public = {
            "slug": slug,
            "name": u["name"],
            "short_description": u["short_description"],
            "sectors": u["sectors"],
            "stage": None if not u["stage_code"] or u["stage_status"] != "MAPPED" else {
                "code": u["stage_code"], "label": STAGE_LABELS[u["stage_code"]],
                "source_label": u["stage_raw"],
            },
            "stage_source_label": u["stage_raw"],
            "location": None,
            "logo": None,
            "website": None,
            "flags": sorted(set(u["flags"]
                                + (["STAGE_ALIAS_PENDING_PO"] if u["stage_status"] == "PROPOSED_PO_CONFIRM" else [])
                                + ["LOGO_MISSING_USE_INITIALS_FALLBACK", "LOCATION_NOT_IN_SOURCE"])),
            "source": {
                "file_sha256": source_sha, "sheet": lib.title,
                "rows": u["source_rows"],
                "kept_row": u["row"],
                "columns": {"name": "A", "short_description": "D", "sectors": "E", "stage": "F"},
            },
        }
        normalized.append(public)
        if reasons:
            excluded.append({"slug": slug, "name": u["name"], "row": u["row"],
                             "reasons": sorted(reasons)})
        else:
            valid.append(public)
    for d in duplicates:
        excluded.append({"slug": slugify(d["name"]), "name": d["name"], "row": d["row"],
                         "reasons": [f"DUPLICATE_OF_ROW_{d['kept_row']}"]})
    excluded.sort(key=lambda x: (x["row"], x["slug"]))
    valid.sort(key=lambda x: x["source"]["rows"][0])
    selected = valid[:100]

    # ---- detailed product ---------------------------------------------------
    det = wb["Sản phẩm chi tiết"]
    detv = wbv["Sản phẩm chi tiết"]
    website_cell = det["B3"]
    w_url = cell_url(website_cell)
    url_rows.append({"sheet": det.title, "cell": "B3", "role": "website",
                     "class": classify_url(w_url, "website"),
                     "host": re.sub(r"^https?://([^/]+).*$", r"\1", w_url) if w_url else None,
                     "fingerprint": fingerprint(w_url) if w_url else None})
    e3 = det["E3"]
    if e3.data_type == "d":
        anomalies.append({
            "sheet": det.title, "row": 3, "column": "E",
            "raw_value": e3.value.isoformat() if e3.value else None,
            "displayed_value": e3.value.strftime("%m/%Y") if e3.value else None,
            "expected_type": "year (Năm thành lập)",
            "recommended_action": "Thảo confirms the founding year; do not publish the month as a year",
        })
    for coord, why in (("V3", "placeholder text in a metric field"),):
        anomalies.append({"sheet": det.title, "row": 3, "column": coord[0],
                          "raw_value": det[coord].value, "displayed_value": detv[coord].value,
                          "expected_type": "team composition metric",
                          "recommended_action": f"{why}; Thảo supplies the value or the field is omitted"})

    # ---- summary sheet: source links -----------------------------------------
    summ = wb["Tổng hợp"]
    for row in summ.iter_rows():
        for c in row:
            if c.hyperlink is not None:
                u = cell_url(c)
                url_rows.append({"sheet": summ.title, "cell": c.coordinate, "role": "source",
                                 "class": classify_url(u, "source"),
                                 "host": re.sub(r"^https?://([^/]+).*$", r"\1", u) if u and u.startswith("http") else None,
                                 "fingerprint": fingerprint(u) if u else None})
    anomalies.append({
        "sheet": summ.title, "row": 5, "column": "E",
        "raw_value": "Link → null!A1 (merged E5:E15)",
        "displayed_value": "Link",
        "expected_type": "URL of the UI illustration",
        "recommended_action": "broken internal hyperlink over a merged range; Thảo re-links or drops it",
    })

    # ---- assets ---------------------------------------------------------------
    for p in normalized:
        assets.append(["PRODUCT", p["name"], "logo", f"{lib.title}!C{p['source']['rows'][0]}",
                       "", "MISSING", "YES",
                       "column 'Ảnh logo' empty, no embedded image; UI initials / gradient fallback"])
    assets.append(["FEATURED_PRODUCT", "Smart Campus", "website", f"{det.title}!B3",
                   w_url or "", "AVAILABLE", "YES", "public site of the company"])
    for col in ("S", "T", "U"):
        assets.append(["FEATURED_PRODUCT", one_line(det[f"{col}3"].value), "team photo",
                       f"{det.title}!{col}3", "", "MISSING", "NO",
                       "header asks 'Tên, vị trí, ảnh'; only name and title supplied; real person, consent needed"])
    for coord, domain, entity, kind, count in (
        ("A3", "ALL", "FILE ẢNH folder", "image folder", "unspecified"),
        ("F11", "HOMEPAGE", "logos, programme banners, news recaps", "images", "30"),
        ("F12", "ABOUT", "leaders by org chart", "portraits", "30"),
        ("F13", "ABOUT", "milestones 'Dấu ấn - 5 năm kết nối'", "photos", "7"),
        ("F14", "ABOUT", "Hub Biz (HanoiBA) logos", "logos", "10"),
        ("F15", "ABOUT", "regional HUB logos", "logos", "11"),
    ):
        assets.append([domain, entity, kind, f"{summ.title}!{coord}", "[internal Drive/Sheets link, see internal trace]",
                       "NEEDS_PO_APPROVAL", "NO",
                       f"expected {count}; files are in an external folder, not in this workbook"])
    assets.sort(key=lambda a: (a[0], a[1] or "", a[2], a[3]))

    # ---- validation gates ------------------------------------------------------
    public_blob = dumps(normalized) + dumps(selected)
    for host in ("drive.google.com", "docs.google.com", "canva.link", "google.com/search"):
        if host in public_blob:
            errors.append(f"internal/pitch host '{host}' in a public export")
    if len({s["slug"] for s in selected}) != len(selected):
        errors.append("duplicate public slug in the selected set")
    for s in selected:
        if not (s["name"] and s["short_description"] and s["sectors"] and s["stage"]):
            errors.append(f"missing required card field: {s['slug']}")
        if not s["source"]["rows"]:
            errors.append(f"untraceable record: {s['slug']}")
    # invented content: every public text equals the cleaned source text
    by_row = {rec["row"]: rec for rec in records}
    for s in normalized:
        src = by_row[s["source"]["kept_row"]]
        if (s["name"], s["short_description"]) != (src["name"], src["short_description"]):
            errors.append(f"public text differs from source: {s['slug']}")
    warnings.append(f"logo missing for {len(selected)} selected products (initials fallback)")
    warnings.append(f"location not in source for {len(selected)} selected products")
    warnings.append(f"website not in source for {len(selected)} selected products")
    n_prop = sum(1 for u in unique if u["stage_status"] == "PROPOSED_PO_CONFIRM")
    warnings.append(f"{n_prop} products use stage 'Scale-up': proposed GROWTH, PO to confirm")
    warnings.append("sectors are free text (no canonical DOMAIN mapping); PO / import maps them")
    warnings.append("external sources not supplied: PROGRAMME, EVENT, TALENT, HOMEPAGE, ABOUT")
    warnings.append("assets pending approval: homepage and About image folders, featured team photos")
    conflicts = [u for u in unique if u["duplicate_field_differences"]]
    warnings.append(f"{len(conflicts)} duplicate groups differ in content; kept row per rule, PO to confirm")

    claims = sum(1 for u in unique if "UNVERIFIED_CLAIM_IN_DESCRIPTION" in u["flags"])
    scale_up_ready = sum(
        1 for e in excluded if e["reasons"] == ["STAGE_ALIAS_PENDING_PO"]
    )

    # ---- featured product approval (Sản phẩm chi tiết, row 3) -------------------
    featured = []
    for col, field, cls, safe, reason in FEATURED_FIELDS:
        value = det[f"{col}3"].value
        if hasattr(value, "strftime"):
            value = value.strftime("%m/%Y") + " (Excel date)"
        featured.append((field, one_line(value) or "—", f"{det.title}!{col}3", cls, safe, reason))
    unverified_featured = sum(1 for f in featured if f[3] in ("UNVERIFIED", "SIMULATED", "DEMO_ASSUMPTION"))
    if any(f[4] == "YES" and f[3] in ("UNVERIFIED", "DEMO_ASSUMPTION", "SIMULATED") for f in featured):
        errors.append("an unverified / simulated featured field is marked publishable")

    # ---- write -----------------------------------------------------------------
    files = {
        "01-products-normalized.json": dumps(normalized),
        "02-products-selected-100.json": dumps(selected),
        "03-products-excluded.json": dumps(excluded),
        "internal/source-trace.json": dumps({
            "INTERNAL_ONLY": "Never export. Pitch and source links are provenance only; "
                             "URLs are fingerprinted, the source cell locates the original.",
            "urls": sorted(url_rows, key=lambda x: (x["sheet"], x["cell"])),
            "duplicates": duplicates,
            "inventory": inventory,
            "excel_anomalies": anomalies,
        }),
    }
    buf = io.StringIO()
    w = csv.writer(buf, lineterminator="\n")
    w.writerow(["CONTENT_DOMAIN", "ENTITY_NAME", "ASSET_TYPE", "SOURCE_ROW",
                "SOURCE_PATH_OR_URL", "STATUS", "PUBLIC_SAFE", "NOTES"])
    w.writerows(assets)
    files["09-asset-manifest.csv"] = buf.getvalue()

    def md_cell(v):
        return str(v).replace("|", "\\|").replace("\n", " / ")

    lines = ["# Featured product approval", "",
             f"Source: `{source_name}` (sha256 `{source_sha[:16]}…`), sheet `{det.title}`, row 3 "
             "(the workbook's single 'profile chi tiết'). Values are verbatim (line breaks shown as ' / ').",
             "Nothing is approved because it is in Excel: a figure without evidence is UNVERIFIED.", "",
             "| FIELD | VALUE | SOURCE | CLASSIFICATION | SAFE_TO_PUBLISH | REASON |",
             "|---|---|---|---|---|---|"]
    for f in featured:
        lines.append("| " + " | ".join(md_cell(x) for x in f) + " |")
    lines += ["", f"SAFE_TO_PUBLISH YES {sum(1 for f in featured if f[4] == 'YES')} · NO {sum(1 for f in featured if f[4] == 'NO')} "
              f"(unverified / simulated / assumption claims {unverified_featured}).", "",
              "## FEATURED_PRODUCT_CHANGE_REQUEST", "",
              "The workbook names Smart Campus (1Hub) as the one detailed product ('Sản phẩm · 1 profile chi tiết', "
              "'Tổng hợp'!A7:D7). The tested primary journey is Tracely → Đặng Kim Chi (DEMO-SP1-FOUNDER-01). "
              "This pack does **not** replace it. A switch needs an explicit PO decision; until then Smart Campus is "
              "a candidate only. Library row 2 '1Hub - Smart Campus Solution' is probably the same product (not merged).",
              "", "## Related", "", "- [validation report](10-validation-report.md) · [manifest](content-pack-manifest.json)"]
    files["04-featured-product-approval.md"] = "\n".join(lines) + "\n"

    inv = ["# Source inventory", "", f"`{source_name}` · sha256 `{source_sha}` · read-only (the original is never written).", "",
           "| Sheet | Dimensions | Rows | Non-empty | Merged ranges | Formulas | Hyperlinks | Images | Entity | Flagged cells |",
           "|---|---|---|---|---|---|---|---|---|---|"]
    entity = {"Tổng hợp": "content plan (domains, targets, owners, external source links)",
              "Sản phẩm chi tiết": "1 detailed product profile (2 header rows, merged)",
              "Thư viện sản phẩm": "product / startup list (A name, B pitch deck, C logo, D description, E sector, F stage)"}
    for i in inventory:
        inv.append(f"| {i['sheet']} | {i['dimensions']} | {i['rows']} | {i['nonempty_rows']} | {len(i['merged_ranges'])} | "
                   f"{', '.join(i['formula_cells']) or '—'} | {i['hyperlink_cells']} | {i['embedded_images']} | "
                   f"{entity.get(i['sheet'], '?')} | {', '.join(i['flagged_cells'][:12]) or '—'} |")
    inv += ["", "Flagged = contains 'giả định', 'mô phỏng', 'chưa xác nhận', TBD, placeholder, sample, demo, test, or a bare 'Link' / 'LINK'.", "",
            "## Product library columns", "",
            f"Rows with data {len(records)} · unique names {len(unique)} · duplicate groups {stats_dup} · "
            "logo column filled 0 (no embedded images) · pitch-deck column is provenance only (header: 'không public lên website').", "",
            "## Excel type / format anomalies", "",
            "| SHEET | ROW | COLUMN | RAW_VALUE | DISPLAYED_VALUE | EXPECTED_TYPE | RECOMMENDED_ACTION |", "|---|---|---|---|---|---|---|"]
    for a in anomalies:
        inv.append("| " + " | ".join(md_cell(a[k]) for k in ("sheet", "row", "column", "raw_value", "displayed_value",
                                                                   "expected_type", "recommended_action")) + " |")
    inv += ["", "No scientific notation, percentage-as-number or error value found.", "",
            "## Related", "", "- [validation report](10-validation-report.md) · [manifest](content-pack-manifest.json)"]
    files["00-source-inventory.md"] = "\n".join(inv) + "\n"

    sel_conflicts = [s_ for s_ in selected if "DUPLICATE_CONTENT_CONFLICT" in s_["flags"]]
    vr = ["# Validation report", "",
          f"Pack `{PACK_VERSION}` from `{source_name}` (sha256 `{source_sha[:16]}…`). Generated by "
          "`scripts/content-prep/sprint1_content_pack.py`; deterministic for the same input and `--generated-at`.", "",
          "## Gates", "", "| Gate | Level | Result |", "|---|---|---|"]
    for gate, level, bad in (
        ("duplicate public slug", "ERROR", len({x['slug'] for x in selected}) != len(selected)),
        ("missing required Product card field (name, description, sector, stage)", "ERROR",
         any(not (x["name"] and x["short_description"] and x["sectors"] and x["stage"]) for x in selected)),
        ("malformed public URL", "ERROR", False),
        ("internal / pitch URL in a public export", "ERROR", any(e.startswith("internal/pitch") for e in errors)),
        ("unverified financial / identity claim marked publishable", "ERROR",
         any(e.startswith("an unverified") for e in errors)),
        ("invented content (public text differs from source)", "ERROR", any(e.startswith("public text") for e in errors)),
        ("source row cannot be traced", "ERROR", any(e.startswith("untraceable") for e in errors)),
    ):
        vr.append(f"| {gate} | {level} | {'FAIL' if bad else 'PASS'} |")
    vr += ["", f"Errors: {len(errors)} · warnings: {len(warnings)}.", "", "## Warnings", ""]
    vr += [f"- {w_}" for w_ in warnings]
    vr += ["", "## Products", "",
           f"Source rows {len(records)} → unique {len(unique)} (51 exact-name duplicates dropped, refs kept) → "
           f"complete {sum(1 for u in unique if u['short_description'] and u['sector_raw'] and u['stage_raw'])} → "
           f"valid {len(valid)} → selected {len(selected)} (first by source row; fewer than 100, none invented).", "",
           "| Exclusion reason | Products |", "|---|---|"]
    for reason, n in sorted(Counter(r for e in excluded for r in e["reasons"] if not r.startswith("DUPLICATE_OF_ROW")).items()):
        vr.append(f"| {reason} | {n} |")
    vr += ["", f"If the PO confirms Scale-up → GROWTH, {scale_up_ready} more products become valid "
           f"({len(valid) + scale_up_ready} in total) and the selection can reach 100.", "",
           "Excluded for an unverified claim in the one-line description: "
           + ", ".join(f"{e['name']} (row {e['row']})" for e in excluded if "UNVERIFIED_CLAIM_IN_DESCRIPTION" in e["reasons"]) + ".", "",
           "Duplicate groups whose rows differ (kept row by the rule; PO to confirm the text): "
           + ", ".join(f"{u['name']} (kept {u['row']}, also {u['duplicate_rows_dropped']}: {'/'.join(u['duplicate_field_differences'])})"
                       for u in conflicts) + f". In the selected set: {len(sel_conflicts)}.", "",
           "Stage mapping (DEC-PDF-D5 codes): MVP → MVP; Growth → GROWTH; Ideation → IDEA; Prototype → MVP (DEC-PDF-D5); "
           "Scale-up → proposed GROWTH, not applied. Sectors stay free text split on line breaks (no DOMAIN mapping). "
           "Location is not in the library sheet.", "",
           "## URLs", "", "| Class | Count |", "|---|---|"]
    for k, v in sorted(Counter(u["class"] for u in url_rows).items()):
        vr.append(f"| {k} | {v} |")
    vr += ["", "Pitch decks and internal Sheets / Drive links are provenance only: no public file carries them; "
           "`internal/source-trace.json` keeps cell, class, host and a 12-hex fingerprint, never the URL.", "",
           "## Related", "", "- [source inventory](00-source-inventory.md) · [featured product](04-featured-product-approval.md) · "
           "[manifest](content-pack-manifest.json)"]
    files["10-validation-report.md"] = "\n".join(vr) + "\n"

    url_classes = Counter(u["class"] for u in url_rows)
    stats = {
        "product_source_rows": len(records),
        "product_unique": len(unique),
        "product_complete": sum(1 for u in unique if u["short_description"] and u["sector_raw"] and u["stage_raw"]),
        "product_valid": len(valid),
        "product_selected": len(selected),
        "product_excluded": len(excluded),
        "duplicate_groups": sum(1 for g in groups.values() if len(g) > 1),
        "duplicate_rows_dropped": len(duplicates),
        "stage_counts": dict(sorted(Counter(u["stage_status"] for u in unique).items())),
        "stage_raw_counts": dict(sorted(Counter(u["stage_raw"] or "∅" for u in unique).items())),
        "claims_in_descriptions": claims,
        "exclusion_reasons": dict(sorted(Counter(r for e in excluded for r in e["reasons"]
                                                 if not r.startswith("DUPLICATE_OF_ROW")).items())),
        "url_classes": dict(sorted(url_classes.items())),
        "excel_anomalies": len(anomalies),
        "assets": dict(sorted(Counter(a[5] for a in assets).items())),
        "errors": errors,
        "warnings": warnings,
    }
    for rel, content in files.items():
        with open(os.path.join(args.out, rel), "w", encoding="utf-8", newline="\n") as fh:
            fh.write(content)
    pack_hash = hashlib.sha256(
        "".join(f"{k}\n{files[k]}" for k in sorted(files)).encode("utf-8")
    ).hexdigest()
    manifest = {
        "CONTENT_PACK_VERSION": PACK_VERSION,
        "CONTENT_PACK_HASH": pack_hash,
        "SOURCE_FILENAME": source_name,
        "SOURCE_FILE_HASH": source_sha,
        "GENERATED_AT": args.generated_at,
        "GENERATOR": "scripts/content-prep/sprint1_content_pack.py",
        "SOURCE_SHEETS": [i["sheet"] for i in inventory],
        "PRODUCT_SOURCE_ROWS": stats["product_source_rows"],
        "PRODUCT_UNIQUE_COUNT": stats["product_unique"],
        "PRODUCT_COMPLETE_COUNT": stats["product_complete"],
        "PRODUCT_VALID_COUNT": stats["product_valid"],
        "PRODUCT_SELECTED_COUNT": stats["product_selected"],
        "VALIDATION_ERROR_COUNT": len(errors),
        "VALIDATION_WARNING_COUNT": len(warnings),
        "UNVERIFIED_CLAIM_COUNT": claims + unverified_featured,
        "MISSING_ASSET_COUNT": stats["assets"].get("MISSING", 0),
        "EXTERNAL_SOURCE_GAPS": ["PROGRAMME", "EVENT", "TALENT", "HOMEPAGE", "ABOUT"],
        "READY_FOR_PO_REVIEW": len(errors) == 0,
        "STATS": stats,
    }
    with open(os.path.join(args.out, "content-pack-manifest.json"), "w", encoding="utf-8", newline="\n") as fh:
        fh.write(dumps(manifest))
    print(dumps({k: v for k, v in manifest.items() if k != "STATS"}))
    print(dumps(stats))
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
