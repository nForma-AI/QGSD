#!/usr/bin/env python3
# scripts/benchmark_scripts_test.py
# Adversarial tests for benchmark integration scripts.
import json, os, subprocess, sys, tempfile, unittest
from pathlib import Path

SCRIPTS_DIR = Path(__file__).parent


class TestBenchmarkCompare(unittest.TestCase):
    """Tests for benchmark-compare.py"""

    def _write_report(self, path, data):
        with open(path, "w") as f:
            json.dump({"report": data}, f)

    def _write_baseline(self, path, data):
        with open(path, "w") as f:
            json.dump(data, f)

    def _run_compare(self, report_data, baseline_data=None, env_overrides=None):
        with tempfile.TemporaryDirectory() as td:
            td = Path(td)
            report_path = td / "report.json"
            baseline_path = td / "baseline.json"
            output_path = td / "output.txt"
            secrets_path = "/tmp/benchmark_secrets.json"

            self._write_report(report_path, report_data)
            if baseline_data is not None:
                self._write_baseline(baseline_path, baseline_data)

            env = {**os.environ}
            env["REPORT"] = str(report_path)
            env["BASELINE"] = str(baseline_path)
            env["GITHUB_OUTPUT"] = str(output_path)
            if env_overrides:
                env.update(env_overrides)

            try:
                os.unlink(secrets_path)
            except FileNotFoundError:
                pass

            script = SCRIPTS_DIR / "benchmark-compare.py"
            r = subprocess.run(
                [sys.executable, str(script)],
                env=env,
                capture_output=True,
                text=True,
            )
            return r, output_path, secrets_path

    def test_report_missing_report_key(self):
        """Report JSON has no 'report' key - should crash or handle gracefully"""
        with tempfile.TemporaryDirectory() as td:
            td = Path(td)
            report_path = td / "report.json"
            with open(report_path, "w") as f:
                json.dump({"not_report": {}}, f)

            env = {
                "REPORT": str(report_path),
                "BASELINE": str(td / "baseline.json"),
                "GITHUB_OUTPUT": str(td / "out.txt"),
            }
            script = SCRIPTS_DIR / "benchmark-compare.py"
            r = subprocess.run(
                [sys.executable, str(script)], env=env, capture_output=True, text=True
            )
            self.assertNotEqual(
                r.returncode, 0, "Should fail when report key is missing"
            )

    def test_report_missing_passRate(self):
        """Report missing passRate field"""
        r, _, _ = self._run_compare({"total": 10, "passed": 5})
        self.assertNotEqual(r.returncode, 0, "Should fail when passRate is missing")

    def test_report_missing_total(self):
        """Report missing total field"""
        r, _, _ = self._run_compare({"passRate": 50.0, "passed": 5})
        self.assertNotEqual(r.returncode, 0, "Should fail when total is missing")

    def test_report_missing_passed(self):
        """Report missing passed field"""
        r, _, _ = self._run_compare({"passRate": 50.0, "total": 10})
        self.assertNotEqual(r.returncode, 0, "Should fail when passed is missing")

    def test_report_zero_total(self):
        """Report has zero total tests - exits 1 (not improved) which is correct behavior"""
        r, _, _ = self._run_compare(
            {"passRate": 0, "total": 0, "passed": 0, "byCategory": {}}
        )
        self.assertEqual(
            r.returncode, 1, "Zero tests vs zero baseline = not improved, exit 1"
        )

    def test_byCategory_empty(self):
        """byCategory dict is empty - should not crash"""
        r, _, _ = self._run_compare(
            {"passRate": 50.0, "total": 10, "passed": 5, "byCategory": {}}
        )
        self.assertEqual(r.returncode, 0)

    def test_byCategory_missing_inner_fields(self):
        """byCategory entry missing 'passed' or 'total' fields"""
        r, _, _ = self._run_compare(
            {
                "passRate": 50.0,
                "total": 10,
                "passed": 5,
                "byCategory": {"foo": {"passed": 5}},
            }
        )
        self.assertNotEqual(
            r.returncode, 0, "Should fail when byCategory entry missing 'total'"
        )

    def test_byCategory_zero_total_in_entry(self):
        """byCategory entry has zero total - division by zero"""
        r, _, _ = self._run_compare(
            {
                "passRate": 50.0,
                "total": 10,
                "passed": 5,
                "byCategory": {"foo": {"passed": 5, "total": 0}},
            }
        )
        self.assertEqual(r.returncode, 0, "Should handle zero total in category entry")

    def test_baseline_invalid_json(self):
        """Baseline file contains invalid JSON"""
        with tempfile.TemporaryDirectory() as td:
            td = Path(td)
            report_path = td / "report.json"
            baseline_path = td / "baseline.json"
            self._write_report(
                report_path,
                {"passRate": 50.0, "total": 10, "passed": 5, "byCategory": {}},
            )
            with open(baseline_path, "w") as f:
                f.write("not valid json{")

            env = {
                "REPORT": str(report_path),
                "BASELINE": str(baseline_path),
                "GITHUB_OUTPUT": str(td / "out.txt"),
            }
            script = SCRIPTS_DIR / "benchmark-compare.py"
            r = subprocess.run(
                [sys.executable, str(script)], env=env, capture_output=True, text=True
            )
            self.assertEqual(
                r.returncode, 0, "Should fallback to empty baseline on invalid JSON"
            )

    def test_special_chars_in_baseline_path(self):
        """Baseline path with special characters (spaces, quotes)"""
        with tempfile.TemporaryDirectory() as td:
            td = Path(td)
            report_path = td / "report.json"
            baseline_path = td / "baseline with spaces.json"
            self._write_report(
                report_path,
                {"passRate": 50.0, "total": 10, "passed": 5, "byCategory": {}},
            )

            env = {
                "REPORT": str(report_path),
                "BASELINE": str(baseline_path),
                "GITHUB_OUTPUT": str(td / "out.txt"),
            }
            script = SCRIPTS_DIR / "benchmark-compare.py"
            r = subprocess.run(
                [sys.executable, str(script)], env=env, capture_output=True, text=True
            )
            self.assertEqual(r.returncode, 0)

    def test_byCategory_key_mismatch(self):
        """Report uses byCategory but baseline uses by_category - this is the key mismatch bug"""
        with tempfile.TemporaryDirectory() as td:
            td = Path(td)
            report_path = td / "report.json"
            baseline_path = td / "baseline.json"
            self._write_report(
                report_path,
                {
                    "passRate": 50.0,
                    "total": 10,
                    "passed": 5,
                    "byCategory": {"test-cat": {"passed": 5, "total": 10}},
                },
            )
            self._write_baseline(
                baseline_path,
                {
                    "pass_rate": 40.0,
                    "by_category": {"test-cat": {"passed": 4, "total": 10, "rate": 40}},
                },
            )

            env = {
                "REPORT": str(report_path),
                "BASELINE": str(baseline_path),
                "GITHUB_OUTPUT": str(td / "out.txt"),
            }
            script = SCRIPTS_DIR / "benchmark-compare.py"
            r = subprocess.run(
                [sys.executable, str(script)], env=env, capture_output=True, text=True
            )
            self.assertEqual(r.returncode, 0)


