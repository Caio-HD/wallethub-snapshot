"""Gerenciamento de artifacts timestampados com limpeza automática"""

import shutil
from datetime import datetime
from pathlib import Path
from typing import Optional

from wallethub.config import ARTIFACTS_KEEP_LAST
from wallethub.context import MenuContext


def generate_artifact_dir(menu_ctx: MenuContext, category: str) -> Path:
    """
    Cria um diretório timestampado para artifacts de uma categoria.
    
    Args:
        menu_ctx: Contexto da CLI
        category: Categoria do artifact (pre-stack, post-stack, ci, etc.)
    
    Returns:
        Path do diretório criado
    """
    # Determina o diretório base baseado na categoria
    if category == "pre-stack":
        base_dir = menu_ctx.resolve_project_path("ops", "dev", "artifacts", "pre-stack")
    elif category == "post-stack":
        base_dir = menu_ctx.resolve_project_path("ops", "dev", "artifacts", "post-stack")
    elif category == "ci":
        base_dir = menu_ctx.resolve_project_path("ops", "ci", "artifacts")
    elif category == "prod":
        base_dir = menu_ctx.resolve_project_path("ops", "prod", "artifacts", "ci")
    else:
        # Categoria genérica
        base_dir = menu_ctx.resolve_project_path("ops", "dev", "artifacts", category)
    
    # Cria diretório base se não existir
    base_dir.mkdir(parents=True, exist_ok=True)
    
    # Gera timestamp no formato ISO sem milissegundos, substituindo : por -
    timestamp = datetime.now().strftime("%Y-%m-%dT%H-%M-%S")
    artifact_dir = base_dir / timestamp
    
    # Cria diretório do artifact
    artifact_dir.mkdir(parents=True, exist_ok=True)
    
    return artifact_dir


def cleanup_old_artifacts(menu_ctx: MenuContext, category: str, keep: int = ARTIFACTS_KEEP_LAST) -> None:
    """
    Remove artifacts antigos, mantendo apenas os últimos N.
    
    Args:
        menu_ctx: Contexto da CLI
        category: Categoria do artifact
        keep: Quantidade de artifacts a manter (padrão: 10)
    """
    # Determina o diretório base baseado na categoria
    if category == "pre-stack":
        base_dir = menu_ctx.resolve_project_path("ops", "dev", "artifacts", "pre-stack")
    elif category == "post-stack":
        base_dir = menu_ctx.resolve_project_path("ops", "dev", "artifacts", "post-stack")
    elif category == "ci":
        base_dir = menu_ctx.resolve_project_path("ops", "ci", "artifacts")
    elif category == "prod":
        base_dir = menu_ctx.resolve_project_path("ops", "prod", "artifacts", "ci")
    else:
        base_dir = menu_ctx.resolve_project_path("ops", "dev", "artifacts", category)
    
    if not base_dir.exists():
        return
    
    # Lista todos os diretórios timestampados
    artifact_dirs = [
        d for d in base_dir.iterdir()
        if d.is_dir() and not d.name.startswith(".")
    ]
    
    if len(artifact_dirs) <= keep:
        return
    
    # Ordena por data de modificação (mais recente primeiro)
    artifact_dirs.sort(key=lambda d: d.stat().st_mtime, reverse=True)
    
    # Remove os mais antigos
    to_remove = artifact_dirs[keep:]
    for artifact_dir in to_remove:
        try:
            shutil.rmtree(artifact_dir)
        except Exception:
            # Ignora erros de remoção (arquivo pode estar em uso)
            pass


def save_artifact(
    menu_ctx: MenuContext,
    content: str,
    filename: str,
    category: str,
    artifact_dir: Optional[Path] = None,
) -> Path:
    """
    Salva um artifact em um arquivo.
    
    Args:
        menu_ctx: Contexto da CLI
        content: Conteúdo do artifact (string)
        filename: Nome do arquivo
        category: Categoria do artifact
        artifact_dir: Diretório do artifact (se None, cria novo)
    
    Returns:
        Path do arquivo salvo
    """
    if artifact_dir is None:
        artifact_dir = generate_artifact_dir(menu_ctx, category)
    
    artifact_file = artifact_dir / filename
    artifact_file.parent.mkdir(parents=True, exist_ok=True)
    
    artifact_file.write_text(content, encoding="utf-8")
    
    return artifact_file


def save_artifact_from_file(
    menu_ctx: MenuContext,
    source_file: Path,
    filename: Optional[str] = None,
    category: str = "misc",
    artifact_dir: Optional[Path] = None,
) -> Path:
    """
    Copia um arquivo existente para o diretório de artifacts.
    
    Args:
        menu_ctx: Contexto da CLI
        source_file: Arquivo fonte
        filename: Nome do arquivo no artifact (se None, usa nome original)
        category: Categoria do artifact
        artifact_dir: Diretório do artifact (se None, cria novo)
    
    Returns:
        Path do arquivo copiado
    """
    if artifact_dir is None:
        artifact_dir = generate_artifact_dir(menu_ctx, category)
    
    target_filename = filename or source_file.name
    artifact_file = artifact_dir / target_filename
    
    artifact_file.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source_file, artifact_file)
    
    return artifact_file


def get_latest_artifact_dir(menu_ctx: MenuContext, category: str) -> Optional[Path]:
    """
    Retorna o diretório do artifact mais recente de uma categoria.
    
    Args:
        menu_ctx: Contexto da CLI
        category: Categoria do artifact
    
    Returns:
        Path do diretório mais recente ou None se não existir
    """
    # Determina o diretório base baseado na categoria
    if category == "pre-stack":
        base_dir = menu_ctx.resolve_project_path("ops", "dev", "artifacts", "pre-stack")
    elif category == "post-stack":
        base_dir = menu_ctx.resolve_project_path("ops", "dev", "artifacts", "post-stack")
    elif category == "ci":
        base_dir = menu_ctx.resolve_project_path("ops", "ci", "artifacts")
    elif category == "prod":
        base_dir = menu_ctx.resolve_project_path("ops", "prod", "artifacts", "ci")
    else:
        base_dir = menu_ctx.resolve_project_path("ops", "dev", "artifacts", category)
    
    if not base_dir.exists():
        return None
    
    # Lista todos os diretórios timestampados
    artifact_dirs = [
        d for d in base_dir.iterdir()
        if d.is_dir() and not d.name.startswith(".")
    ]
    
    if not artifact_dirs:
        return None
    
    # Retorna o mais recente
    return max(artifact_dirs, key=lambda d: d.stat().st_mtime)

