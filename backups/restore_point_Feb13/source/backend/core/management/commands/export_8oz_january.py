"""
Export 8OZ January 2026 sales data (981,459.30 SAR) to JSON and CSV.
Backup before cloud migration.
"""
import csv
import json
from datetime import date
from pathlib import Path

from django.core.management.base import BaseCommand
from django.db.models import Sum
from django.utils import timezone

from imports.models import ProductSale, DailySale
from org.models import Brand


class Command(BaseCommand):
    help = "Export 8OZ January 2026 sales to backups/8OZ_january_2026_backup.json and .csv"

    def add_arguments(self, parser):
        parser.add_argument(
            "--output-dir",
            type=str,
            default=None,
            help="Output directory (default: backend/backups/)",
        )

    def handle(self, *args, **options):
        output_dir = Path(options["output_dir"] or (Path(__file__).resolve().parent.parent.parent.parent / "backups"))
        output_dir.mkdir(parents=True, exist_ok=True)

        # Resolve 8OZ brand (slug 8oz)
        brand = Brand.objects.filter(slug="8oz").first()
        if not brand:
            brand = Brand.objects.filter(name__iexact="8OZ").first()
        if not brand:
            self.stdout.write(self.style.WARNING("8OZ brand not found. Exporting all brands for Jan 2026."))
            brand = None

        jan_start = date(2026, 1, 1)
        jan_end = date(2026, 1, 31)

        # Product sales (صافي المبيعات - Net Sales)
        ps_qs = ProductSale.objects.filter(date__gte=jan_start, date__lte=jan_end)
        if brand:
            ps_qs = ps_qs.filter(brand=brand)

        ps_rows = list(
            ps_qs.values(
                "branch__name", "branch__name_ar", "date", "product_name", "qty", "total_sales"
            ).order_by("date", "product_name")
        )
        ps_list = []
        for row in ps_rows:
            r = dict(row)
            r["date"] = r["date"].isoformat() if r.get("date") else None
            r["total_sales"] = float(r["total_sales"])
            r["qty"] = float(r["qty"])
            ps_list.append(r)

        ps_total = float(ps_qs.aggregate(s=Sum("total_sales"))["s"] or 0)

        # Daily sales
        ds_qs = DailySale.objects.filter(date__gte=jan_start, date__lte=jan_end)
        if brand:
            ds_qs = ds_qs.filter(brand=brand)

        ds_rows = list(
            ds_qs.values("branch__name", "date", "total_sales", "cash_amount", "network_amount").order_by("date")
        )
        ds_list = []
        for row in ds_rows:
            r = dict(row)
            r["date"] = r["date"].isoformat() if r.get("date") else None
            r["total_sales"] = float(r["total_sales"])
            r["cash_amount"] = float(r["cash_amount"] or 0)
            r["network_amount"] = float(r["network_amount"] or 0)
            ds_list.append(r)

        ds_total = float(ds_qs.aggregate(s=Sum("total_sales"))["s"] or 0)

        payload = {
            "exported_at": timezone.now().isoformat(),
            "period": {"from": "2026-01-01", "to": "2026-01-31"},
            "brand": "8OZ",
            "product_sales_total_sar": round(ps_total, 2),
            "daily_sales_total_sar": round(ds_total, 2),
            "product_sales_rows": ps_list,
            "daily_sales_rows": ds_list,
            "note": "صافي المبيعات (Net Sales) - Column L only. Ref: 981,459.30 SAR",
        }

        # JSON
        json_path = output_dir / "8OZ_january_2026_backup.json"
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)
        self.stdout.write(self.style.SUCCESS(f"Saved {json_path}"))
        self.stdout.write(f"  Product Sales total: {payload['product_sales_total_sar']:,.2f} SAR")
        self.stdout.write(f"  Daily Sales total:    {payload['daily_sales_total_sar']:,.2f} SAR")

        # CSV - product sales if present, else daily sales (source of 981,459.30 SAR)
        csv_path = output_dir / "8OZ_january_2026_backup.csv"
        with open(csv_path, "w", encoding="utf-8-sig", newline="") as f:
            if ps_list:
                csv_rows = [
                    {k: v for k, v in row.items() if k in ["date", "branch__name", "product_name", "qty", "total_sales"]}
                    for row in ps_list
                ]
                w = csv.DictWriter(f, fieldnames=["date", "branch__name", "product_name", "qty", "total_sales"])
                w.writeheader()
                w.writerows(csv_rows)
                f.write(f"\n# Total (صافي المبيعات): {ps_total:,.2f} SAR\n")
            elif ds_list:
                w = csv.DictWriter(f, fieldnames=["date", "branch__name", "total_sales", "cash_amount", "network_amount"])
                w.writeheader()
                w.writerows(ds_list)
                f.write(f"\n# Total (صافي المبيعات): {ds_total:,.2f} SAR\n")
        self.stdout.write(self.style.SUCCESS(f"Saved {csv_path}"))