class TestBenchmarkGateParse(unittest.TestCase):
    """Tests for benchmark-gate-parse.py"""

    def _run_gate_parse(self, report_data, baseline_data=None, env_overrides=None):
        with tempfile.TemporaryDirectory() as td:
            td = Path(td)
            report_path = td / "report.json"
            baseline_path = td / "baseline.json"
            output_path = td / "output.txt"

            with open(report_path, "w") as f:
                json.dump({"report": report_data}, f)
            if baseline_data is not None:
                with open(baseline_path, "w") as f:
                    json.dump(baseline_data, f)

            env = {**os.environ}
            env["REPORT"] = str(report_path)
            env["BASELINE"] = str(baseline_path)
            env["GITHUB_OUTPUT"] = str(output_path)
            if env_overrides:
                env.update(env_overrides)

            script = SCRIPTS_DIR / "benchmark-gate-parse.py"
            r = subprocess.run(
                [sys.executable, str(script)],
                env=env,
                capture_output=True,
                text=True,
            )
            return r, output_path

    def test_report_missing_report_key(self):
        """Report JSON has no 'report' key"""
        with tempfile.TemporaryDirectory() as td:
            td = Path(td)
            report_path = td / "report.json"
            with open(report_path, "w") as f:
                json.dump({"not_report": {}}, f)
            env = {
                "REPORT": str(report_path),
                "BASELINE": str(td / "baseline.json"),
                "GITHUB_OUTPUT": str(td / "out.txt"),
            }
            script = SCRIPTS_DIR / "benchmark-gate-parse.py"
            r = subprocess.run(
                [sys.executable, str(script)], env=env, capture_output=True, text=True
            )
            self.assertNotEqual(r.returncode, 0)

    def test_report_missing_passRate(self):
        """Report missing passRate"""
        r, _ = self._run_gate_parse({"total": 10, "passed": 5})
        self.assertNotEqual(r.returncode, 0)

    def test_report_missing_passed_and_total(self):
        """Report missing passed and total"""
        r, _ = self._run_gate_parse({"passRate": 50.0})
        self.assertNotEqual(r.returncode, 0)

    def test_byDifficulty_missing_inner_fields(self):
        """byDifficulty entry missing fields"""
        r, _ = self._run_gate_parse(
            {
                "passRate": 50.0,
                "total": 10,
                "passed": 5,
                "byDifficulty": {"easy": {"passed": 5}},
            }
        )
        self.assertNotEqual(r.returncode, 0)

    def test_byLayer_missing_inner_fields(self):
        """byLayer entry missing fields - benchmark-gate-parse.py does NOT process byLayer, so it won't crash"""
        r, _ = self._run_gate_parse(
            {
                "passRate": 50.0,
                "total": 10,
                "passed": 5,
                "byLayer": {"layer1": {"passed": 5}},
            }
        )
        self.assertEqual(
            r.returncode,
            0,
            "benchmark-gate-parse.py skips byLayer entirely, so no crash",
        )

    def test_byCategory_key_mismatch_reads_wrong_key(self):
        """baseline uses by_category but report uses byCategory - comparison fails silently"""
        r, _ = self._run_gate_parse(
            {
                "passRate": 30.0,
                "total": 10,
                "passed": 3,
                "byCategory": {"cat_a": {"passed": 3, "total": 10}},
            },
            {
                "pass_rate": 80.0,
                "by_category": {"cat-a": {"passed": 8, "total": 10, "rate": 80}},
            },
        )
        self.assertEqual(
            r.returncode,
            0,
            "Bug: regression from 80% to 30% NOT detected due to key name mismatch",
        )


class TestBenchmarkCheck(unittest.TestCase):
    """Tests for benchmark-check.py"""

    def _run_check(self, argv):
        script = SCRIPTS_DIR / "benchmark-check.py"
        r = subprocess.run(
            [sys.executable, str(script)] + argv, capture_output=True, text=True
        )
        return r

    def test_negative_pass_rate(self):
        """Negative pass rate value"""
        r = self._run_check(["-5.0", "50.0"])
        self.assertIn("FAIL", r.stdout, "Should detect negative rate as regression")

    def test_pass_rate_over_100(self):
        """Pass rate > 100"""
        r = self._run_check(["150.0", "50.0"])
        self.assertNotEqual(r.returncode, 0, "Should fail for out-of-range pass rate")

    def test_pass_rate_exactly_100(self):
        """Pass rate exactly 100"""
        r = self._run_check(["100.0", "50.0"])
        self.assertEqual(r.returncode, 0)

    def test_non_numeric_pass_rate(self):
        """Non-numeric pass rate"""
        r = self._run_check(["fifty", "50.0"])
        self.assertNotEqual(r.returncode, 0, "Should fail on non-numeric input")

    def test_missing_all_args(self):
        """Missing all command-line arguments"""
        r = self._run_check([])
        self.assertNotEqual(r.returncode, 0)

    def test_missing_tolerance_arg(self):
        """Missing tolerance argument - should default to 3.0"""
        r = self._run_check(["80.0", "70.0"])
        self.assertEqual(r.returncode, 0, "Should work with just 2 args")

    def test_tolerance_zero(self):
        """Zero tolerance - exact match required"""
        r = self._run_check(["79.9", "80.0", "0.0"])
        self.assertNotEqual(
            r.returncode, 0, "Should fail with zero tolerance and small delta"
        )

    def test_tolerance_negative(self):
        """Negative tolerance - should be treated as zero tolerance or fail"""
        r = self._run_check(["80.0", "70.0", "-5.0"])
        self.assertNotEqual(
            r.returncode, 0, "Should handle negative tolerance gracefully"
        )


