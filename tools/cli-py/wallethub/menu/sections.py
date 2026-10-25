"""Definição de seções do menu interativo"""

from dataclasses import dataclass, field
from typing import Callable, List, TYPE_CHECKING

if TYPE_CHECKING:
    from wallethub.context import MenuContext

from wallethub.context import MenuContext


@dataclass
class MenuItem:
    """Item individual do menu"""
    name: str
    message: str
    action: Callable[["MenuContext", str], None]
    icon: str = ""
    description: str = ""
    dangerous: bool = False


@dataclass
class MenuSection:
    """Seção do menu com múltiplos itens"""
    name: str
    message: str
    icon: str
    items: List[MenuItem]


def get_menu_sections() -> List[MenuSection]:
    """
    Retorna todas as seções do menu.

    Returns:
        Lista de seções do menu
    """
    from wallethub.utils.run import exec_wallethub_safe

    def exec_wallethub(args: List[str], menu_ctx: "MenuContext") -> None:
        """Executa comando wallethub via npm de forma segura"""
        exec_wallethub_safe(
            args,
            menu_ctx,
            check=True,
        )

    return [
        MenuSection(
            name="development",
            message="Desenvolvimento",
            icon="🛠️",
            items=[
                MenuItem(
                    name="dev-start",
                    message="Iniciar stack local",
                    icon="▶️",
                    description="Validações + stack + diagnósticos automáticos",
                    action=lambda ctx, env: exec_wallethub(["workflow", "dev:start", "--env", env], ctx),
                ),
                MenuItem(
                    name="dev-start-tests",
                    message="Iniciar stack com testes",
                    icon="🧪",
                    description="Validações + stack + suite completa de testes",
                    action=lambda ctx, env: exec_wallethub(["workflow", "dev:start", "--env", env, "--with-tests"], ctx),
                ),
                MenuItem(
                    name="dev-stop",
                    message="Parar stack",
                    icon="⏹️",
                    description="Derruba containers mantendo volumes intactos",
                    action=lambda ctx, env: exec_wallethub(["workflow", "dev:stop", "--env", env], ctx),
                ),
                MenuItem(
                    name="dev-reset",
                    message="Resetar stack",
                    icon="⚠️",
                    description="Remove containers E volumes — dados locais serão apagados",
                    dangerous=True,
                    action=lambda ctx, env: exec_wallethub(["workflow", "dev:reset", "--env", env], ctx),
                ),
            ],
        ),
        MenuSection(
            name="production",
            message="Produção",
            icon="🚀",
            items=[
                MenuItem(
                    name="prod-start",
                    message="Deploy completo",
                    icon="🌐",
                    description="Backup → CI → release → deploy → migrações → diagnósticos",
                    action=lambda ctx, env: exec_wallethub(["workflow", "prod:start"], ctx),
                ),
                MenuItem(
                    name="prod-stop",
                    message="Parar produção",
                    icon="🛑",
                    description="Derruba toda a stack de produção",
                    dangerous=True,
                    action=lambda ctx, env: exec_wallethub(["workflow", "prod:stop"], ctx),
                ),
            ],
        ),
        MenuSection(
            name="maintenance",
            message="Manutenção",
            icon="🔧",
            items=[
                MenuItem(
                    name="maintenance-secrets-rotate",
                    message="Rotacionar secrets JWT",
                    icon="🔑",
                    description="Gera novos secrets com histórico automático — invalida tokens activos",
                    action=lambda ctx, env: exec_wallethub(["secrets", "jwt"], ctx),
                ),
                MenuItem(
                    name="maintenance-backup-create",
                    message="Backup de produção",
                    icon="💾",
                    description="Exporta Postgres com timestamp para restauro posterior",
                    action=lambda ctx, env: exec_wallethub(["db", "backup", "--env", "production"], ctx),
                ),
            ],
        ),
    ]
