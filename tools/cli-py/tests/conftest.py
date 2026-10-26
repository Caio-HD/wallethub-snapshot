"""Fixtures comuns para testes da CLI."""

import pytest


@pytest.fixture(autouse=True)
def clear_wallethub_skip_venv(monkeypatch: pytest.MonkeyPatch) -> None:
    """Evita que WALLETHUB_SKIP_VENV=1 no ambiente do utilizador faça falhar testes de bootstrap."""
    monkeypatch.delenv("WALLETHUB_SKIP_VENV", raising=False)