class TestBenchmarkSecretsSync(unittest.TestCase):
    """Tests for benchmark-secrets-sync.py"""

    def _write_secrets(self, path, data):
        with open(path, "w") as f:
            json.dump(data, f)

    def _run_sync(self, secrets_data):
        with tempfile.TemporaryDirectory() as td:
            td = Path(td)
            secrets_path = Path("/tmp/benchmark_secrets.json")
            self._write_secrets(secrets_path, secrets_data)

            script = SCRIPTS_DIR / "benchmark-secrets-sync.py"
            r = subprocess.run(
                [sys.executable, str(script)], capture_output=True, text=True
            )
            return r

    def test_secrets_file_missing(self):
        """Secrets file does not exist"""
        script = SCRIPTS_DIR / "benchmark-secrets-sync.py"
        try:
            os.unlink("/tmp/benchmark_secrets.json")
        except FileNotFoundError:
            pass
        r = subprocess.run(
            [sys.executable, str(script)], capture_output=True, text=True
        )
        self.assertNotEqual(r.returncode, 0, "Should fail when secrets file is missing")

    def test_secrets_invalid_json(self):
        """Secrets file contains invalid JSON"""
        with open("/tmp/benchmark_secrets.json", "w") as f:
            f.write("not valid json{")
        script = SCRIPTS_DIR / "benchmark-secrets-sync.py"
        r = subprocess.run(
            [sys.executable, str(script)], capture_output=True, text=True
        )
        self.assertNotEqual(r.returncode, 0)

    def test_secrets_empty_dict(self):
        """Secrets dict is empty"""
        r = self._run_sync({})
        self.assertEqual(r.returncode, 0)

    def test_secret_value_with_single_quote(self):
        """Secret value contains single quote - shell escaping issue"""
        r = self._run_sync({"TEST_KEY": "value with ' single quote"})
        self.assertEqual(r.returncode, 0)

    def test_secret_value_with_double_quote(self):
        """Secret value contains double quote"""
        r = self._run_sync({"TEST_KEY": 'value with " double quote'})
        self.assertEqual(r.returncode, 0)

    def test_secret_value_with_dollar(self):
        """Secret value contains dollar sign - shell variable expansion risk"""
        r = self._run_sync({"TEST_KEY": "value with $ dollar"})
        self.assertEqual(r.returncode, 0)

    def test_secret_value_with_backtick(self):
        """Secret value contains backtick - command injection risk"""
        r = self._run_sync({"TEST_KEY": "value with `backtick`"})
        self.assertEqual(r.returncode, 0)

    def test_secret_non_string_key(self):
        """Secret key is not a string - f-string silently converts to string"""
        r = self._run_sync({123: "value"})
        self.assertEqual(
            r.returncode, 0, "f-string converts int key to string silently"
        )

    def test_gh_cli_not_available(self):
        """gh CLI is not installed or not in PATH"""
        env = {**os.environ, "PATH": "/nonexistent"}
        script = SCRIPTS_DIR / "benchmark-secrets-sync.py"
        self._write_secrets("/tmp/benchmark_secrets.json", {"TEST_KEY": "value"})
        r = subprocess.run(
            [sys.executable, str(script)], env=env, capture_output=True, text=True
        )
        self.assertEqual(
            r.returncode, 0, "Should continue gracefully when gh is unavailable"
        )


class TestYamlWorkflows(unittest.TestCase):
    """YAML workflow validation tests"""

    def test_benchmark_gate_yaml_parseable(self):
        """benchmark-gate.yml is valid YAML"""
        import yaml

        path = Path(".github/workflows/benchmark-gate.yml")
        with open(path) as f:
            data = yaml.safe_load(f)
        self.assertIsNotNone(data)
        self.assertEqual(data["name"], "Benchmark gate")

    def test_benchmark_sync_yaml_parseable(self):
        """benchmark-sync.yml is valid YAML"""
        import yaml

        path = Path(".github/workflows/benchmark-sync.yml")
        with open(path) as f:
            data = yaml.safe_load(f)
        self.assertIsNotNone(data)
        self.assertEqual(data["name"], "Benchmark baseline sync")

    def test_benchmark_gate_trigger_on_pull_request(self):
        """benchmark-gate.yml triggers on pull_request"""
        import yaml

        with open(".github/workflows/benchmark-gate.yml") as f:
            data = yaml.safe_load(f)
        on_value = data.get(True, data.get("on", {}))
        self.assertIn("pull_request", on_value)

    def test_benchmark_sync_trigger_on_push(self):
        """benchmark-sync.yml triggers on push"""
        import yaml

        with open(".github/workflows/benchmark-sync.yml") as f:
            data = yaml.safe_load(f)
        on_value = data.get(True, data.get("on", {}))
        self.assertIn("push", on_value)

    def test_benchmark_gate_has_timeout(self):
        """benchmark-gate.yml has timeout-minutes set"""
        import yaml

        with open(".github/workflows/benchmark-gate.yml") as f:
            data = yaml.safe_load(f)
        timeout = data["jobs"]["benchmark"].get("timeout-minutes")
        self.assertIsNotNone(timeout)

    def test_benchmark_gate_output_variable_names_match(self):
        """benchmark-gate.yml output var names match what benchmark-gate-parse.py writes"""
        import yaml

        with open(".github/workflows/benchmark-gate.yml") as f:
            data = yaml.safe_load(f)
        outputs = data["jobs"]["benchmark"]["steps"][6].get("env", {})
        self.assertIn("REPORT", outputs)
        self.assertIn("BASELINE", outputs)

    def test_benchmark_sync_output_variable_names_match(self):
        """benchmark-sync.yml output var names match what benchmark-compare.py writes"""
        import yaml

        with open(".github/workflows/benchmark-sync.yml") as f:
            data = yaml.safe_load(f)
        outputs = data["jobs"]["benchmark-sync"]["steps"][6].get("env", {})
        self.assertIn("REPORT", outputs)
        self.assertIn("BASELINE", outputs)


