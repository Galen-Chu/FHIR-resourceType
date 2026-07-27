import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from parser import LogEvent, is_error_status, parse_line, parse_lines  # noqa: E402


class TestParseRequestLine:
    def test_basic_get_request(self):
        line = "[2026-07-15 10:14:22] [hapi-org]  → GET /Patient"
        event = parse_line(line)
        assert event == LogEvent(
            ts="2026-07-15 10:14:22", env="hapi-org", kind="request",
            method="GET", path="/Patient", summary=None
        )

    def test_post_with_resource_summary(self):
        line = (
            "[2026-07-15 10:12:04] [twcore]  → POST /Patient  "
            "resourceType=Patient identifier=tw-pat-20318841"
        )
        event = parse_line(line)
        assert event.kind == "request"
        assert event.method == "POST"
        assert event.path == "/Patient"
        assert event.summary == "resourceType=Patient identifier=tw-pat-20318841"

    def test_put_with_url_encoded_query_string(self):
        line = (
            "[2026-07-27 05:52:49] [twcore]  → PUT "
            "/Organization?identifier=urn%3Atest%3Atw-exchange%3Aorganization-id%7CHOSP-A  "
            "resourceType=Organization identifier=HOSP-A"
        )
        event = parse_line(line)
        assert event.method == "PUT"
        assert event.path.startswith("/Organization?identifier=")
        assert event.env == "twcore"


class TestParseResponseLine:
    def test_success_response_with_detail(self):
        line = "[2026-07-15 10:12:05] [twcore]  ← 201 Created  Patient/tw-pat-2031  (812ms)"
        event = parse_line(line)
        assert event.kind == "response"
        assert event.status == 201
        assert event.detail == "Patient/tw-pat-2031"
        assert event.ms == 812

    def test_bundle_response(self):
        line = "[2026-07-15 10:14:22] [hapi-org]  ← 200 OK  Bundle · total=6  (340ms)"
        event = parse_line(line)
        assert event.status == 200
        assert event.detail == "Bundle · total=6"
        assert event.ms == 340

    def test_error_response_with_operation_outcome(self):
        line = (
            "[2026-07-15 10:15:01] [twcore]  ← 404 Not Found  "
            "OperationOutcome: 找不到指定資源  (120ms)"
        )
        event = parse_line(line)
        assert event.status == 404
        assert "OperationOutcome" in event.detail
        assert is_error_status(event.status) is True

    def test_response_with_empty_detail(self):
        # 真實情境：sandbox proxy 攔截時 data 是純字串，describeResult() 回傳
        # 空字串，log 行會有連續空格但 detail 實質為空
        line = "[2026-07-27 05:52:49] [twcore]  ← 403 Forbidden    (336ms)"
        event = parse_line(line)
        assert event.status == 403
        assert event.detail is None
        assert event.ms == 336
        assert is_error_status(event.status) is True

    def test_success_status_is_not_error(self):
        line = "[2026-07-15 10:12:05] [twcore]  ← 200 OK  Patient/tw-pat-2031  (10ms)"
        event = parse_line(line)
        assert is_error_status(event.status) is False


class TestParseCdsHookLine:
    def test_patient_summary_hook(self):
        line = "[2026-07-27 10:00:00]  ⚕ CDS Hook 呼叫：patient-summary [twcore]"
        event = parse_line(line)
        assert event.kind == "cds_hook"
        assert event.service == "patient-summary"
        assert event.env == "twcore"

    def test_medication_duplicate_check_hook(self):
        line = "[2026-07-27 10:00:01]  ⚕ CDS Hook 呼叫：medication-duplicate-check [hapi-org]"
        event = parse_line(line)
        assert event.service == "medication-duplicate-check"
        assert event.env == "hapi-org"


class TestParseUnrecognizedLines:
    def test_server_startup_line_returns_none(self):
        line = "[2026-07-27 02:44:54]  FHIR Exchange Test Server 啟動於 http://localhost:3000"
        assert parse_line(line) is None

    def test_preview_info_line_returns_none(self):
        line = "[2026-07-27 02:45:11]  ⊙ Preview Patient JSON（未送出，ig=tw-core）"
        assert parse_line(line) is None

    def test_error_line_returns_none(self):
        line = "[2026-07-27 03:00:00]  ✖ POST /Patient failed {\"message\":\"timeout\"}"
        assert parse_line(line) is None

    def test_empty_line_returns_none(self):
        assert parse_line("") is None
        assert parse_line("\n") is None

    def test_malformed_line_does_not_raise(self):
        # 容錯：格式異常也不該拋例外中斷整個 tail 流程
        assert parse_line("完全不符合格式的亂數文字 12345") is None


class TestParseLines:
    def test_filters_out_unrecognized_lines(self):
        lines = [
            "[2026-07-27 02:44:54]  FHIR Exchange Test Server 啟動於 http://localhost:3000",
            "[2026-07-15 10:12:04] [twcore]  → POST /Patient  resourceType=Patient identifier=x",
            "[2026-07-15 10:12:05] [twcore]  ← 201 Created  Patient/tw-pat-2031  (812ms)",
            "",
        ]
        events = parse_lines(lines)
        assert len(events) == 2
        assert events[0].kind == "request"
        assert events[1].kind == "response"
