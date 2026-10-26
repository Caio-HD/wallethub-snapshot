"""Contexto compartilhado da CLI WalletHub"""

from pathlib import Path
from typing import Optional
import os


class MenuContext:
    """
    Contexto compartilhado pelo menu e workflows.
    Equivalente ao CliContext TypeScript.
    """
    
    def __init__(self, project_root: Path):
        """
        Inicializa o contexto com a raiz do projeto.
        
        Args:
            project_root: Caminho da raiz do projeto WalletHub
        """
        self.project_root = Path(project_root).resolve()
        self.cli_root = self.project_root / "tools" / "cli-py"
        self.api_dir = self.project_root / "apps" / "api"
        self.web_dir = self.project_root / "apps" / "web"
    
    def resolve_project_path(self, *segments: str) -> Path:
        """
        Resolve um caminho relativo a partir da raiz do projeto.
        
        Args:
            *segments: Segmentos do caminho
        
        Returns:
            Path absoluto resolvido
        """
        return self.project_root.joinpath(*segments)
    
    def resolve_ci_compose_path(self) -> Path:
        """Retorna o caminho do docker-compose.ci.yml"""
        return self.resolve_project_path("ops", "ci", "docker-compose.ci.yml")
    
    def resolve_ci_script_path(self) -> Path:
        """Retorna o caminho do script run-all.sh"""
        return self.resolve_project_path("ops", "ci", "run-all.sh")
    
    def resolve_dev_compose_path(self) -> Path:
        """Retorna o caminho do docker-compose.yml de desenvolvimento"""
        return self.resolve_project_path("ops", "dev", "docker-compose.yml")
    
    def resolve_deploy_script_path(self) -> Path:
        """Retorna o caminho do script deploy-local.sh"""
        return self.resolve_project_path("ops", "prod", "deploy-local.sh")
    
    def resolve_deploy_env_path(self) -> Path:
        """Retorna o caminho do arquivo .env.deploy"""
        return self.resolve_project_path("ops", "prod", ".env.deploy")
    
    def resolve_cloudflared_path(self, *segments: str) -> Path:
        """Retorna o caminho do diretório .cloudflared"""
        return self.resolve_project_path(".cloudflared", *segments)
    
    def resolve_cloudflared_config_path(self) -> Path:
        """Retorna o caminho do arquivo de configuração do Cloudflare Tunnel"""
        return self.resolve_project_path(".cloudflared", "config.dev.yml")
    
    def resolve_environment_path(self, env_name: str) -> Path:
        """Retorna o caminho do arquivo de configuração de ambiente"""
        return self.resolve_project_path("config", "envs", f"{env_name}.json")
    
    def resolve_jwt_env_path(self) -> Path:
        """Retorna o caminho do arquivo .env.jwt"""
        return self.resolve_project_path("secrets", "jwt", ".env.jwt")
    
    def resolve_jwt_keys_path(self) -> tuple[Path, Path]:
        """Retorna os caminhos das chaves JWT (privada e pública)"""
        jwt_dir = self.resolve_project_path("secrets", "jwt")
        return (
            jwt_dir / "jwt_private.pem",
            jwt_dir / "jwt_public.pem",
        )