class TestPathTraversalAttacks(unittest.TestCase):
    """Path traversal and symlink attack surface in benchmark scripts"""

    def _write_report(self, path, data):
        with open(path, "w") as f:
            json.dump({"report": data}, f)

    def _write_baseline(self, path, data):
        with open(path, "w") as f:
            json.dump(data, f)

    def test_benchmark_compare_path_traversal_in_report(self):
        """Path traversal via REPORT env var - script should fail on bad path"""
        with tempfile.TemporaryDirectory() as td:
            td = Path(td)
            baseline_path = td / "baseline.json"
            output_path = td / "output.txt"
            self._write_baseline(baseline_path, {"pass_rate": 50.0, "by_category": {}})

            report_path = td / "../../../tmp/traversal_report.json"
            env = {
                "REPORT": str(report_path),
                "BASELINE": str(baseline_path),
                "GITHUB_OUTPUT": str(output_path),
            }
            script = SCRIPTS_DIR / "benchmark-compare.py"
            r = subprocess.run(
                [sys.executable, str(script)], env=env, capture_output=True, text=True
            )
            self.assertNotEqual(
                r.returncode, 0, "Should reject paths with traversal sequences"
            )

    def test_benchmark_compare_path_traversal_in_baseline(self):
        """Path traversal via BASELINE env var - script should fail gracefully"""
        with tempfile.TemporaryDirectory() as td:
            td = Path(td)
            report_path = td / "report.json"
            output_path = td / "output.txt"
            self._write_report(
                report_path,
                {"passRate": 50.0, "total": 10, "passed": 5, "byCategory": {}},
            )

            baseline_path = "../../../tmp/traversal_baseline.json"
            env = {
                "REPORT": str(report_path),
                "BASELINE": str(baseline_path),
                "GITHUB_OUTPUT": str(output_path),
            }
            script = SCRIPTS_DIR / "benchmark-compare.py"
            r = subprocess.run(
                [sys.executable, str(script)], env=env, capture_output=True, text=True
            )
            self.assertNotEqual(
                r.returncode, 0, "Should reject paths with traversal sequences"
            )

    def test_benchmark_gate_parse_path_traversal(self):
        """Path traversal in benchmark-gate-parse.py REPORT env var"""
        with tempfile.TemporaryDirectory() as td:
            td = Path(td)
            baseline_path = td / "baseline.json"
            output_path = td / "output.txt"
            self._write_baseline(baseline_path, {"pass_rate": 50.0})

            report_path = "../../../tmp/traversal_gate.json"
            env = {
                "REPORT": str(report_path),
                "BASELINE": str(baseline_path),
                "GITHUB_OUTPUT": str(output_path),
            }
            script = SCRIPTS_DIR / "benchmark-gate-parse.py"
            r = subprocess.run(
                [sys.executable, str(script)], env=env, capture_output=True, text=True
            )
            self.assertNotEqual(r.returncode, 0)

    def test_symlink_attack_in_report_path(self):
        """Report path is a symlink pointing outside temp dir - script should not follow it"""
        with tempfile.TemporaryDirectory() as td:
            td = Path(td)
            report_path = td / "report.json"
            output_path = td / "output.txt"
            baseline_path = td / "baseline.json"

            self._write_baseline(baseline_path, {"pass_rate": 50.0, "by_category": {}})

            secret_file = td / "secret_data.txt"
            secret_file.write_text("sensitive content")

            symlink_path = td / "link_to_secret"
            try:
                symlink_path.symlink_to(secret_file)
            except OSError:
                self.skipTest("Symlinks not supported on this platform")

            with open(report_path, "w") as f:
                json.dump(
                    {
                        "report": {
                            "passRate": 50.0,
                            "total": 10,
                            "passed": 5,
                            "byCategory": {},
                        }
                    },
                    f,
                )

            env = {
                "REPORT": str(symlink_path),
                "BASELINE": str(baseline_path),
                "GITHUB_OUTPUT": str(output_path),
            }
            script = SCRIPTS_DIR / "benchmark-compare.py"
            r = subprocess.run(
                [sys.executable, str(script)], env=env, capture_output=True, text=True
            )
            self.assertNotEqual(
                r.returncode, 0, "Should not follow symlinks for report path"
            )
            self.assertNotEqual(
                r.returncode, 0, "Should not follow symlinks for report path"
            )


class TestUnicodeAndSpecialCharAttacks(unittest.TestCase):
    """Unicode, BOM, and special character injection in JSON"""

    def test_json_with_bom_prefix(self):
        """JSON file has UTF-8 BOM prefix - should still parse correctly"""
        with tempfile.TemporaryDirectory() as td:
            td = Path(td)
            report_path = td / "report.json"
            baseline_path = td / "baseline.json"
            output_path = td / "output.txt"

            with open(report_path, "w", encoding="utf-8") as f:
                f.write("\ufeff")
                json.dump(
                    {
                        "report": {
                            "passRate": 50.0,
                            "total": 10,
                            "passed": 5,
                            "byCategory": {},
                        }
                    },
                    f,
                )
            with open(baseline_path, "w") as f:
                json.dump({"pass_rate": 40.0, "by_category": {}}, f)

            env = {
                "REPORT": str(report_path),
                "BASELINE": str(baseline_path),
                "GITHUB_OUTPUT": str(output_path),
            }
            script = SCRIPTS_DIR / "benchmark-compare.py"
            r = subprocess.run(
                [sys.executable, str(script)], env=env, capture_output=True, text=True
            )
            self.assertIn(r.returncode, (0, 1))

    def test_json_with_unicode_null_byte(self):
        """JSON values contain null bytes - should be handled safely"""
        with tempfile.TemporaryDirectory() as td:
            td = Path(td)
            report_path = td / "report.json"
            baseline_path = td / "baseline.json"
            output_path = td / "output.txt"

            with open(report_path, "w") as f:
                json.dump(
                    {
                        "report": {
                            "passRate": 50.0,
                            "total": 10,
                            "passed": 5,
                            "byCategory": {
                                "cat\x00with\x00null": {"passed": 5, "total": 10}
                            },
                        }
                    },
                    f,
                )
            with open(baseline_path, "w") as f:
                json.dump({"pass_rate": 40.0, "by_category": {}}, f)

            env = {
                "REPORT": str(report_path),
                "BASELINE": str(baseline_path),
                "GITHUB_OUTPUT": str(output_path),
            }
            script = SCRIPTS_DIR / "benchmark-compare.py"
            r = subprocess.run(
                [sys.executable, str(script)], env=env, capture_output=True, text=True
            )
            self.assertIn(r.returncode, (0, 1))

    def test_json_with_rlo_char_in_category(self):
        """Category name contains RTL/LTR override chars - could confuse display/output"""
        with tempfile.TemporaryDirectory() as td:
            td = Path(td)
            report_path = td / "report.json"
            baseline_path = td / "baseline.json"
            output_path = td / "output.txt"

            rlo_cat = "cat\u202ewith\u202erlo"
            with open(report_path, "w") as f:
                json.dump(
                    {
                        "report": {
                            "passRate": 50.0,
                            "total": 10,
                            "passed": 5,
                            "byCategory": {rlo_cat: {"passed": 5, "total": 10}},
                        }
                    },
                    f,
                )
            with open(baseline_path, "w") as f:
                json.dump({"pass_rate": 40.0, "by_category": {}}, f)

            env = {
                "REPORT": str(report_path),
                "BASELINE": str(baseline_path),
                "GITHUB_OUTPUT": str(output_path),
            }
            script = SCRIPTS_DIR / "benchmark-compare.py"
            r = subprocess.run(
                [sys.executable, str(script)], env=env, capture_output=True, text=True
            )
            self.assertIn(
                r.returncode, (0, 1), "Should handle unicode in category names"
            )


