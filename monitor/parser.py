"""exchange.log 逐行解析（v4 第 5 項：CLI + Streamlit 即時監控台）

獨立唯讀工具，只讀 server/logs/exchange.log，不呼叫任何 API、不參與
主資料流。解析邏輯與畫面渲染分開，方便獨立測試（見 tests/test_parser.py）。

對應的 log 格式（server/src/logger.js）：
    [2026-07-15 10:12:04] [twcore]  → POST /Patient  resourceType=Patient identifier=tw-pat-20318841
    [2026-07-15 10:12:05] [twcore]  ← 201 Created  Patient/tw-pat-2031  (812ms)
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Optional

REQUEST_RE = re.compile(
    r"^\[(?P<ts>[^\]]+)\]\s*\[(?P<env>[^\]]+)\]\s*→\s*(?P<method>\w+)\s+(?P<path>\S+)"
    r"(?:\s{2}(?P<summary>.*))?$"
)
RESPONSE_RE = re.compile(
    r"^\[(?P<ts>[^\]]+)\]\s*\[(?P<env>[^\]]+)\]\s*←\s*(?P<status>\d+)\s+\S+"
    r"\s+(?P<detail>.*?)\s+\((?P<ms>\d+)ms\)$"
)
# CDS Hooks 呼叫標記（server/src/cds/index.js 主動記錄，因為底層查詢已由
# fhirClient 自動記錄一般 GET request/response，無法單從那兩行辨識「這是
# CDS Hook 觸發的」，所以另外補一行可辨識的標記）
CDS_HOOK_RE = re.compile(
    r"^\[(?P<ts>[^\]]+)\]\s*⚕\s*CDS Hook 呼叫：(?P<service>\S+)\s*\[(?P<env>[^\]]+)\]$"
)


@dataclass
class LogEvent:
    ts: str
    env: str
    kind: str  # 'request' | 'response' | 'cds_hook'
    method: Optional[str] = None
    path: Optional[str] = None
    summary: Optional[str] = None
    status: Optional[int] = None
    detail: Optional[str] = None
    ms: Optional[int] = None
    service: Optional[str] = None


def parse_line(line: str) -> Optional[LogEvent]:
    """解析單行 log；不符合已知格式（info / error / server 啟動訊息等）回傳 None，
    容錯設計——不因單行格式異常中斷整個 tail 流程。"""
    line = line.rstrip("\n")
    if not line:
        return None

    if m := REQUEST_RE.match(line):
        return LogEvent(
            ts=m["ts"], env=m["env"], kind="request",
            method=m["method"], path=m["path"], summary=m["summary"] or None
        )

    if m := RESPONSE_RE.match(line):
        return LogEvent(
            ts=m["ts"], env=m["env"], kind="response",
            status=int(m["status"]), detail=m["detail"] or None, ms=int(m["ms"])
        )

    if m := CDS_HOOK_RE.match(line):
        return LogEvent(ts=m["ts"], env=m["env"], kind="cds_hook", service=m["service"])

    return None


def parse_lines(lines: list[str]) -> list[LogEvent]:
    events = []
    for line in lines:
        event = parse_line(line)
        if event is not None:
            events.append(event)
    return events


def is_error_status(status: Optional[int]) -> bool:
    return status is not None and status >= 400
