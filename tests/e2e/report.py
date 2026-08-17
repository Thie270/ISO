#!/usr/bin/env python3
"""อ่านผล E2E จาก DOM ที่ Chrome ดัมป์ออกมา แล้วสรุปให้อ่านง่าย"""
import html
import json
import re
import sys

GREEN, RED, DIM, RESET = "\033[32m", "\033[31m", "\033[2m", "\033[0m"

dom = sys.stdin.read()
match = re.search(r"E2E-RESULT::(\{.*?\})\s*</pre>", dom, re.S)

if not match:
    print(f"{RED}ไม่พบผลการทดสอบ — หน้าทดสอบอาจค้างหรือมี error ก่อนเริ่มรัน{RESET}")
    stuck = re.search(r'<p id="summary">(.*?)</p>', dom, re.S)
    if stuck:
        print("สถานะล่าสุด:", html.unescape(stuck.group(1)).strip())
    sys.exit(2)

data = json.loads(html.unescape(match.group(1)))

print()
for r in data["results"]:
    mark = f"{GREEN}✓{RESET}" if r["ok"] else f"{RED}✗{RESET}"
    print(f'  {mark} {r["name"]} {DIM}({r["ms"]} ms){RESET}')
    if not r["ok"]:
        print(f'      {RED}{r["error"]}{RESET}')

passed = data["total"] - data["failed"]
print()
if data["failed"]:
    print(f'{RED}ไม่ผ่าน {data["failed"]} จาก {data["total"]} รายการ{RESET}')
    sys.exit(1)

print(f"{GREEN}ผ่านทั้งหมด {passed} รายการ{RESET}")
