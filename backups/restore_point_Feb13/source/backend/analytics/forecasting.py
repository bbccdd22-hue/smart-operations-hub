"""
AI Forecasting engine using archived Daily Sales.
- Same-day-of-week baseline
- scikit-learn Ridge regression: day-of-week, day-of-month, trend, brand-specific patterns
- Handles missing dates via interpolation.
"""
from __future__ import annotations

from datetime import date, timedelta
from typing import Any

from django.db.models import Sum

from imports.models import DailySale


def get_daily_series(
    branch_id: int | None = None,
    min_date: date | None = None,
    max_date: date | None = None,
) -> tuple[list[tuple[date, float]], list[dict[str, Any]]]:
    """
    Aggregate DailySale by date (and optionally branch).
    Returns (series as list of (date, total_sales)), list of gap warnings.
    """
    qs = DailySale.objects.values("date").annotate(total=Sum("total_sales"))
    if branch_id is not None:
        qs = qs.filter(branch_id=branch_id)
    if min_date:
        qs = qs.filter(date__gte=min_date)
    if max_date:
        qs = qs.filter(date__lte=max_date)
    rows = list(qs.order_by("date"))

    if not rows:
        return [], [{"type": "no_data", "message": "No archived daily sales for this scope."}]

    by_date = {r["date"]: float(r["total"]) for r in rows}
    start = min(by_date.keys())
    end = max(by_date.keys())
    gaps = []
    filled = []
    current = start
    while current <= end:
        val = by_date.get(current)
        if val is None:
            # Interpolate: use previous and next if available
            prev_val = None
            next_val = None
            d = current
            while d > start:
                d -= timedelta(days=1)
                if d in by_date:
                    prev_val = by_date[d]
                    break
            d = current
            while d < end:
                d += timedelta(days=1)
                if d in by_date:
                    next_val = by_date[d]
                    break
            if prev_val is not None and next_val is not None:
                filled.append((current, (prev_val + next_val) / 2))
            elif prev_val is not None:
                filled.append((current, prev_val))
            elif next_val is not None:
                filled.append((current, next_val))
            else:
                filled.append((current, 0.0))
            gaps.append({"date": current.isoformat(), "type": "filled", "interpolated": True})
        else:
            filled.append((current, val))
        current += timedelta(days=1)

    return filled, gaps


def _weekday_average(series: list[tuple[date, float]], weekday: int) -> float:
    """Average sales for given weekday (0=Monday, 6=Sunday)."""
    vals = [v for d, v in series if d.weekday() == weekday]
    return sum(vals) / len(vals) if vals else 0.0


def _build_features(d: date, ref_start: date) -> list[float]:
    """Features for ML: weekday, day_of_month, month, trend."""
    weekday = d.weekday()
    day_of_month = d.day
    month = d.month
    trend = (d - ref_start).days
    return [weekday, day_of_month, month, trend]


def _predict_with_sklearn(
    series: list[tuple[date, float]], target_date: date
) -> float | None:
    """Use scikit-learn Ridge regression if enough data."""
    try:
        from sklearn.linear_model import Ridge
        from sklearn.preprocessing import StandardScaler
    except ImportError:
        return None
    if len(series) < 14:
        return None
    ref_start = min(d for d, _ in series)
    X = [_build_features(d, ref_start) for d, _ in series]
    y = [v for _, v in series]
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    model = Ridge(alpha=1.0, random_state=42)
    model.fit(X_scaled, y)
    x_pred = scaler.transform([_build_features(target_date, ref_start)])
    return float(model.predict(x_pred)[0])


def predict_sales_for_date(
    branch_id: int | None = None,
    brand_id: int | None = None,
    target_date: date | None = None,
    lookback_days: int = 90,
) -> dict[str, Any]:
    """
    Predicted sales for a specific future date. Used by Dashboard and Production Planner.
    """
    today = date.today()
    target = target_date or today
    min_date = today - timedelta(days=lookback_days)
    qs = DailySale.objects.values("date").annotate(total=Sum("total_sales"))
    if branch_id is not None:
        qs = qs.filter(branch_id=branch_id)
    if brand_id is not None:
        qs = qs.filter(brand_id=brand_id)
    qs = qs.filter(date__gte=min_date, date__lte=today).order_by("date")
    rows = list(qs)
    if not rows:
        return {"date": target.isoformat(), "predicted_sales": 0.0, "lower": 0.0, "upper": 0.0, "method": "none"}
    by_date = {r["date"]: float(r["total"]) for r in rows}
    series = sorted(by_date.items())
    weekday = target.weekday()
    avg = _weekday_average(series, weekday)
    ml_pred = _predict_with_sklearn(series, target)
    pred = ml_pred if ml_pred is not None and ml_pred >= 0 else avg
    pred = max(0, pred)
    return {
        "date": target.isoformat(),
        "predicted_sales": round(pred, 2),
        "lower": round(pred * 0.75, 2),
        "upper": round(pred * 1.25, 2),
        "method": "sklearn" if ml_pred is not None else "weekday_avg",
    }


def forecast_next_days(
    branch_id: int | None = None,
    brand_id: int | None = None,
    horizon_days: int = 7,
    lookback_days: int = 90,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """
    Predict sales for the next `horizon_days` using weekday avg + optional sklearn.
    Returns (predictions, health_warnings).
    """
    today = date.today()
    min_date = today - timedelta(days=lookback_days)
    series, gaps = get_daily_series(branch_id=branch_id, max_date=today, min_date=min_date)
    if brand_id is not None:
        qs = DailySale.objects.values("date").annotate(total=Sum("total_sales"))
        qs = qs.filter(brand_id=brand_id, date__gte=min_date, date__lte=today)
        rows = list(qs.order_by("date"))
        if rows:
            by_date = {r["date"]: float(r["total"]) for r in rows}
            series = sorted(by_date.items())

    warnings = list(gaps)
    if not series:
        return (
            [
                {
                    "date": (today + timedelta(days=i)).isoformat(),
                    "predicted_sales": 0,
                    "lower": 0,
                    "upper": 0,
                }
                for i in range(horizon_days)
            ],
            warnings,
        )

    predictions = []
    for i in range(horizon_days):
        d = today + timedelta(days=i)
        avg = _weekday_average(series, d.weekday())
        ml_pred = _predict_with_sklearn(series, d)
        pred = ml_pred if ml_pred is not None and ml_pred >= 0 else avg
        pred = max(0, pred)
        predictions.append({
            "date": d.isoformat(),
            "predicted_sales": round(pred, 2),
            "lower": round(pred * 0.75, 2),
            "upper": round(pred * 1.25, 2),
        })

    return predictions, warnings
