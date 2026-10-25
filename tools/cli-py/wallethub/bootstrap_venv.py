"""
Bootstrap do venv dedicado em tools/cli-py/.venv.

Evita PEP 668 (externally-managed-environment) ao instalar dependências com o pip
do venv em vez do Python do sistema. Usa apenas a biblioteca padrão.
"""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

SKIP_ENV = "WALLETHUB_SKIP_VENV"


def cli_py_dir() -> Path:
    """Diretório tools/cli-py (pai do pacote wallethub)."""
    return Path(__file__).resolve().parent.parent


def venv_dir(cli_py: Path | None = None) -> Path:
    root = cli_py if cli_py is not None else cli_py_dir()
    return root / ".venv"


def venv_python_executable(cli_py: Path | None = None) -> Path:
    root = cli_py if cli_py is not None else cli_py_dir()
    if sys.platform == "win32":
        return root / ".venv" / "Scripts" / "python.exe"
    return root / ".venv" / "bin" / "python"


def is_running_in_cli_venv(cli_py: Path | None = None) -> bool:
    """True se o interpretador atual é o Python do venv da CLI."""
    target = venv_python_executable(cli_py)
    try:
        return Path(sys.executable).resolve() == target.resolve()
    except OSError:
        return False


def _run(cmd: list[str], *, label: str) -> None:
    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        timeout=600,
    )
    if result.returncode != 0:
        err = (result.stderr or result.stdout or "").strip()
        print(f"[ERRO] {label} falhou (código {result.returncode}).", file=sys.stderr)
        if err:
            print(err, file=sys.stderr)
        raise subprocess.CalledProcessError(result.returncode, cmd, result.stdout, result.stderr)


def _reexec_with_venv(venv_python: Path) -> None:
    """Substitui o processo (Unix) ou delega e termina (Windows)."""
    if not sys.argv:
        sys.exit(2)
    script = Path(sys.argv[0]).resolve()
    args = [str(venv_python), str(script), *sys.argv[1:]]

    if sys.platform == "win32":
        result = subprocess.run(args)
        raise SystemExit(result.returncode)

    os.execv(str(venv_python), args)


def ensure_cli_venv_and_reexec(cli_py: Path | None = None) -> None:
    """
    Garante .venv em tools/cli-py, instala o pacote em modo editável e reexecuta
    com o Python do venv quando o interpretador atual não é o do venv.

    Sem efeito se WALLETHUB_SKIP_VENV estiver definido (não vazio) ou se
    pyproject.toml não existir em tools/cli-py.
    """
    if os.environ.get(SKIP_ENV, "").strip():
        return

    root = cli_py if cli_py is not None else cli_py_dir()
    if not (root / "pyproject.toml").is_file():
        return

    vpy = venv_python_executable(root)
    if is_running_in_cli_venv(root):
        return

    vdir = venv_dir(root)
    if not vdir.is_dir():
        print(f"[venv] Criando ambiente virtual em {vdir} ...", flush=True)
        _run(
            [sys.executable, "-m", "venv", str(vdir)],
            label="python -m venv",
        )

    if not vpy.is_file():
        print(
            f"[ERRO] Python do venv não encontrado em {vpy}.",
            file=sys.stderr,
        )
        raise SystemExit(1)

    # setuptools>=68 evita pkgutil.ImpImporter (removido no Python 3.12+) em pkg_resources
    print(
        "[venv] Atualizando pip, setuptools e wheel; a seguir wallethub-cli (editable) ...",
        flush=True,
    )
    _run(
        [str(vpy), "-m", "pip", "install", "--upgrade", "pip", "setuptools", "wheel"],
        label="pip install --upgrade pip setuptools wheel",
    )
    _run(
        [str(vpy), "-m", "pip", "install", "-e", str(root)],
        label="pip install -e tools/cli-py",
    )

    print("[venv] Reiniciando com o Python do venv ...", flush=True)
    _reexec_with_venv(vpy)