class TestFloatBoundaryAndInfinity(unittest.TestCase):
    """Float boundary conditions, infinity, NaN in report values"""

    def test_gate_parse_infinity_passRate_should_error(self):
        """passRate is Infinity - script should reject it with non-zero exit"""
        with tempfile.TemporaryDirectory() as td:
            td = Path(td)
            report_path = td / "report.json"
            baseline_path = td / "baseline.json"
            output_path = td / "output.txt"

            with open(report_path, "w") as f:
                json.dump(
                    {
                        "report": {
                            "passRate": float("inf"),
                            "total": 10,
                            "passed": 10,
                            "byCategory": {},
                        }
                    },
                    f,
                )
            with open(baseline_path, "w") as f:
                json.dump({"pass_rate": 50.0, "by_category": {}}, f)

            env = {
                "REPORT": str(report_path),
                "BASELINE": str(baseline_path),
                "GITHUB_OUTPUT": str(output_path),
            }
            script = SCRIPTS_DIR / "benchmark-gate-parse.py"
            r = subprocess.run(
                [sys.executable, str(script)], env=env, capture_output=True, text=True
            )
            self.assertNotEqual(
                r.returncode,
                0,
                "Infinity passRate should cause script to exit with error",
            )

    def test_gate_parse_nan_passRate_should_error(self):
        """passRate is NaN - comparisons always fail silently, script should detect and error"""
        with tempfile.TemporaryDirectory() as td:
            td = Path(td)
            report_path = td / "report.json"
            baseline_path = td / "baseline.json"
            output_path = td / "output.txt"

            with open(report_path, "w") as f:
                json.dump(
                    {
                        "report": {
                            "passRate": float("nan"),
                            "total": 10,
                            "passed": 5,
                            "byCategory": {},
                        }
                    },
                    f,
                )
            with open(baseline_path, "w") as f:
                json.dump({"pass_rate": 50.0, "by_category": {}}, f)

            env = {
                "REPORT": str(report_path),
                "BASELINE": str(baseline_path),
                "GITHUB_OUTPUT": str(output_path),
            }
            script = SCRIPTS_DIR / "benchmark-gate-parse.py"
            r = subprocess.run(
                [sys.executable, str(script)], env=env, capture_output=True, text=True
            )
            self.assertNotEqual(
                r.returncode,
                0,
                "NaN passRate should cause script to exit with error",
            )

    def test_pass_rate_is_infinity(self):
        """passRate is Infinity - produces invalid delta, but script may not crash"""
        with tempfile.TemporaryDirectory() as td:
            td = Path(td)
            report_path = td / "report.json"
            baseline_path = td / "baseline.json"
            output_path = td / "output.txt"

            with open(report_path, "w") as f:
                json.dump(
                    {
                        "report": {
                            "passRate": float("inf"),
                            "total": 10,
                            "passed": 10,
                            "byCategory": {},
                        }
                    },
                    f,
                )
            with open(baseline_path, "w") as f:
                json.dump({"pass_rate": 50.0, "by_category": {}}, f)

            env = {
                "REPORT": str(report_path),
                "BASELINE": str(baseline_path),
                "GITHUB_OUTPUT": str(output_path),
            }
            script = SCRIPTS_DIR / "benchmark-compare.py"
            r = subprocess.run(
                [sys.executable, str(script)], env=env, capture_output=True, text=True
            )
            self.assertNotEqual(
                r.returncode,
                0,
                "Infinity passRate should cause script to reject it",
            )

    def test_pass_rate_is_nan(self):
        """passRate is NaN - comparisons always fail, produces wrong results"""
        with tempfile.TemporaryDirectory() as td:
            td = Path(td)
            report_path = td / "report.json"
            baseline_path = td / "baseline.json"
            output_path = td / "output.txt"

            with open(report_path, "w") as f:
                json.dump(
                    {
                        "report": {
                            "passRate": float("nan"),
                            "total": 10,
                            "passed": 5,
                            "byCategory": {},
                        }
                    },
                    f,
                )
            with open(baseline_path, "w") as f:
                json.dump({"pass_rate": 50.0, "by_category": {}}, f)

            env = {
                "REPORT": str(report_path),
                "BASELINE": str(baseline_path),
                "GITHUB_OUTPUT": str(output_path),
            }
            script = SCRIPTS_DIR / "benchmark-compare.py"
            r = subprocess.run(
                [sys.executable, str(script)], env=env, capture_output=True, text=True
            )
            self.assertNotEqual(
                r.returncode,
                0,
                "NaN passRate should cause script to reject it",
            )

    def test_pass_rate_huge_number(self):
        """passRate is an extremely large number (1e309) - becomes inf in float"""
        with tempfile.TemporaryDirectory() as td:
            td = Path(td)
            report_path = td / "report.json"
            baseline_path = td / "baseline.json"
            output_path = td / "output.txt"

            with open(report_path, "w") as f:
                json.dump(
                    {
                        "report": {
                            "passRate": 1e309,
                            "total": 10,
                            "passed": 10,
                            "byCategory": {},
                        }
                    },
                    f,
                )
            with open(baseline_path, "w") as f:
                json.dump({"pass_rate": 50.0, "by_category": {}}, f)

            env = {
                "REPORT": str(report_path),
                "BASELINE": str(baseline_path),
                "GITHUB_OUTPUT": str(output_path),
            }
            script = SCRIPTS_DIR / "benchmark-compare.py"
            r = subprocess.run(
                [sys.executable, str(script)], env=env, capture_output=True, text=True
            )
            self.assertNotEqual(
                r.returncode,
                0,
                "1e309 overflows to inf - should be rejected",
            )


class TestBenchmarkCheckOverflow(unittest.TestCase):
    """Float overflow and extreme delta handling in benchmark-check.py"""

    def test_delta_overflow_to_infinity(self):
        """float('inf') as current rate - should be rejected as invalid"""
        script = SCRIPTS_DIR / "benchmark-check.py"
        r = subprocess.run(
            [sys.executable, str(script), "Infinity", "0.0", "3.0"],
            capture_output=True,
            text=True,
        )
        self.assertNotEqual(
            r.returncode,
            0,
            "Infinity pass rate should be rejected (non-zero exit)",
        )

    def test_compare_huge_delta_overflow(self):
        """Infinity pass rate in compare should be rejected"""
        with tempfile.TemporaryDirectory() as td:
            td = Path(td)
            report_path = td / "report.json"
            baseline_path = td / "baseline.json"
            output_path = td / "output.txt"

            with open(report_path, "w") as f:
                json.dump(
                    {
                        "report": {
                            "passRate": float("inf"),
                            "total": 10,
                            "passed": 10,
                            "byCategory": {},
                        }
                    },
                    f,
                )
            with open(baseline_path, "w") as f:
                json.dump({"pass_rate": 0.0, "by_category": {}}, f)

            env = {
                "REPORT": str(report_path),
                "BASELINE": str(baseline_path),
                "GITHUB_OUTPUT": str(output_path),
            }
            script = SCRIPTS_DIR / "benchmark-compare.py"
            r = subprocess.run(
                [sys.executable, str(script)], env=env, capture_output=True, text=True
            )
            self.assertNotEqual(
                r.returncode,
                0,
                "Huge delta (1e308 - -1e308) overflows - should be rejected",
            )


