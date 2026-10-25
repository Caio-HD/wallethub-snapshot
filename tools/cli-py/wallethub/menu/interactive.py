"""Menu interativo com Questionary (com fallback textual)"""

import sys
import subprocess
import time

from wallethub.context import MenuContext
from wallethub.menu.sections import get_menu_sections, MenuSection, MenuItem


# ─── helpers ──────────────────────────────────────────────────────────────────

def _has_rich() -> bool:
    """Verifica se Rich está disponível (uma única fonte, sem dep do dashboard)."""
    try:
        import rich  # noqa: F401
        return True
    except ImportError:
        return False


class _QuestionaryUnavailableError(Exception):
    """Questionary retornou None (ex.: sem TTY); fallback para menu textual."""


def _is_terminal_related_error(e: BaseException) -> bool:
    """Indica se a exceção é de incompatibilidade de terminal/console."""
    if isinstance(e, AttributeError):
        return True
    msg = str(e).lower()
    return any(k in msg for k in ("console", "content", "vsplit", "terminal"))


def has_questionary() -> bool:
    """Verifica se Questionary está disponível"""
    try:
        import questionary
        return True
    except ImportError:
        return False


# ─── feedback pós-execução ────────────────────────────────────────────────────

def _show_result_rich(item_message: str, success: bool, duration: float, error: str = "") -> None:
    """Renderiza painel de resultado após execução de uma ação."""
    from rich.console import Console
    from rich.panel import Panel
    from rich.text import Text
    import shutil

    terminal_width = max(60, min(shutil.get_terminal_size((100, 24)).columns, 140))
    console = Console(width=terminal_width, force_terminal=False, legacy_windows=False)

    if success:
        icon = "✅"
        style = "bold green"
        status_label = "Concluído"
    else:
        icon = "❌"
        style = "bold red"
        status_label = "Falhou"

    content = Text()
    content.append(f"{icon}  {status_label}", style=style)
    content.append(f"\n\n  Ação:     ", style="dim")
    content.append(item_message, style="white")
    content.append(f"\n  Duração:  ", style="dim")

    mins = int(duration // 60)
    secs = duration % 60
    if mins > 0:
        dur_str = f"{mins}m {secs:.1f}s"
    else:
        dur_str = f"{secs:.2f}s"
    content.append(dur_str, style="yellow")

    if not success and error:
        content.append(f"\n\n  Erro:     ", style="bold red")
        # Truncar erros muito longos
        content.append(error[:120] + ("..." if len(error) > 120 else ""), style="red")

    border = "green" if success else "red"
    panel = Panel(
        content,
        title=f"[bold {border}]Resultado[/bold {border}]",
        border_style=border,
        padding=(1, 2),
    )
    console.print()
    console.print(panel)
    console.print()
    try:
        console.file.flush()
    except (AttributeError, OSError):
        pass


def _show_result_text(item_message: str, success: bool, duration: float, error: str = "") -> None:
    """Feedback textual de resultado (fallback)."""
    icon = "✅" if success else "❌"
    status = "Concluído" if success else "Falhou"
    mins = int(duration // 60)
    secs = duration % 60
    dur_str = f"{mins}m {secs:.1f}s" if mins > 0 else f"{secs:.2f}s"
    print(f"\n{icon} {status} — {item_message} ({dur_str})")
    if not success and error:
        print(f"   Erro: {error[:120]}")
    print()


def _show_result(item_message: str, success: bool, duration: float, error: str = "") -> None:
    """Exibe resultado da execução (Rich se disponível, senão texto)."""
    if _has_rich():
        _show_result_rich(item_message, success, duration, error)
    else:
        _show_result_text(item_message, success, duration, error)


# ─── confirmação de perigo ────────────────────────────────────────────────────

def _confirm_dangerous_rich(item_message: str) -> bool:
    """Exibe aviso de perigo e pede confirmação explícita."""
    from rich.console import Console
    from rich.panel import Panel
    from rich.text import Text
    import questionary
    import shutil

    terminal_width = max(60, min(shutil.get_terminal_size((100, 24)).columns, 140))
    console = Console(width=terminal_width, force_terminal=False, legacy_windows=False)

    content = Text()
    content.append("⚠️  AÇÃO DESTRUTIVA\n\n", style="bold red")
    content.append(f"  {item_message}\n\n", style="white")
    content.append("  Esta operação ", style="dim")
    content.append("NÃO pode ser desfeita", style="bold red")
    content.append(". Confirme antes de continuar.", style="dim")

    panel = Panel(content, border_style="red", padding=(1, 2))
    console.print()
    console.print(panel)

    answer = questionary.confirm(
        "Tem a certeza que deseja continuar?",
        default=False,
    ).ask()
    return bool(answer)


def _confirm_dangerous_text(item_message: str) -> bool:
    """Confirmação de perigo texto simples (fallback)."""
    print(f"\n⚠️  AÇÃO DESTRUTIVA: {item_message}")
    print("   Esta operação NÃO pode ser desfeita.")
    raw = input("   Tem a certeza? (sim/não) [não]: ").strip().lower()
    return raw in ("sim", "s", "yes", "y")


def _confirm_dangerous(item: MenuItem) -> bool:
    """Pede confirmação para acções destrutivas."""
    try:
        import questionary  # noqa: F401
        if _has_rich():
            return _confirm_dangerous_rich(item.message)
    except ImportError:
        pass
    return _confirm_dangerous_text(item)


# ─── execução de um item ──────────────────────────────────────────────────────

def _execute_item(item: MenuItem, menu_ctx: MenuContext, env_name: str) -> None:
    """Executa o item, exibindo feedback de resultado."""
    if item.dangerous and not _confirm_dangerous(item):
        print("\n⛔  Operação cancelada.")
        return

    start = time.monotonic()
    success = True
    error_msg = ""

    try:
        item.action(menu_ctx, env_name)
    except KeyboardInterrupt:
        success = False
        error_msg = "Cancelado pelo utilizador (Ctrl+C)"
        print("\n")
        raise
    except subprocess.CalledProcessError as e:
        success = False
        parts = [str(e)]
        if getattr(e, "stdout", None):
            parts.append(f"stdout: {e.stdout}")
        if getattr(e, "stderr", None):
            parts.append(f"stderr: {e.stderr}")
        if e.returncode is not None:
            parts.append(f"exit code: {e.returncode}")
        error_msg = " | ".join(parts)
    except Exception as e:
        success = False
        import traceback
        error_msg = str(e)
        tb = traceback.format_exc()
        if len(tb) < 2000:
            error_msg = tb

    duration = time.monotonic() - start
    _show_result(item.message, success, duration, error_msg)


# ─── cabeçalho de sessão ──────────────────────────────────────────────────────

def _render_session_header_rich(session_actions: int) -> None:
    """Renderiza contador de sessão acima do menu."""
    from rich.console import Console
    from rich.text import Text
    import shutil

    terminal_width = max(60, min(shutil.get_terminal_size((100, 24)).columns, 140))
    console = Console(width=terminal_width, force_terminal=False, legacy_windows=False)

    line = Text()
    line.append("  Sessão: ", style="dim")
    if session_actions == 0:
        line.append("nenhuma ação executada ainda", style="dim italic")
    else:
        line.append(str(session_actions), style="bold cyan")
        label = "ação executada" if session_actions == 1 else "ações executadas"
        line.append(f" {label} nesta sessão", style="dim")

    console.print(line)
    try:
        console.file.flush()
    except (AttributeError, OSError):
        pass


# ─── menu principal (Questionary) ────────────────────────────────────────────

def show_menu_rich(menu_ctx: MenuContext, env_name: str) -> None:
    """Mostra menu usando Questionary (se disponível)"""
    if not has_questionary():
        show_menu_text(menu_ctx, env_name)
        return

    import questionary

    try:
        sys.stdout.flush()
        sys.stderr.flush()
    except (AttributeError, OSError):
        pass

    sections = get_menu_sections()
    exit_value = "__exit__"
    back_value = "__back__"
    session_actions = 0

    keep_running = True
    while keep_running:
        if _has_rich():
            _render_session_header_rich(session_actions)

        # Escolha de seção
        section_choices = [
            questionary.Choice(
                title=f"{s.icon}  {s.message}",
                value=s.name,
            )
            for s in sections
        ] + [questionary.Choice(title="🚪  Sair", value=exit_value)]

        try:
            section_answer = questionary.select(
                "Categoria",
                choices=section_choices,
            ).ask()

            if section_answer is None:
                raise _QuestionaryUnavailableError()
            if section_answer == exit_value:
                print("\nAté a próxima! 👋")
                break

            selected_section = next(
                (s for s in sections if s.name == section_answer), None
            )
            if not selected_section:
                continue

            # Escolha de item dentro da seção
            item_choices = [
                questionary.Choice(
                    title=_format_item_choice(item),
                    value=item.name,
                )
                for item in selected_section.items
            ] + [questionary.Choice(title="↩  Voltar", value=back_value)]

            item_answer = questionary.select(
                f"{selected_section.icon}  {selected_section.message}",
                choices=item_choices,
            ).ask()

            if not item_answer or item_answer == back_value:
                continue

            selected_item = next(
                (item for item in selected_section.items if item.name == item_answer),
                None,
            )
            if not selected_item:
                continue

            try:
                _execute_item(selected_item, menu_ctx, env_name)
                session_actions += 1
            except KeyboardInterrupt:
                print("\n\n⚠️  Operação cancelada pelo utilizador.")

            # Continuar?
            again = questionary.confirm(
                "Deseja realizar outra ação?",
                default=True,
            ).ask()
            if not again:
                keep_running = False

        except KeyboardInterrupt:
            print("\n\nSaindo do menu.")
            break
        except Exception as e:
            if _is_terminal_related_error(e):
                raise
            print(f"\n❌ Erro no menu: {e}")
            break


def _format_item_choice(item: MenuItem) -> str:
    """Formata label do choice do Questionary com ícone + mensagem + descrição."""
    label = f"{item.icon}  {item.message}" if item.icon else item.message
    if item.dangerous:
        label += "  ⚠️"
    if item.description:
        # Questionary não suporta multiline nativo, mas podemos adicionar subtítulo
        label += f"\n     {item.description}"
    return label


# ─── menu fallback textual ────────────────────────────────────────────────────

def _render_menu_text_plain(
    flat: list[tuple[int, str, str, MenuItem]],
    hint_with_questionary: bool,
) -> None:
    """Renderiza menu em texto puro (fallback quando Rich não está disponível)."""
    print("\n💰 WalletHub CLI - Menu Interativo")
    print("=" * 50)
    if hint_with_questionary:
        print("\nDigite o número da opção e pressione Enter.")
    else:
        print("\nPara menu interativo com setas, instale: pip install questionary")
    print("\nOpções:")
    for num, section_icon, section_message, item in flat:
        icon_str = f"{item.icon} " if item.icon else ""
        danger = " ⚠️" if item.dangerous else ""
        print(f"   {num}. [{section_icon} {section_message}] {icon_str}{item.message}{danger}")
        if item.description:
            print(f"        {item.description}")
    print("   0. 🚪 Sair")
    print()


def _render_menu_text_rich(
    flat: list[tuple[int, str, str, MenuItem]],
    hint_with_questionary: bool,
    session_actions: int,
) -> None:
    """Renderiza menu com Rich (Panel + Table), alinhado ao dashboard."""
    from rich.console import Console
    from rich.panel import Panel
    from rich.table import Table
    from rich.text import Text
    import shutil

    terminal_width = max(60, min(shutil.get_terminal_size((100, 24)).columns, 140))
    console = Console(width=terminal_width, force_terminal=False, legacy_windows=False)

    table = Table(
        show_header=True,
        header_style="bold cyan",
        box=None,
        padding=(0, 1),
        show_edge=False,
        expand=False,
    )
    table.add_column("#", style="cyan", width=4, justify="right")
    table.add_column("Categoria", style="blue", width=16)
    table.add_column("Ação", style="white")

    table.add_row("0", "—", "🚪 Sair")
    for num, section_icon, section_message, item in flat:
        danger_tag = " [bold red]⚠️[/bold red]" if item.dangerous else ""
        icon_label = f"{item.icon} " if item.icon else ""
        action_text = Text.from_markup(f"{icon_label}{item.message}{danger_tag}")
        if item.description:
            desc = Text(f"\n  {item.description}", style="dim italic")
            from rich.text import Text as RText
            combined = RText()
            combined.append_text(action_text)
            combined.append_text(desc)
            action_text = combined
        table.add_row(str(num), f"{section_icon} {section_message}", action_text)

    session_line = Text()
    session_line.append("Sessão: ", style="dim")
    if session_actions == 0:
        session_line.append("nenhuma ação executada ainda", style="dim italic")
    else:
        session_line.append(str(session_actions), style="bold cyan")
        label = "ação" if session_actions == 1 else "ações"
        session_line.append(f" {label} executada(s)", style="dim")

    hint_str = (
        "Digite o número e pressione Enter."
        if hint_with_questionary
        else "Para menu interativo com setas: pip install questionary"
    )

    from rich.console import Group
    content = Group(
        session_line,
        Text(""),
        table,
        Text(""),
        Text(hint_str, style="dim"),
    )

    panel = Panel(
        content,
        title="[bold cyan]💰 WalletHub CLI — Menu[/bold cyan]",
        border_style="cyan",
        padding=(1, 2),
    )
    console.print(panel)
    try:
        console.file.flush()
    except (AttributeError, OSError):
        pass


def show_menu_text(menu_ctx: MenuContext, env_name: str) -> None:
    """Menu interativo em modo textual (fallback): lista numerada + input()."""
    sections = get_menu_sections()
    flat: list[tuple[int, str, str, MenuItem]] = []
    for section in sections:
        for item in section.items:
            flat.append((len(flat) + 1, section.icon, section.message, item))

    hint_with_questionary = has_questionary()
    session_actions = 0

    while True:
        if _has_rich():
            _render_menu_text_rich(flat, hint_with_questionary, session_actions)
        else:
            _render_menu_text_plain(flat, hint_with_questionary)

        try:
            raw = input("Escolha (número): ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\n\nSaindo do menu.")
            break

        if not raw:
            continue

        try:
            choice = int(raw)
        except ValueError:
            print("Opção inválida. Digite um número.")
            continue

        if choice == 0:
            print("\nAté a próxima! 👋")
            break

        chosen = next((t for t in flat if t[0] == choice), None)
        if not chosen:
            print("Opção inválida.")
            continue

        _, _, _, selected_item = chosen
        try:
            _execute_item(selected_item, menu_ctx, env_name)
            session_actions += 1
        except KeyboardInterrupt:
            print("\n\n⚠️  Operação cancelada pelo utilizador.")

        try:
            again = input("Deseja realizar outra ação? (s/n) [s]: ").strip().lower()
        except (EOFError, KeyboardInterrupt):
            print("\n\nSaindo do menu.")
            break
        if again and again not in ("s", "sim"):
            print("\nAté a próxima! 👋")
            break


# ─── entry point ──────────────────────────────────────────────────────────────

def run_interactive_menu(menu_ctx: MenuContext, env_name: str) -> None:
    """Executa menu interativo (tenta Questionary primeiro; fallback textual em None ou erro de terminal)."""
    try:
        sys.stdout.flush()
        sys.stderr.flush()
    except (AttributeError, OSError):
        pass

    if not has_questionary():
        from wallethub.utils.dependencies import ensure_python_dependency
        ensure_python_dependency("questionary")

    if not has_questionary():
        show_menu_text(menu_ctx, env_name)
        return

    try:
        show_menu_rich(menu_ctx, env_name)
    except _QuestionaryUnavailableError:
        show_menu_text(menu_ctx, env_name)
    except (AttributeError, Exception) as e:
        if not _is_terminal_related_error(e):
            raise
        try:
            show_menu_rich(menu_ctx, env_name)
        except _QuestionaryUnavailableError:
            show_menu_text(menu_ctx, env_name)
        except (AttributeError, Exception) as e2:
            if _is_terminal_related_error(e2):
                show_menu_text(menu_ctx, env_name)
            else:
                raise
