"""CSV regression tests across three existing command-line interfaces."""
import csv
from pathlib import Path
from cli import main as enterprise_main
from surgical_site_infection_agent.cli import main as package_main
from ssi_sentinel import main as sentinel_main

def run_batch(tmp_path, cli, fields, row):
    src = tmp_path / "in.csv"
    dst = tmp_path / "out.csv"
    with src.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        writer.writerow(row)
    assert cli(["batch", "--input", str(src), "--output", str(dst)]) == 0
    with dst.open(newline="", encoding="utf-8") as f:
        return next(csv.DictReader(f))

def test_csv_false_does_not_trigger_enterprise_critical(tmp_path):
    result = run_batch(tmp_path, enterprise_main,
        ["task_id", "target_identifier", "primary_metric", "secondary_metric", "is_critical_flag"],
        dict(task_id="T-1", target_identifier="SYNTH-1", primary_metric=1,
             secondary_metric=1, is_critical_flag="False"))
    assert result["overall_urgency"] == "ROUTINE"

def test_csv_false_does_not_trigger_package_stat(tmp_path):
    result = run_batch(tmp_path, package_main,
        ["case_id", "patient_synthetic_id", "metric_primary", "metric_secondary", "is_stat", "status_flag"],
        dict(case_id="T-2", patient_synthetic_id="SYNTH-2", metric_primary=1,
             metric_secondary=1, is_stat="False", status_flag="NORMAL"))
    assert result["stat_critical_alerts"] == "0"

def test_csv_false_does_not_trigger_sentinel_critical(tmp_path):
    result = run_batch(tmp_path, sentinel_main,
        ["case_id", "metric_primary", "metric_secondary", "critical_flag", "status_text"],
        dict(case_id="T-3", metric_primary=1, metric_secondary=1,
             critical_flag="False", status_text="NORMAL"))
    assert result["critical_count"] == "0"
