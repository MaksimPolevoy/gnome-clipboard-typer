from __future__ import annotations

import os
from pathlib import Path
import signal
import subprocess
import sys
import tempfile
import time
import unittest


ROOT = Path(__file__).resolve().parents[1]
HELPER = ROOT / "src" / "helper" / "clipboard-typer-helper"


class HelperTests(unittest.TestCase):
    def test_rejects_missing_display_without_echoing_input(self) -> None:
        env = os.environ.copy()
        env.pop("DISPLAY", None)
        env["XDG_SESSION_TYPE"] = "x11"
        secret = b"SECRET-MUST-NOT-APPEAR"
        result = subprocess.run(
            [sys.executable, str(HELPER), "--start-delay-ms", "0"],
            input=secret,
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=False,
        )
        self.assertEqual(result.returncode, 3)
        self.assertNotIn(secret, result.stdout + result.stderr)

    def test_stdin_is_literal_and_not_shell_code(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            temp = Path(directory)
            captured = temp / "captured"
            args_file = temp / "args"
            marker = temp / "must-not-exist"
            fake = temp / "xdotool"
            fake.write_text(
                "#!/bin/sh\nprintf '%s\\n' \"$@\" > \"$ARGS_FILE\"\ncat > \"$CAPTURED_FILE\"\n",
                encoding="utf-8",
            )
            fake.chmod(0o755)
            text = f"Русский ; $(touch {marker}) ' \\nline2 ✓".encode()
            env = os.environ.copy()
            env.update({
                "PATH": f"{temp}:{env.get('PATH', '')}",
                "DISPLAY": ":99",
                "XDG_SESSION_TYPE": "x11",
                "CAPTURED_FILE": str(captured),
                "ARGS_FILE": str(args_file),
            })
            result = subprocess.run(
                [sys.executable, str(HELPER), "--start-delay-ms", "0", "--key-delay-ms", "50"],
                input=text,
                env=env,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                check=False,
            )
            self.assertEqual(result.returncode, 0, result.stderr.decode())
            self.assertEqual(captured.read_bytes(), text)
            self.assertFalse(marker.exists())
            self.assertEqual(args_file.read_text().splitlines(), ["type", "--clearmodifiers", "--delay", "50", "--file", "-"])

    def test_cancel_during_start_delay(self) -> None:
        env = os.environ.copy()
        env.update({"DISPLAY": ":99", "XDG_SESSION_TYPE": "x11"})
        process = subprocess.Popen(
            [sys.executable, str(HELPER), "--start-delay-ms", "10000"],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            env=env,
        )
        assert process.stdin is not None
        process.stdin.write(b"not typed")
        process.stdin.close()
        process.stdin = None
        # Allow the interpreter to install its SIGTERM handler before signalling.
        time.sleep(1.0)
        process.send_signal(signal.SIGTERM)
        _stdout, _stderr = process.communicate(timeout=2)
        self.assertEqual(process.returncode, 130)

    def test_invalid_utf8_is_rejected(self) -> None:
        env = os.environ.copy()
        env.update({"DISPLAY": ":99", "XDG_SESSION_TYPE": "x11"})
        result = subprocess.run(
            [sys.executable, str(HELPER), "--start-delay-ms", "0"],
            input=b"\xff",
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=False,
        )
        self.assertEqual(result.returncode, 2)


if __name__ == "__main__":
    unittest.main()