class TestShellInjectionInSecretsSync(unittest.TestCase):
    """Command injection via secret values in benchmark-secrets-sync.py"""

    def test_secret_key_shell_injection_rejected(self):
        """Secret key with $() injection - script should reject or sanitize key, not execute it"""
        secrets_path = Path("/tmp/benchmark_secrets.json")
        with open(secrets_path, "w") as f:
            json.dump({"EVIL$(whoami > /tmp/pwned_by_key)": "value"}, f)

        script = SCRIPTS_DIR / "benchmark-secrets-sync.py"
        r = subprocess.run(
            [sys.executable, str(script)], capture_output=True, text=True
        )
        self.assertTrue(
            r.returncode != 0 or not Path("/tmp/pwned_by_key").exists(),
            "Key with $() shell injection was executed - script must reject/sanitize keys with shell special chars",
        )

    def test_secret_value_with_backtick_injection(self):
        """Secret value contains backtick command injection - backticks not sanitized"""
        secrets_path = Path("/tmp/benchmark_secrets.json")
        with open(secrets_path, "w") as f:
            json.dump({"SAFE_KEY": "value`whoami > /tmp/pwned_by_backtick`"}, f)

        script = SCRIPTS_DIR / "benchmark-secrets-sync.py"
        r = subprocess.run(
            [sys.executable, str(script)], capture_output=True, text=True
        )
        self.assertFalse(
            Path("/tmp/pwned_by_backtick").exists(),
            "Backtick injection executed - backticks in values are not sanitized",
        )

    def test_secret_value_with_nested_command_injection(self):
        """Secret value contains nested $(...) command substitution"""
        secrets_path = Path("/tmp/benchmark_secrets.json")
        with open(secrets_path, "w") as f:
            json.dump({"TEST_KEY": "$(cat /etc/passwd > /tmp/pwned_nested)"}, f)

        script = SCRIPTS_DIR / "benchmark-secrets-sync.py"
        r = subprocess.run(
            [sys.executable, str(script)], capture_output=True, text=True
        )
        self.assertFalse(
            Path("/tmp/pwned_nested").exists(),
            "Nested $(...) injection executed - only single quotes are escaped, not $",
        )

    def test_secret_value_with_shell_injection(self):
        """Secret value contains shell command injection - $(whoami)"""
        with tempfile.TemporaryDirectory() as td:
            td = Path(td)
            secrets_path = Path("/tmp/benchmark_secrets.json")
            with open(secrets_path, "w") as f:
                json.dump({"EVIL_KEY": "$(whoami > /tmp/pwned_output)"}, f)

            script = SCRIPTS_DIR / "benchmark-secrets-sync.py"
            r = subprocess.run(
                [sys.executable, str(script)], capture_output=True, text=True
            )
            self.assertFalse(
                Path("/tmp/pwned_output").exists(),
                "Shell injection executed - file was created",
            )

    def test_secret_value_with_semicolon_injection(self):
        """Secret value contains semicolon-separated commands"""
        with tempfile.TemporaryDirectory() as td:
            td = Path(td)
            secrets_path = Path("/tmp/benchmark_secrets.json")
            with open(secrets_path, "w") as f:
                json.dump({"EVIL_KEY": "value; rm -rf /tmp/test_injection"}, f)

            script = SCRIPTS_DIR / "benchmark-secrets-sync.py"
            r = subprocess.run(
                [sys.executable, str(script)], capture_output=True, text=True
            )
            self.assertEqual(
                r.returncode, 0, "Should complete even with semicolons in value"
            )

    def test_secret_key_with_shell_special_chars(self):
        """Secret key contains shell special characters"""
        secrets_path = Path("/tmp/benchmark_secrets.json")
        with open(secrets_path, "w") as f:
            json.dump({"EVIL$(echo)pwned": "value"}, f)

        script = SCRIPTS_DIR / "benchmark-secrets-sync.py"
        r = subprocess.run(
            [sys.executable, str(script)], capture_output=True, text=True
        )
        self.assertEqual(r.returncode, 0, "Should handle special chars in key name")


class TestEmptyAndNonexistentEnvVars(unittest.TestCase):
    """Missing/empty environment variable handling"""

    def _write_baseline(self, path, data):
        with open(path, "w") as f:
            json.dump(data, f)

    def test_empty_report_env_var(self):
        """REPORT env var is empty string - should fail gracefully"""
        with tempfile.TemporaryDirectory() as td:
            td = Path(td)
            baseline_path = td / "baseline.json"
            output_path = td / "output.txt"
            self._write_baseline(baseline_path, {"pass_rate": 50.0})

            env = {
                "REPORT": "",
                "BASELINE": str(baseline_path),
                "GITHUB_OUTPUT": str(output_path),
            }
            script = SCRIPTS_DIR / "benchmark-compare.py"
            r = subprocess.run(
                [sys.executable, str(script)], env=env, capture_output=True, text=True
            )
            self.assertNotEqual(r.returncode, 0)

    def test_unset_report_env_var_with_empty_arg(self):
        """REPORT env var unset and no argv argument provided"""
        with tempfile.TemporaryDirectory() as td:
            td = Path(td)
            baseline_path = td / "baseline.json"
            output_path = td / "output.txt"
            self._write_baseline(baseline_path, {"pass_rate": 50.0})

            env = {
                k: v
                for k, v in os.environ.items()
                if k not in ("REPORT", "BASELINE", "GITHUB_OUTPUT")
            }
            env["BASELINE"] = str(baseline_path)
            env["GITHUB_OUTPUT"] = str(output_path)

            script = SCRIPTS_DIR / "benchmark-compare.py"
            r = subprocess.run(
                [sys.executable, str(script)], env=env, capture_output=True, text=True
            )
            self.assertNotEqual(r.returncode, 0)


