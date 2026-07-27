"""CLI + Streamlit 即時監控台（v4 第 5 項）

獨立唯讀輔助工具：只讀 server/logs/exchange.log，不呼叫任何 API、不參與
主資料流——維持核心系統 Node.js/Vue 技術棧的單一性，同時是 v5 合流前
驗證「Node + Python 於同一 repo 共存」的暖身。

用法：
    cd monitor
    pip install -r requirements.txt
    streamlit run dashboard.py
    # 或指定 log 路徑（跟 Express 端 LOG_FILE 環境變數同名，方便共用同一份 .env）：
    LOG_FILE=../server/logs/exchange.log streamlit run dashboard.py
"""

from __future__ import annotations

import os
import time
from pathlib import Path

import pandas as pd
import streamlit as st

from parser import is_error_status, parse_lines

DEFAULT_LOG_FILE = Path(__file__).resolve().parent.parent / "server" / "logs" / "exchange.log"
REFRESH_SECONDS = 5

st.set_page_config(page_title="FHIR Exchange 監控台", layout="wide")
st.title("FHIR 交換測試系統 · 即時數據池監控")


def load_events(log_file: Path):
    if not log_file.exists():
        return []
    with log_file.open(encoding="utf-8") as f:
        lines = f.readlines()
    return parse_lines(lines)


def build_dataframes(events):
    requests = [e for e in events if e.kind == "request"]
    responses = [e for e in events if e.kind == "response"]
    cds_hooks = [e for e in events if e.kind == "cds_hook"]

    resp_df = pd.DataFrame(
        [{"env": e.env, "status": e.status, "ms": e.ms, "is_error": is_error_status(e.status)} for e in responses]
    )
    req_df = pd.DataFrame([{"env": e.env, "method": e.method} for e in requests])
    cds_df = pd.DataFrame([{"env": e.env, "service": e.service} for e in cds_hooks])
    return req_df, resp_df, cds_df


log_path_input = st.sidebar.text_input("exchange.log 路徑", value=os.environ.get("LOG_FILE", str(DEFAULT_LOG_FILE)))
log_file = Path(log_path_input)

auto_refresh = st.sidebar.checkbox(f"每 {REFRESH_SECONDS} 秒自動重新整理", value=True)

events = load_events(log_file)

if not events:
    st.info(f"尚未讀到任何交換紀錄（{log_file}）。啟動後端並操作幾筆資源建立後，這裡會即時更新。")
else:
    req_df, resp_df, cds_df = build_dataframes(events)

    col1, col2, col3, col4 = st.columns(4)
    col1.metric("累積請求數", len(req_df))
    col2.metric(
        "成功率",
        f"{(1 - resp_df['is_error'].mean()) * 100:.1f}%" if len(resp_df) else "—"
    )
    col3.metric("平均回應時間", f"{resp_df['ms'].mean():.0f} ms" if len(resp_df) else "—")
    col4.metric("CDS Hooks 觸發次數", len(cds_df))

    st.subheader("依環境分布的建立數")
    if len(req_df):
        st.bar_chart(req_df.groupby("env").size())
    else:
        st.caption("尚無資料")

    st.subheader("成功／失敗比例")
    if len(resp_df):
        outcome_counts = resp_df["is_error"].map({True: "失敗（4xx/5xx）", False: "成功（2xx）"}).value_counts()
        st.bar_chart(outcome_counts)
    else:
        st.caption("尚無資料")

    st.subheader("回應時間趨勢（ms）")
    if len(resp_df):
        st.line_chart(resp_df["ms"].reset_index(drop=True))
    else:
        st.caption("尚無資料")

    st.subheader("CDS Hooks 觸發分布")
    if len(cds_df):
        st.bar_chart(cds_df.groupby("service").size())
    else:
        st.caption("尚無 CDS Hooks 呼叫紀錄")

    st.subheader("即時 Log 串流（最新在上）")
    display_rows = []
    for e in reversed(events[-200:]):
        if e.kind == "request":
            display_rows.append({"時間": e.ts, "環境": e.env, "類型": "→ 請求", "內容": f"{e.method} {e.path}"})
        elif e.kind == "response":
            mark = "✖" if is_error_status(e.status) else "✔"
            display_rows.append(
                {"時間": e.ts, "環境": e.env, "類型": f"← 回應 {mark}", "內容": f"{e.status}  {e.detail or ''}  ({e.ms}ms)"}
            )
        else:
            display_rows.append({"時間": e.ts, "環境": e.env, "類型": "⚕ CDS Hook", "內容": e.service})
    st.dataframe(pd.DataFrame(display_rows), use_container_width=True, hide_index=True)

if auto_refresh:
    time.sleep(REFRESH_SECONDS)
    st.rerun()
