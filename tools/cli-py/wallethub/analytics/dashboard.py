"""Dashboard com Rich Tables e Panels"""

import shutil
from datetime import datetime, timezone
from typing import Optional, List, Tuple
from wallethub.context import MenuContext
from wallethub.analytics.tracker import get_tracker
from wallethub.workflows.helpers import is_container_running, resolve_compose_context

try:
    import requests
except ImportError:
    requests = None


# ─── utilitários ──────────────────────────────────────────────────────────────

def format_duration(seconds: float) -> str:
    """Formata duração em segundos para formato legível."""
    if seconds < 60:
        return f"{seconds:.2f}s"
    elif seconds < 3600:
        minutes = int(seconds // 60)
        secs = seconds % 60
        if secs < 1:
            return f"{minutes}m"
        return f"{minutes}m {secs:.1f}s"
    else:
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        if minutes == 0:
            return f"{hours}h"
        return f"{hours}h {minutes}m"


def get_trend_indicator(change: float, reverse: bool = False) -> str:
    """Retorna indicador visual de tendência."""
    if abs(change) < 0.1:
        return "→"
    is_positive = change > 0
    if reverse:
        is_positive = not is_positive
    return "↑" if is_positive else "↓"


def has_rich() -> bool:
    """Verifica se Rich está disponível"""
    try:
        import rich  # noqa: F401
        return True
    except ImportError:
        return False


def _sparkline(values: list[float]) -> str:
    """Gera mini sparkline com blocos Unicode a partir de valores 0–100."""
    blocks = "▁▂▃▄▅▆▇█"
    result = []
    for v in values:
        v = max(0.0, min(100.0, v))
        idx = int(v / 100 * (len(blocks) - 1))
        result.append(blocks[idx])
    return "".join(result)


def _hourly_success_rates(tracker) -> list[float]:
    """Calcula taxa de sucesso por hora das últimas 24 h (lista de 24 valores 0-100)."""
    from collections import defaultdict

    hourly: dict[int, list[bool]] = defaultdict(list)
    recent = tracker.get_recent_commands(limit=500)
    now = datetime.now()

    for entry in recent:
        ts_str = entry.get("timestamp", "")
        try:
            ts_clean = ts_str.split('+')[0].split('Z')[0]
            ts = datetime.fromisoformat(ts_clean)
            hour_offset = int((now - ts).total_seconds() // 3600)
            if 0 <= hour_offset < 24:
                hourly[23 - hour_offset].append(entry.get("success", False))
        except Exception:
            pass

    result = []
    for h in range(24):
        entries = hourly.get(h, [])
        if entries:
            rate = sum(1 for s in entries if s) / len(entries) * 100
        else:
            rate = -1.0  # sem dados
    result = [
        (sum(1 for s in hourly[h] if s) / len(hourly[h]) * 100) if hourly.get(h) else 0.0
        for h in range(24)
    ]
    return result


# ─── status dos serviços ──────────────────────────────────────────────────────

def _check_docker_status() -> bool:
    """Verifica se Docker está rodando"""
    try:
        from wallethub.utils.tools import check_docker
        installed, _ = check_docker()
        return installed
    except Exception:
        return False


def _check_service_status(
    menu_ctx: MenuContext,
    service_name: str,
    port_env_var: str,
    default_port: str,
    docker_available: Optional[bool] = None,
) -> tuple[str, str, str]:
    """
    Verifica status de um serviço.

    Returns:
        Tupla (rich_markup_status, porta, estado_raw)
        estado_raw: "healthy" | "running" | "stopped" | "error"
    """
    try:
        compose = resolve_compose_context(menu_ctx, "personal")
        porta = compose["docker_env"].get(port_env_var, default_port)
        if docker_available is False:
            return ("⚠️  Parado", porta, "stopped")
        status = is_container_running(
            menu_ctx,
            compose["compose_relative"],
            service_name,
            compose["docker_env"],
        )
        if status.get("running"):
            health = status.get("health", "").lower()
            if health == "healthy":
                return ("✅ Running", porta, "healthy")
            if service_name == "api" and requests is not None and health in ("starting", "unhealthy"):
                try:
                    r = requests.get(f"http://127.0.0.1:{porta}/api/health", timeout=2)
                    if r.status_code == 200:
                        return ("✅ Running", porta, "healthy")
                except Exception:
                    pass
            if health:
                return (f"⚡ {health.capitalize()}", porta, "running")
            return ("✅ Running", porta, "running")
        return ("⚠️  Parado", porta, "stopped")
    except FileNotFoundError:
        return ("❌ Não encontrado", "N/A", "error")
    except Exception:
        return ("⚠️  Erro", "N/A", "error")


def _service_status_style(raw: str) -> str:
    """Retorna estilo Rich baseado no estado raw."""
    return {
        "healthy": "bold green",
        "running": "bold yellow",
        "stopped": "dim yellow",
        "error": "bold red",
    }.get(raw, "white")


def _check_postgres_status(menu_ctx: MenuContext, docker_available: Optional[bool] = None):
    return _check_service_status(menu_ctx, "postgres", "WALLETHUB_POSTGRES_PORT", "30332", docker_available)


def _check_redis_status(menu_ctx: MenuContext, docker_available: Optional[bool] = None):
    return _check_service_status(menu_ctx, "redis", "WALLETHUB_REDIS_PORT", "30379", docker_available)


def _check_adminer_status(menu_ctx: MenuContext, docker_available: Optional[bool] = None):
    return _check_service_status(menu_ctx, "adminer", "WALLETHUB_ADMINER_PORT", "30380", docker_available)


def _check_api_status(menu_ctx: MenuContext, docker_available: Optional[bool] = None):
    return _check_service_status(menu_ctx, "api", "WALLETHUB_API_PORT", "3031", docker_available)


def _check_web_status(menu_ctx: MenuContext, docker_available: Optional[bool] = None):
    return _check_service_status(menu_ctx, "web", "WALLETHUB_WEB_PORT", "3030", docker_available)


def _check_traefik_status(menu_ctx: MenuContext, docker_available: Optional[bool] = None):
    return _check_service_status(menu_ctx, "traefik", "WALLETHUB_TRAEFIK_DASHBOARD_PORT", "30399", docker_available)


# ─── info do sistema ──────────────────────────────────────────────────────────

def _get_system_info() -> Optional[dict]:
    """Tenta obter info do sistema via psutil (retorna None se não disponível)."""
    try:
        import psutil
        cpu = psutil.cpu_percent(interval=0.2)
        mem = psutil.virtual_memory()
        mem_used_gb = mem.used / (1024 ** 3)
        mem_total_gb = mem.total / (1024 ** 3)
        return {
            "cpu_pct": cpu,
            "mem_pct": mem.percent,
            "mem_used_gb": mem_used_gb,
            "mem_total_gb": mem_total_gb,
        }
    except ImportError:
        # Tenta instalar sem bloquear
        try:
            from wallethub.utils.dependencies import ensure_python_dependency
            ensure_python_dependency("psutil")
            import psutil
            cpu = psutil.cpu_percent(interval=0.2)
            mem = psutil.virtual_memory()
            return {
                "cpu_pct": cpu,
                "mem_pct": mem.percent,
                "mem_used_gb": mem.used / (1024 ** 3),
                "mem_total_gb": mem.total / (1024 ** 3),
            }
        except Exception:
            return None
    except Exception:
        return None


def _cpu_style(pct: float) -> str:
    if pct < 50:
        return "bold green"
    elif pct < 80:
        return "bold yellow"
    return "bold red"


# ─── dashboard Rich ───────────────────────────────────────────────────────────

def show_dashboard_rich(menu_ctx: MenuContext) -> None:
    """Mostra dashboard usando Rich (se disponível)"""
    if not has_rich():
        show_dashboard_text(menu_ctx)
        return

    from rich.console import Console, Group
    from rich.table import Table
    from rich.panel import Panel
    from rich.text import Text
    from rich.columns import Columns
    from rich.rule import Rule

    terminal_width = max(60, min(shutil.get_terminal_size((100, 24)).columns, 140))
    console = Console(width=terminal_width, force_terminal=False, legacy_windows=False)

    tracker = get_tracker()
    stats = tracker.get_stats()

    metrics = None
    try:
        from wallethub.analytics.metrics import get_metrics_collector
        metrics = get_metrics_collector()
    except Exception:
        pass

    # ── Coluna esquerda: Status dos serviços ──────────────────────────────────
    docker_available = _check_docker_status()
    docker_status_label = "✅ Running" if docker_available else "⚠️  Parado"
    docker_raw = "healthy" if docker_available else "stopped"

    service_rows = [
        ("Docker", docker_status_label, "—", docker_raw),
    ]
    for label, checker in [
        ("Postgres", _check_postgres_status),
        ("Redis", _check_redis_status),
        ("Adminer", _check_adminer_status),
        ("API", _check_api_status),
        ("Web", _check_web_status),
        ("Traefik", _check_traefik_status),
    ]:
        s_label, porta, raw = checker(menu_ctx, docker_available)
        service_rows.append((label, s_label, porta, raw))

    col_w = max(10, (terminal_width // 2) - 14)

    status_table = Table(
        show_header=True,
        header_style="bold cyan",
        box=None,
        padding=(0, 1),
        show_edge=False,
        expand=False,
    )
    status_table.add_column("Serviço", style="cyan", width=10)
    status_table.add_column("Estado", width=16)
    status_table.add_column("Porta", justify="right", width=7, style="dim")

    for name, label, porta, raw in service_rows:
        style = _service_status_style(raw)
        status_table.add_row(name, Text(label, style=style), porta)

    # Sistema
    sys_info = _get_system_info()
    if sys_info:
        sys_table = Table(
            show_header=False,
            box=None,
            padding=(0, 1),
            show_edge=False,
            expand=False,
        )
        sys_table.add_column(style="dim", width=8)
        sys_table.add_column(justify="right", width=10)

        cpu = sys_info["cpu_pct"]
        mem_pct = sys_info["mem_pct"]
        sys_table.add_row("CPU", Text(f"{cpu:.0f}%", style=_cpu_style(cpu)))
        sys_table.add_row(
            "RAM",
            Text(
                f"{sys_info['mem_used_gb']:.1f}/{sys_info['mem_total_gb']:.1f} GB",
                style=_cpu_style(mem_pct),
            ),
        )

        left_col = Group(
            Text("📊  SERVIÇOS", style="bold yellow"),
            Text(""),
            status_table,
            Text(""),
            Rule(style="dim"),
            Text(""),
            Text("🖥️  SISTEMA", style="bold blue"),
            Text(""),
            sys_table,
        )
    else:
        left_col = Group(
            Text("📊  SERVIÇOS", style="bold yellow"),
            Text(""),
            status_table,
        )

    # ── Coluna direita: Estatísticas ──────────────────────────────────────────
    stats_table = Table(
        show_header=False,
        box=None,
        padding=(0, 1),
        show_edge=False,
        expand=False,
    )
    stats_table.add_column(style="dim", width=18)
    stats_table.add_column(justify="right", width=10)

    total = stats.get("total", 0)
    success_count = stats.get("success", 0)
    failed_count = stats.get("failed", 0)
    success_rate = stats.get("success_rate", 0)

    stats_table.add_row("Comandos", str(total))
    stats_table.add_row("Sucedidos", Text(str(success_count), style="green"))
    stats_table.add_row("Falhas", Text(str(failed_count), style="red" if failed_count > 0 else "dim"))

    rate_style = "bold green" if success_rate >= 90 else "bold yellow" if success_rate >= 70 else "bold red"
    stats_table.add_row("Taxa sucesso", Text(f"{success_rate:.1f}%", style=rate_style))
    stats_table.add_row("Duração média", format_duration(stats.get("avg_duration", 0)))
    if total > 0:
        stats_table.add_row("Duração mín", format_duration(stats.get("min_duration", 0)))
        stats_table.add_row("Duração máx", format_duration(stats.get("max_duration", 0)))

    # Top comandos
    top_items = []
    if total > 0:
        top_used = tracker.get_top_commands("count", limit=5)
        if top_used:
            top_table = Table(
                show_header=True,
                header_style="bold magenta",
                box=None,
                padding=(0, 1),
                show_edge=False,
                expand=False,
            )
            top_table.add_column("Comando", style="cyan", width=18, overflow="ellipsis")
            top_table.add_column("Uso", justify="right", width=4)
            top_table.add_column("Sucesso", justify="right", width=7)

            for cmd, cmd_stats in top_used[:5]:
                cmd_display = cmd[:16] + "…" if len(cmd) > 16 else cmd
                usage = cmd_stats.get("count", 0)
                sr = cmd_stats.get("success_rate", 0)
                sr_style = "green" if sr >= 90 else "yellow" if sr >= 70 else "red"
                top_table.add_row(cmd_display, str(usage), Text(f"{sr:.0f}%", style=sr_style))

            top_items = [
                Text(""),
                Rule(style="dim"),
                Text(""),
                Text("🔥  TOP COMANDOS", style="bold magenta"),
                Text(""),
                top_table,
            ]

    # Sparkline de actividade 24 h
    spark_items = []
    if total > 0:
        hourly_rates = _hourly_success_rates(tracker)
        spark = _sparkline(hourly_rates)
        spark_text = Text()
        spark_text.append("24h  ", style="dim")
        # colorir cada bloco
        blocks_chars = list(spark)
        for i, ch in enumerate(blocks_chars):
            rate = hourly_rates[i]
            ch_style = "green" if rate >= 70 else "yellow" if rate > 0 else "dim"
            spark_text.append(ch, style=ch_style)
        spark_items = [
            Text(""),
            Rule(style="dim"),
            Text(""),
            Text("📈  ACTIVIDADE (24h)", style="bold blue"),
            Text(""),
            spark_text,
        ]

    right_col = Group(
        Text("📈  ESTATÍSTICAS", style="bold blue"),
        Text(""),
        stats_table,
        *top_items,
        *spark_items,
    )

    if total == 0:
        right_col = Group(
            Text("📈  ESTATÍSTICAS", style="bold blue"),
            Text(""),
            stats_table,
            Text(""),
            Text("💡 Execute comandos através da CLI para ver estatísticas.", style="dim italic"),
        )

    # ── Atividade Recente ─────────────────────────────────────────────────────
    recent_items = []
    recent = tracker.get_recent_commands(limit=5)
    if recent:
        activity_table = Table(
            show_header=True,
            header_style="bold green",
            box=None,
            padding=(0, 1),
            show_edge=False,
            expand=False,
        )
        activity_table.add_column("Comando", style="cyan", width=20, overflow="ellipsis")
        activity_table.add_column("Estado", justify="center", width=6)
        activity_table.add_column("Duração", justify="right", width=10)
        activity_table.add_column("Quando", justify="left", width=10)

        now = datetime.now()
        for entry in recent:
            cmd = entry.get("command", "unknown")
            cmd_display = cmd[:18] + "…" if len(cmd) > 18 else cmd
            success = entry.get("success", False)
            duration = entry.get("duration", 0)
            ts_str = entry.get("timestamp", "")

            when = "Agora"
            try:
                if ts_str:
                    ts_clean = ts_str.split('+')[0].split('Z')[0]
                    ts = datetime.fromisoformat(ts_clean)
                    diff = (now - ts).total_seconds()
                    if diff < 60:
                        when = "Agora"
                    elif diff < 3600:
                        when = f"{int(diff/60)}m atrás"
                    elif diff < 86400:
                        when = f"{int(diff/3600)}h atrás"
                    else:
                        when = f"{int(diff/86400)}d atrás"
            except Exception:
                when = "—"

            status_text = Text("✅", style="bold green") if success else Text("❌", style="bold red")
            activity_table.add_row(cmd_display, status_text, format_duration(duration), when)

        recent_items = [
            Text(""),
            Text("🕒  ACTIVIDADE RECENTE", style="bold green"),
            Text(""),
            activity_table,
        ]

    # ── Montar layout ─────────────────────────────────────────────────────────
    left_panel = Panel(left_col, border_style="cyan dim", padding=(0, 1))
    right_panel = Panel(right_col, border_style="blue dim", padding=(0, 1))

    columns = Columns([left_panel, right_panel], equal=True, expand=True)

    main_content_items: list = [columns]
    if recent_items:
        main_content_items.extend(recent_items)

    main_content = Group(*main_content_items)

    outer_panel = Panel(
        main_content,
        title="[bold cyan]💰 WalletHub Developer Experience[/bold cyan]",
        subtitle=f"[dim]{datetime.now().strftime('%d/%m/%Y %H:%M:%S')}[/dim]",
        border_style="cyan",
        padding=(1, 1),
    )

    console.print(outer_panel)
    console.print()

    try:
        console.file.flush()
    except (AttributeError, OSError):
        pass


# ─── dashboard textual (fallback) ─────────────────────────────────────────────

def show_dashboard_text(menu_ctx: MenuContext) -> None:
    """Mostra dashboard em modo textual (fallback)"""
    import sys

    tracker = get_tracker()
    stats = tracker.get_stats()

    print("\n💰 WalletHub Developer Experience")
    print("=" * 50)
    print("\n📊 STATUS DOS SERVIÇOS")

    docker_available = _check_docker_status()
    print(f"  Docker:   {'✅ Running' if docker_available else '⚠️ Parado'}")

    for label, checker in [
        ("Postgres", _check_postgres_status),
        ("Redis", _check_redis_status),
        ("Adminer", _check_adminer_status),
        ("API", _check_api_status),
        ("Web", _check_web_status),
        ("Traefik", _check_traefik_status),
    ]:
        s_label, porta, _ = checker(menu_ctx, docker_available)
        print(f"  {label:<10} {s_label}  (:{porta})")

    sys_info = _get_system_info()
    if sys_info:
        print(f"\n🖥️  SISTEMA")
        print(f"  CPU: {sys_info['cpu_pct']:.0f}%  |  RAM: {sys_info['mem_used_gb']:.1f}/{sys_info['mem_total_gb']:.1f} GB ({sys_info['mem_pct']:.0f}%)")

    print("\n📈 ESTATÍSTICAS")
    print(f"  Total:        {stats.get('total', 0)}")
    print(f"  Sucedidos:    {stats.get('success', 0)}")
    print(f"  Falhas:       {stats.get('failed', 0)}")
    print(f"  Taxa sucesso: {stats.get('success_rate', 0):.1f}%")
    print(f"  Duração média:{format_duration(stats.get('avg_duration', 0))}")

    if stats.get("total", 0) > 0:
        top_used = tracker.get_top_commands("count", limit=5)
        if top_used:
            print("\n🔥 TOP COMANDOS")
            print("  Comando                Uso   Sucesso    Duração")
            print("  " + "-" * 50)
            for cmd, cmd_stats in top_used[:5]:
                cmd_display = (cmd[:20] + "...") if len(cmd) > 20 else cmd
                usage = cmd_stats.get("count", 0)
                sr = cmd_stats.get("success_rate", 0)
                avg_dur = cmd_stats.get("avg_duration", 0)
                print(f"  {cmd_display:<22} {usage:<5}  {sr:>5.1f}%  {format_duration(avg_dur):>10}")

    recent = tracker.get_recent_commands(limit=5)
    if recent:
        print("\n🕒 ACTIVIDADE RECENTE")
        now = datetime.now()
        for entry in recent:
            cmd = entry.get("command", "unknown")
            cmd_display = (cmd[:18] + "...") if len(cmd) > 18 else cmd
            success = entry.get("success", False)
            duration = entry.get("duration", 0)
            ts_str = entry.get("timestamp", "")
            icon = "✅" if success else "❌"
            when = "Agora"
            try:
                if ts_str:
                    ts_clean = ts_str.split('+')[0].split('Z')[0]
                    ts = datetime.fromisoformat(ts_clean)
                    diff = (now - ts).total_seconds()
                    if diff >= 3600:
                        when = f"{int(diff/3600)}h atrás"
                    elif diff >= 60:
                        when = f"{int(diff/60)}m atrás"
            except Exception:
                when = "—"
            print(f"  {icon} {cmd_display:<20} {format_duration(duration):>8}  {when}")

    if stats.get("total", 0) == 0:
        print("\n💡 Execute comandos através da CLI para ver estatísticas.")

    try:
        sys.stdout.flush()
        sys.stderr.flush()
    except (AttributeError, OSError):
        pass
    print()


# ─── entry point ──────────────────────────────────────────────────────────────

def show_dashboard(menu_ctx: MenuContext) -> None:
    """Mostra dashboard (com fallback automático)"""
    if has_rich():
        show_dashboard_rich(menu_ctx)
    else:
        show_dashboard_text(menu_ctx)
