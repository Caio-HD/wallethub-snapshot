"""Banner de abertura da CLI WalletHub"""

from datetime import datetime
from pathlib import Path
from typing import Optional


_ASCII_LOGO = r"""
 __          __   _ _      _   _    _       _
 \ \        / /  | | |    | | | |  | |     | |
  \ \  /\  / /_ _| | | ___| |_| |__| |_   _| |__
   \ \/  \/ / _` | | |/ _ \ __|  __  | | | | '_ \
    \  /\  / (_| | | |  __/ |_| |  | | |_| | |_) |
     \/  \/ \__,_|_|_|\___|\__|_|  |_|\__,_|_.__/
___________________________________________________________________________
"""


_ASCII_LOGO_COMPACT = "  💰 WalletHub CLI"

_TIPS = [
    "Use 'Iniciar stack local' para subir o ambiente de desenvolvimento.",
    "Os diagnósticos rodam automaticamente após iniciar a stack.",
    "O backup de produção inclui timestamp para fácil versionamento.",
    "Rotacionar secrets JWT invalida tokens activos — use com cautela.",
    "Resetar a stack remove TODOS os volumes — dados locais serão perdidos.",
    "O deploy executa: backup → CI → release → deploy → migrações.",
    "Verifique o status dos serviços no dashboard antes de iniciar workflows.",
    "Use Ctrl+C a qualquer momento para cancelar uma operação em curso.",
]


def padded_ascii_logo_lines() -> list[str]:
    """
    Linhas do logo ASCII com a mesma largura (padding à direita).

    Rich Align.center centra cada linha do Text em relação ao terminal; se as
    linhas têm larguras diferentes, o desenho deixa de alinhar. Uniformizar a
    largura preserva o bloco monoespaçado.
    """
    raw = _ASCII_LOGO.strip("\n").splitlines()
    if not raw:
        return []
    width = max(len(line) for line in raw)
    return [line.ljust(width) for line in raw]


def _get_tip_of_the_day() -> str:
    """Retorna dica rotativa baseada no dia do ano."""
    day_of_year = datetime.now().timetuple().tm_yday
    return _TIPS[day_of_year % len(_TIPS)]


def _read_version(project_root: Optional[Path] = None) -> str:
    """Lê versão do pyproject.toml ou retorna fallback."""
    try:
        if project_root:
            pyproject = project_root / "tools" / "cli-py" / "pyproject.toml"
        else:
            pyproject = Path(__file__).parent.parent.parent / "pyproject.toml"

        if pyproject.exists():
            content = pyproject.read_text(encoding="utf-8")
            for line in content.splitlines():
                line = line.strip()
                if line.startswith("version"):
                    # version = "1.2.3"
                    parts = line.split("=", 1)
                    if len(parts) == 2:
                        return parts[1].strip().strip('"').strip("'")
    except Exception:
        pass
    return "1.0.0"


def show_header_rich(
    project_root: Optional[Path] = None, env_name: str = "personal"
) -> None:
    """Banner descriptivo com gradiente e bloco ASCII alinhado."""
    import sys

    from rich.align import Align
    from rich.console import Console
    from rich.text import Text
    import shutil

    win = (100, 24)
    terminal_width = max(60, min(shutil.get_terminal_size(win).columns, 140))
    console = Console(
        width=terminal_width,
        force_terminal=sys.stdout.isatty(),
        legacy_windows=False,
    )

    now = datetime.now()
    version = _read_version(project_root)

    # Gradiente (largura uniforme para Align.center manter o desenho)
    logo_lines = padded_ascii_logo_lines()
    colors = [
        "bold cyan", "bold cyan", "bold blue", "bold blue", "bold magenta"
    ]
    logo_text = Text()
    for i, line in enumerate(logo_lines):
        color = colors[i % len(colors)]
        logo_text.append(line + "\n", style=color)

    # Linha de metadados
    meta = Text()
    meta.append("  v", style="dim")
    meta.append(version, style="bold white")
    meta.append("   •   ", style="dim")
    meta.append(
        now.strftime("%d/%m/%Y %H:%M"), style="bold yellow"
    )
    meta.append("   •   env: ", style="dim")
    env_style = "bold green" if env_name == "personal" else "bold red"
    meta.append(env_name, style=env_style)

    if project_root:
        meta.append("\n  ", style="dim")
        meta.append(str(project_root), style="dim cyan")

    # Dica do dia
    tip_text = Text()
    tip_text.append("  💡 ", style="yellow")
    tip_text.append(_get_tip_of_the_day(), style="dim italic")

    from rich.rule import Rule

    console.print()
    console.print(Align.center(logo_text))
    console.print(Align.center(meta))
    console.print()
    console.print(Rule(style="cyan dim"))
    console.print(tip_text)
    console.print(Rule(style="cyan dim"))
    console.print()

    try:
        console.file.flush()
    except (AttributeError, OSError):
        pass


def show_header_text(
    project_root: Optional[Path] = None, env_name: str = "personal"
) -> None:
    """Fallback textual do banner."""
    now = datetime.now()
    version = _read_version(project_root)
    print()
    print(_ASCII_LOGO_COMPACT)
    meta_text = (
        f"  v{version}  |  {now.strftime('%d/%m/%Y %H:%M')}  |  "
        f"env: {env_name}"
    )
    print(meta_text)
    if project_root:
        print(f"  {project_root}")
    print()
    print(f"  💡 {_get_tip_of_the_day()}")
    print()


def show_header(
    project_root: Optional[Path] = None, env_name: str = "personal"
) -> None:
    """Exibe banner de abertura (Rich se disponível, senão texto)."""
    try:
        import rich  # noqa: F401
        show_header_rich(project_root, env_name)
    except ImportError:
        show_header_text(project_root, env_name)
