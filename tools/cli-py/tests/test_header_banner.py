"""Testes do banner ASCII (largura uniforme para Rich)."""

from wallethub.menu.header import padded_ascii_logo_lines


def test_padded_ascii_logo_lines_uniform_width():
    lines = padded_ascii_logo_lines()
    assert len(lines) >= 4
    widths = {len(line) for line in lines}
    assert len(widths) == 1, f"todas as linhas devem ter a mesma largura: {widths!r}"
