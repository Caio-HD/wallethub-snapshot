#!/usr/bin/env python3
"""
Launcher da CLI WalletHub. Executa a CLI a partir da raiz do repositório sem instalação prévia.
Uso: python wallethub.py [args]  (qualquer SO)
"""

import sys
from pathlib import Path

# Raiz do repositório (diretório onde este script está)
_REPO_ROOT = Path(__file__).resolve().parent
_CLI_PY_PATH = _REPO_ROOT / "tools" / "cli-py"
_MAIN_PY = _CLI_PY_PATH / "wallethub" / "main.py"

if not _CLI_PY_PATH.is_dir():
    print(f"Erro: Diretório tools/cli-py não encontrado em {_REPO_ROOT}", file=sys.stderr)
    sys.exit(1)

if not _MAIN_PY.is_file():
    print(f"Erro: Arquivo tools/cli-py/wallethub/main.py não encontrado", file=sys.stderr)
    sys.exit(1)

# Inserir tools/cli-py no início do path para importar o pacote wallethub
sys.path.insert(0, str(_CLI_PY_PATH))

# PEP 668 (Ubuntu/Debian): criar tools/cli-py/.venv e reexecutar com esse Python
from wallethub.bootstrap_venv import ensure_cli_venv_and_reexec

ensure_cli_venv_and_reexec()

# --- Verificação de Versão do Python ---
v = sys.version_info
if v.major == 3 and v.minor >= 14:
    print(f"\n⚠️  ATENÇÃO: Você está usando o Python {v.major}.{v.minor} ({sys.executable})", file=sys.stderr)
    print("   Esta é uma versão EXPERIMENTAL/ALPHA que causa instabilidades (como o erro 'Unable to handle').", file=sys.stderr)
    print("   RECOMENDAÇÃO: Use o Python 3.13 ou 3.12 (Estável).", file=sys.stderr)
    print("   Com 'uv', instale: uv python install 3.13", file=sys.stderr)
    print("   Para rodar: uv run --python 3.13 python wallethub.py\n", file=sys.stderr)
# --------------------------------------

try:
    from wallethub.main import main
    sys.exit(main())
except Exception as e:
    print(f"Erro ao executar a CLI: {e}", file=sys.stderr)
    sys.exit(1)
