#!/usr/bin/env python3
"""
DEMO-CONTENT-V2-PATCH-A — content pack v2 from Thảo's REFRESHED workbook
"1hub.network - Tổng hợp thông tin sprint 1 (1).xlsx".

The refreshed "Thư viện sản phẩm" sheet dropped the pitch-deck column
(v1: A name, B pitch, C logo, D description, E sector, F stage;
v2: A name, B logo, C description, D sector, E stage). This wrapper runs the
UNMODIFIED v1 generator (sprint1_content_pack.py, the frozen eligibility and
safety rules) on the refreshed bytes, re-inserting an empty column B in memory
only, so every rule reads the same field. Nothing else changes: the source
hash in the pack is the refreshed file's own, the workbook is never written.

Usage (local Python 3 with openpyxl):
  python3 scripts/content-prep/sprint1_content_pack_v2.py <refreshed.xlsx> <out-dir> \
      --generated-at 2026-10-07 --expect-sha256 <hex>
"""

import importlib.util
import os
import sys

V2_HEADER = ["Tên startup", "Ảnh logo", "Startup Description ngắn", "Lĩnh vực", "Giai đoạn phát triển"]

here = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("gen", os.path.join(here, "sprint1_content_pack.py"))
gen = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gen)

original_load = gen.openpyxl.load_workbook


def load_with_v1_layout(*args, **kwargs):
    wb = original_load(*args, **kwargs)
    ws = wb["Thư viện sản phẩm"]
    header = [c.value for c in ws[1]][: len(V2_HEADER)]
    if header != V2_HEADER:
        sys.exit(f"unexpected refreshed product header {header}")
    ws.insert_cols(2)
    return wb


gen.openpyxl.load_workbook = load_with_v1_layout
gen.PACK_VERSION = "sprint1-content-pack-v2"
gen.main()