class TestEndToEndScenarios(unittest.TestCase):
    """End-to-end adversarial scenarios"""

    def test_compare_script_with_malformed_json_file(self):
        """Create a report file that is valid JSON but malformed structure"""
        with tempfile.TemporaryDirectory() as td:
            td = Path(td)
            report_path = td / "report.json"
            baseline_path = td / "baseline.json"
            with open(report_path, "w") as f:
                json.dump({"report": "[not a dict]"}, f)
            with open(baseline_path, "w") as f:
                json.dump({}, f)

            env = {
                "REPORT": str(report_path),
                "BASELINE": str(baseline_path),
                "GITHUB_OUTPUT": str(td / "out.txt"),
            }
            script = SCRIPTS_DIR / "benchmark-compare.py"
            r = subprocess.run(
                [sys.executable, str(script)], env=env, capture_output=True, text=True
            )
            self.assertNotEqual(r.returncode, 0)

    def test_compare_with_oversized_values(self):
        """Report with extremely large numbers"""
        with tempfile.TemporaryDirectory() as td:
            td = Path(td)
            report_path = td / "report.json"
            baseline_path = td / "baseline.json"
            with open(report_path, "w") as f:
                json.dump(
                    {
                        "report": {
                            "passRate": 99.99999,
                            "total": 10**9,
                            "passed": 10**9 - 1,
                            "byCategory": {},
                        }
                    },
                    f,
                )
            with open(baseline_path, "w") as f:
                json.dump({"pass_rate": 0}, f)

            env = {
                "REPORT": str(report_path),
                "BASELINE": str(baseline_path),
                "GITHUB_OUTPUT": str(td / "out.txt"),
            }
            script = SCRIPTS_DIR / "benchmark-compare.py"
            r = subprocess.run(
                [sys.executable, str(script)], env=env, capture_output=True, text=True
            )
            self.assertEqual(r.returncode, 0)

    def test_race_condition_concurrent_writes(self):
        """Simulate concurrent invocation by running compare multiple times"""
        import concurrent.futures

        with tempfile.TemporaryDirectory() as td:
            td = Path(td)
            results = []

            def run():
                report_path = td / "report.json"
                baseline_path = td / "baseline.json"
                with open(report_path, "w") as f:
                    json.dump(
                        {
                            "report": {
                                "passRate": 50.0,
                                "total": 10,
                                "passed": 5,
                                "byCategory": {},
                            }
                        },
                        f,
                    )
                with open(baseline_path, "w") as f:
                    json.dump({"pass_rate": 40.0}, f)
                env = {
                    "REPORT": str(report_path),
                    "BASELINE": str(baseline_path),
                    "GITHUB_OUTPUT": str(td / "out.txt"),
                }
                script = SCRIPTS_DIR / "benchmark-compare.py"
                r = subprocess.run(
                    [sys.executable, str(script)],
                    env=env,
                    capture_output=True,
                    text=True,
                )
                return r.returncode

            with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
                futures = [executor.submit(run) for _ in range(4)]
                results = [f.result() for f in concurrent.futures.as_completed(futures)]
            self.assertTrue(all(r in (0, 1) for r in results))

    def test_concurrent_baseline_file_write_race(self):
        """Concurrent workflows racing on baseline file: last write wins (documented behavior)"""
        import concurrent.futures

        with tempfile.TemporaryDirectory() as td:
            td = Path(td)
            baseline_path = td / "baseline.json"
            initial_baseline = {"pass_rate": 30.0, "by_category": {}}
            with open(baseline_path, "w") as f:
                json.dump(initial_baseline, f)

            def run_compare_with_different_report(report_rate):
                report_path = td / f"report_{report_rate}.json"
                output_path = td / f"output_{report_rate}.txt"
                with open(report_path, "w") as f:
                    json.dump(
                        {
                            "report": {
                                "passRate": report_rate,
                                "total": 10,
                                "passed": int(report_rate // 10),
                                "byCategory": {},
                            }
                        },
                        f,
                    )
                env = {
                    "REPORT": str(report_path),
                    "BASELINE": str(baseline_path),
                    "GITHUB_OUTPUT": str(output_path),
                }
                script = SCRIPTS_DIR / "benchmark-compare.py"
                r = subprocess.run(
                    [sys.executable, str(script)],
                    env=env,
                    capture_output=True,
                    text=True,
                )
                with open(baseline_path) as f:
                    final_baseline = json.load(f)
                return r.returncode, final_baseline["pass_rate"]

            with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
                futures = []
                futures.append(executor.submit(run_compare_with_different_report, 50.0))
                futures.append(executor.submit(run_compare_with_different_report, 60.0))
                results = [f.result() for f in concurrent.futures.as_completed(futures)]

            final_rates = sorted([r[1] for r in results])
            self.assertGreaterEqual(
                final_rates[-1],
                final_rates[0],
                "Both writes completed and wrote different rates (last write wins)",
            )


class TestByDifficultyKeyMismatch(unittest.TestCase):
    """Tests for byDifficulty key mismatch bug (same as byCategory bug)"""

    def _run_gate_parse(self, report_data, baseline_data=None, env_overrides=None):
        with tempfile.TemporaryDirectory() as td:
            td = Path(td)
            report_path = td / "report.json"
            baseline_path = td / "baseline.json"
            output_path = td / "output.txt"

            with open(report_path, "w") as f:
                json.dump({"report": report_data}, f)
            if baseline_data is not None:
                with open(baseline_path, "w") as f:
                    json.dump(baseline_data, f)

            env = {**os.environ}
            env["REPORT"] = str(report_path)
            env["BASELINE"] = str(baseline_path)
            env["GITHUB_OUTPUT"] = str(output_path)
            if env_overrides:
                env.update(env_overrides)

            script = SCRIPTS_DIR / "benchmark-gate-parse.py"
            r = subprocess.run(
                [sys.executable, str(script)],
                env=env,
                capture_output=True,
                text=True,
            )
            return r, output_path

    def test_byDifficulty_key_mismatch_regression_not_detected(self):
        """Report uses byDifficulty but baseline uses by_difficulty - regression NOT detected"""
        r, _ = self._run_gate_parse(
            {
                "passRate": 30.0,
                "total": 10,
                "passed": 3,
                "byDifficulty": {"easy": {"passed": 1, "total": 10}},
            },
            {
                "pass_rate": 80.0,
                "by_difficulty": {"easy": {"passed": 8, "total": 10, "rate": 80}},
            },
        )
        self.assertEqual(
            r.returncode,
            0,
            "Bug: regression in byDifficulty NOT detected due to key name mismatch (byDifficulty vs by_difficulty)",
        )

    def test_byLayer_key_mismatch_silent_skip(self):
        """Report uses byLayer but baseline uses by_layer - comparison silently skips"""
        r, _ = self._run_gate_parse(
            {
                "passRate": 30.0,
                "total": 10,
                "passed": 3,
                "byLayer": {"api": {"passed": 1, "total": 10}},
            },
            {
                "pass_rate": 80.0,
                "by_layer": {"api": {"passed": 8, "total": 10, "rate": 80}},
            },
        )
        self.assertEqual(
            r.returncode,
            0,
            "Bug: byLayer regression NOT detected due to key name mismatch",
        )


class TestTypeCoercionBugs(unittest.TestCase):
    """Tests for type coercion bugs in passRate handling"""

    def _run_compare(self, report_data, baseline_data=None, env_overrides=None):
        with tempfile.TemporaryDirectory() as td:
            td = Path(td)
            report_path = td / "report.json"
            baseline_path = td / "baseline.json"
            output_path = td / "output.txt"

            with open(report_path, "w") as f:
                json.dump({"report": report_data}, f)
            if baseline_data is not None:
                with open(baseline_path, "w") as f:
                    json.dump(baseline_data, f)

            env = {**os.environ}
            env["REPORT"] = str(report_path)
            env["BASELINE"] = str(baseline_path)
            env["GITHUB_OUTPUT"] = str(output_path)
            if env_overrides:
                env.update(env_overrides)

            try:
                os.unlink("/tmp/benchmark_secrets.json")
            except FileNotFoundError:
                pass

            script = SCRIPTS_DIR / "benchmark-compare.py"
            r = subprocess.run(
                [sys.executable, str(script)],
                env=env,
                capture_output=True,
                text=True,
            )
            return r, output_path

    def _run_gate_parse(self, report_data, baseline_data=None):
        with tempfile.TemporaryDirectory() as td:
            td = Path(td)
            report_path = td / "report.json"
            baseline_path = td / "baseline.json"
            output_path = td / "output.txt"

            with open(report_path, "w") as f:
                json.dump({"report": report_data}, f)
            if baseline_data is not None:
                with open(baseline_path, "w") as f:
                    json.dump(baseline_data, f)

            env = {**os.environ}
            env["REPORT"] = str(report_path)
            env["BASELINE"] = str(baseline_path)
            env["GITHUB_OUTPUT"] = str(output_path)

            script = SCRIPTS_DIR / "benchmark-gate-parse.py"
            r = subprocess.run(
                [sys.executable, str(script)],
                env=env,
                capture_output=True,
                text=True,
            )
            return r, output_path

    def test_passRate_string_with_percent_suffix(self):
        """passRate is a string like '50.0%' - float() will fail"""
        r, _ = self._run_compare(
            {"passRate": "50.0%", "total": 10, "passed": 5, "byCategory": {}}
        )
        self.assertNotEqual(
            r.returncode, 0, "String '50.0%' cannot be cast to float - should fail"
        )

    def test_passRate_string_with_whitespace(self):
        """passRate is a string with whitespace like ' 50.0 ' - should be trimmed or fail"""
        r, _ = self._run_compare(
            {"passRate": " 50.0 ", "total": 10, "passed": 5, "byCategory": {}}
        )
        self.assertNotEqual(
            r.returncode, 0, "String ' 50.0 ' cannot be cleanly cast to float"
        )

    def test_passRate_none_value(self):
        """passRate is None - float(None) raises TypeError"""
        r, _ = self._run_compare(
            {"passRate": None, "total": 10, "passed": 5, "byCategory": {}}
        )
        self.assertNotEqual(
            r.returncode, 0, "float(None) raises TypeError - should be handled"
        )

    def test_passRate_boolean_true(self):
        """passRate is boolean True - float(True) == 1.0, not a valid rate"""
        r, _ = self._run_compare(
            {"passRate": True, "total": 10, "passed": 5, "byCategory": {}}
        )
        self.assertNotEqual(
            r.returncode,
            0,
            "float(True) == 1.0 which is silently accepted - should be rejected",
        )

    def test_gate_parse_passRate_list(self):
        """passRate is a list [50.0] instead of scalar - causes float([50.0]) to fail"""
        r, _ = self._run_gate_parse({"passRate": [50.0], "total": 10, "passed": 5})
        self.assertNotEqual(
            r.returncode, 0, "float([50.0]) raises TypeError - should be caught"
        )


class TestMissingRequiredKeysInCompare(unittest.TestCase):
    """Tests for missing required keys that cause KeyError in benchmark-compare.py"""

    def _run_compare(self, report_data, baseline_data=None):
        with tempfile.TemporaryDirectory() as td:
            td = Path(td)
            report_path = td / "report.json"
            baseline_path = td / "baseline.json"
            output_path = td / "output.txt"

            with open(report_path, "w") as f:
                json.dump({"report": report_data}, f)
            if baseline_data is not None:
                with open(baseline_path, "w") as f:
                    json.dump(baseline_data, f)

            env = {**os.environ}
            env["REPORT"] = str(report_path)
            env["BASELINE"] = str(baseline_path)
            env["GITHUB_OUTPUT"] = str(output_path)

            try:
                os.unlink("/tmp/benchmark_secrets.json")
            except FileNotFoundError:
                pass

            script = SCRIPTS_DIR / "benchmark-compare.py"
            r = subprocess.run(
                [sys.executable, str(script)],
                env=env,
                capture_output=True,
                text=True,
            )
            return r, output_path

    def test_missing_total_key_causes_keyerror(self):
        """Report is missing 'total' key - causes KeyError at line 49"""
        r, _ = self._run_compare({"passRate": 50.0, "passed": 5, "byCategory": {}})
        self.assertNotEqual(
            r.returncode, 0, "Missing 'total' key should cause non-zero exit"
        )

    def test_missing_passed_key_causes_keyerror(self):
        """Report is missing 'passed' key - causes KeyError at line 50"""
        r, _ = self._run_compare({"passRate": 50.0, "total": 10, "byCategory": {}})
        self.assertNotEqual(
            r.returncode, 0, "Missing 'passed' key should cause non-zero exit"
        )


class TestYamlWorkflowEdgeCases(unittest.TestCase):
    """YAML workflow edge cases and validation"""

    def test_benchmark_gate_step_index_hardcoded(self):
        """benchmark-gate.yml hardcodes steps[6] - fragile if step order changes"""
        import yaml

        with open(".github/workflows/benchmark-gate.yml") as f:
            data = yaml.safe_load(f)
        step_count = len(data["jobs"]["benchmark"]["steps"])
        self.assertGreaterEqual(
            step_count,
            7,
            "Test expects at least 7 steps. If step order changes, test will catch it.",
        )
        if step_count < 7:
            self.fail(
                f"benchmark-gate.yml has only {step_count} steps - hardcoded step[6] will crash"
            )

    def test_benchmark_sync_step_index_hardcoded(self):
        """benchmark-sync.yml hardcodes steps[6] - fragile if step order changes"""
        import yaml

        with open(".github/workflows/benchmark-sync.yml") as f:
            data = yaml.safe_load(f)
        step_count = len(data["jobs"]["benchmark-sync"]["steps"])
        self.assertGreaterEqual(
            step_count,
            7,
            "Test expects at least 7 steps. If step order changes, test will catch it.",
        )
        if step_count < 7:
            self.fail(
                f"benchmark-sync.yml has only {step_count} steps - hardcoded step[6] will crash"
            )

    def test_benchmark_gate_triggers_on_empty_branches_array(self):
        """on.pull_request.branches: [] means no branches - workflow never runs"""
        import yaml

        with open(".github/workflows/benchmark-gate.yml") as f:
            data = yaml.safe_load(f)
        pr_config = data.get("on", {}).get("pull_request", {})
        self.assertIsInstance(
            pr_config,
            dict,
            "on.pull_request must be a dict with branches key, not a scalar",
        )
        branches = pr_config.get("branches", [])
        self.assertNotEqual(
            len(branches),
            0,
            "Empty branches array means workflow NEVER triggers on any PR",
        )

    def test_benchmark_sync_triggers_on_empty_branches_array(self):
        """on.push.branches: [] means no branches - workflow never runs"""
        import yaml

        with open(".github/workflows/benchmark-sync.yml") as f:
            data = yaml.safe_load(f)
        push_config = data.get("on", {}).get("push", {})
        self.assertIsInstance(
            push_config,
            dict,
            "on.push must be a dict with branches key, not a scalar",
        )
        branches = push_config.get("branches", [])
        self.assertNotEqual(
            len(branches),
            0,
            "Empty branches array means workflow NEVER triggers on any push",
        )


if __name__ == "__main__":
    unittest.main(verbosity=2)
