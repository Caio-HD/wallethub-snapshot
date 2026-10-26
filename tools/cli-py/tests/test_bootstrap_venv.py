"""Testes para bootstrap do venv da CLI (stdlib + mocks)."""

import subprocess
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from wallethub import bootstrap_venv as bv


def test_skip_env_short_circuits(monkeypatch):
    monkeypatch.setenv(bv.SKIP_ENV, "1")
    with patch("wallethub.bootstrap_venv.subprocess.run") as run:
        bv.ensure_cli_venv_and_reexec(cli_py=Path("/nope"))
        run.assert_not_called()


def test_missing_pyproject_short_circuits(tmp_path):
    with patch("wallethub.bootstrap_venv.subprocess.run") as run:
        bv.ensure_cli_venv_and_reexec(cli_py=tmp_path)
        run.assert_not_called()


def test_already_in_cli_venv_no_subprocess(tmp_path, monkeypatch):
    (tmp_path / "pyproject.toml").write_text("x", encoding="utf-8")
    vpy = bv.venv_python_executable(tmp_path)
    vpy.parent.mkdir(parents=True, exist_ok=True)
    vpy.touch()
    monkeypatch.setattr(sys, "executable", str(vpy))
    with patch("wallethub.bootstrap_venv.subprocess.run") as run:
        bv.ensure_cli_venv_and_reexec(cli_py=tmp_path)
        run.assert_not_called()


def test_pip_install_and_reexec_when_venv_exists(tmp_path, monkeypatch):
    (tmp_path / "pyproject.toml").write_text("x", encoding="utf-8")
    monkeypatch.setattr(sys, "executable", "/usr/bin/python3")
    vdir = tmp_path / ".venv"
    vdir.mkdir()
    if sys.platform == "win32":
        vpy = tmp_path / ".venv" / "Scripts" / "python.exe"
    else:
        vpy = tmp_path / ".venv" / "bin" / "python"
    vpy.parent.mkdir(parents=True, exist_ok=True)
    vpy.write_text("", encoding="utf-8")
    with (
        patch("wallethub.bootstrap_venv.is_running_in_cli_venv", return_value=False),
        patch("wallethub.bootstrap_venv._run") as mock_run,
        patch("wallethub.bootstrap_venv._reexec_with_venv") as mock_reexec,
    ):
        bv.ensure_cli_venv_and_reexec(cli_py=tmp_path)
    assert mock_run.call_count == 2
    mock_reexec.assert_called_once()
    first_cmd = mock_run.call_args_list[0][0][0]
    second_cmd = mock_run.call_args_list[1][0][0]
    assert "setuptools" in first_cmd
    assert "wheel" in first_cmd
    assert "-e" in second_cmd


def test_reexec_windows_uses_subprocess(monkeypatch, tmp_path):
    monkeypatch.setattr(sys, "platform", "win32")
    script = tmp_path / "launch.py"
    script.write_text("", encoding="utf-8")
    monkeypatch.setattr(sys, "argv", [str(script), "extra"])
    vpy = tmp_path / "venv" / "Scripts" / "python.exe"
    vpy.parent.mkdir(parents=True, exist_ok=True)
    vpy.write_text("", encoding="utf-8")
    with patch("wallethub.bootstrap_venv.subprocess.run") as run:
        run.return_value = MagicMock(returncode=0)
        with pytest.raises(SystemExit) as exc:
            bv._reexec_with_venv(vpy)
        assert exc.value.code == 0
    run.assert_called_once()
    args = run.call_args[0][0]
    assert args[0] == str(vpy)
    assert args[1] == str(script.resolve())
    assert args[2] == "extra"


def test_reexec_unix_calls_execv(monkeypatch, tmp_path):
    monkeypatch.setattr(sys, "platform", "linux")
    script = tmp_path / "launch.py"
    script.write_text("", encoding="utf-8")
    monkeypatch.setattr(sys, "argv", [str(script), "a", "b"])
    vpy = tmp_path / ".venv" / "bin" / "python"
    vpy.parent.mkdir(parents=True, exist_ok=True)
    vpy.write_text("", encoding="utf-8")
    with patch("wallethub.bootstrap_venv.os.execv") as execv:
        bv._reexec_with_venv(vpy)
    execv.assert_called_once()
    call_args = execv.call_args[0]
    assert call_args[0] == str(vpy)
    assert call_args[1][0] == str(vpy)
    assert call_args[1][1] == str(script.resolve())
    assert list(call_args[1][2:]) == ["a", "b"]


def test_cli_py_dir_points_at_tools_cli_py():
    d = bv.cli_py_dir()
    assert (d / "pyproject.toml").is_file()


def test_run_raises_called_process_error_on_failure():
    with patch("wallethub.bootstrap_venv.subprocess.run") as run:
        run.return_value = MagicMock(returncode=1, stderr="e", stdout="")
        with pytest.raises(subprocess.CalledProcessError):
            bv._run(["false"], label="x")
