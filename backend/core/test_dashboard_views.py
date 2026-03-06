"""
Test Dashboard API – Superuser only.
Runs integration tests via subprocess and returns JSON results.
Also reads the cached last_run.json for instant display.

GET  /api/test-dashboard/status/   → Returns last cached results (no test run)
POST /api/test-dashboard/run/      → Runs integration test suite, returns results
"""
import json
import os
import subprocess
import sys
import time
from pathlib import Path

from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

BACKEND_DIR = Path(__file__).resolve().parent.parent
LAST_RUN_FILE = BACKEND_DIR / "integration_tests" / "last_run.json"

CATEGORY_MAP = {
    "test_procurement_full_cycle": "المشتريات",
    "test_sales_pos_full_cycle":   "المبيعات/POS",
    "test_inventory_all_scenarios": "المخزون",
    "test_hr_payroll_accounting":  "الموارد البشرية",
}


def _parse_results(raw: dict) -> dict:
    """Convert pytest-json-report output into a structured dashboard payload."""
    tests = raw.get("tests", [])
    summary = raw.get("summary", {})
    duration = raw.get("duration", 0)

    categories: dict[str, dict] = {}
    for cat_key, cat_label in CATEGORY_MAP.items():
        categories[cat_label] = {"label": cat_label, "key": cat_key,
                                  "passed": 0, "failed": 0, "tests": []}

    all_passed = 0
    all_failed = 0
    scenario_details = []

    for t in tests:
        node_id = t.get("nodeid", "")
        test_file = node_id.split("::")[0].split("/")[-1].replace(".py", "")
        cat_label = CATEGORY_MAP.get(test_file, "أخرى")
        if cat_label not in categories:
            categories[cat_label] = {"label": cat_label, "key": test_file,
                                      "passed": 0, "failed": 0, "tests": []}

        outcome = t.get("outcome", "unknown")
        duration_ms = round((t.get("duration", 0) or 0) * 1000, 1)
        test_name = node_id.split("::")[-1]
        passed = outcome == "passed"

        if passed:
            all_passed += 1
            categories[cat_label]["passed"] += 1
        else:
            all_failed += 1
            categories[cat_label]["failed"] += 1

        call_info = t.get("call", {}) or {}
        longrepr = call_info.get("longrepr", "") if not passed else ""

        detail = {
            "name": test_name,
            "node_id": node_id,
            "status": "PASS" if passed else "FAIL",
            "duration_ms": duration_ms,
            "error": longrepr[:500] if longrepr else None,
        }
        categories[cat_label]["tests"].append(detail)
        scenario_details.append(detail)

    table = [
        {
            "حركة": v["label"],
            "الاختبارات": v["passed"] + v["failed"],
            "نجح": v["passed"],
            "فشل": v["failed"],
            "الحالة": "✅ PASS" if v["failed"] == 0 else "❌ FAIL",
        }
        for v in categories.values()
        if v["passed"] + v["failed"] > 0
    ]

    return {
        "summary": {
            "total": all_passed + all_failed,
            "passed": all_passed,
            "failed": all_failed,
            "duration_s": round(duration, 2),
            "status": "✅ ALL PASS" if all_failed == 0 else f"❌ {all_failed} FAILED",
        },
        "table": table,
        "categories": list(categories.values()),
        "scenarios": scenario_details,
        "run_at": raw.get("created", ""),
    }


class DashboardStatusView(APIView):
    """GET last cached test results (no test run triggered)."""
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        if not LAST_RUN_FILE.exists():
            return Response(
                {"detail": "لم يتم تشغيل الاختبارات بعد. اضغط Execute All Tests.",
                 "has_results": False},
                status=status.HTTP_200_OK,
            )
        try:
            raw = json.loads(LAST_RUN_FILE.read_text(encoding="utf-8"))
            return Response({"has_results": True, **_parse_results(raw)})
        except Exception as exc:
            return Response({"detail": str(exc), "has_results": False},
                            status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class DashboardRunView(APIView):
    """POST — triggers the integration test suite and returns live results."""
    permission_classes = [permissions.IsAdminUser]

    def post(self, request):
        env = os.environ.copy()
        env["DJANGO_SECRET_KEY"] = env.get("DJANGO_SECRET_KEY", "test-dashboard-run-key")
        env["DJANGO_DEBUG"] = "true"
        env["DJANGO_ALLOWED_HOSTS"] = "localhost,127.0.0.1"
        env["POS_REALTIME_DEPLETION_ENABLED"] = "true"

        cmd = [
            sys.executable, "-m", "pytest",
            "-c", str(BACKEND_DIR / "pytest_integration.ini"),
            "--tb=short", "-q",
            f"--json-report-file={LAST_RUN_FILE}",
            "--json-report",
        ]
        start = time.time()
        try:
            result = subprocess.run(
                cmd,
                cwd=str(BACKEND_DIR),
                env=env,
                capture_output=True,
                text=True,
                timeout=300,
            )
        except subprocess.TimeoutExpired:
            return Response(
                {"detail": "Test run timed out (>300s). Run manually."},
                status=status.HTTP_504_GATEWAY_TIMEOUT,
            )
        elapsed = round(time.time() - start, 2)

        if not LAST_RUN_FILE.exists():
            return Response(
                {"detail": "Tests ran but no JSON report generated.",
                 "stdout": result.stdout[-2000:],
                 "stderr": result.stderr[-1000:],
                 "elapsed_s": elapsed},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        raw = json.loads(LAST_RUN_FILE.read_text(encoding="utf-8"))
        parsed = _parse_results(raw)
        parsed["elapsed_s"] = elapsed
        parsed["stdout"] = result.stdout[-3000:]
        return Response({"has_results": True, **parsed})
