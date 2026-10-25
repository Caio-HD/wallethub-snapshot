"""Workflows de manutenção"""

from wallethub.context import MenuContext
from wallethub.utils.run import exec_wallethub_safe
from wallethub.utils.artifacts import (
    cleanup_old_artifacts,
)
from wallethub.workflows.dev import execute_steps


def workflow_deploy_publish(
    menu_ctx: MenuContext,
    env_file: str = None,
    dry_run: bool = False,
) -> None:
    """Workflow de publicação (CI + Release + Deploy)"""
    # Limpa artifacts antigos antes de começar
    print("🧹 Limpando artifacts antigos...")
    cleanup_old_artifacts(menu_ctx, "ci")
    
    execute_steps("Publicação completa (CI + Release + Deploy)", [
        {
            "label": "Executando pipeline CI completa",
            "action": lambda: exec_wallethub_safe(
                ["ci"],
                menu_ctx,
                check=True,
            ),
        },
        {
            "label": "Gerando imagens de release",
            "action": lambda: exec_wallethub_safe(
                ["release"],
                menu_ctx,
                check=True,
            ),
        },
        {
            "label": "Simulando deploy (dry-run)" if dry_run else "Aplicando stack de deploy",
            "action": lambda: exec_wallethub_safe(
                ["deploy", "up"]
                + (["--env-file", env_file] if env_file else [])
                + (["--dry-run"] if dry_run else []),
                menu_ctx,
                check=True,
            ),
        },
    ])

