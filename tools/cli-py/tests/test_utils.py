"""Testes unitários para utilitários"""

import pytest
from pathlib import Path
from unittest.mock import Mock, patch, MagicMock

from wallethub.utils.platform import is_windows, npm_command, npx_command
from wallethub.utils.artifacts import (
    generate_artifact_dir,
    cleanup_old_artifacts,
    save_artifact,
    get_latest_artifact_dir,
)
from wallethub.context import MenuContext


class TestPlatform:
    """Testes para detecção de plataforma"""
    
    def test_npm_command(self):
        """Testa detecção do comando npm correto"""
        cmd = npm_command()
        assert cmd in ["npm", "npm.cmd"]

    def test_npx_command(self):
        """Testa detecção do comando npx correto"""
        cmd = npx_command()
        assert cmd in ["npx", "npx.cmd"]

    @patch("platform.system")
    def test_is_windows(self, mock_system):
        """Testa detecção de Windows"""
        mock_system.return_value = "Windows"
        assert is_windows() is True
        
        mock_system.return_value = "Linux"
        assert is_windows() is False


class TestArtifacts:
    """Testes para gerenciamento de artifacts"""
    
    @pytest.fixture
    def mock_context(self, tmp_path):
        """Cria contexto mockado"""
        project_root = tmp_path / "project"
        project_root.mkdir()
        (project_root / "ops" / "dev" / "artifacts").mkdir(parents=True)
        return MenuContext(project_root)
    
    def test_generate_artifact_dir(self, mock_context):
        """Testa geração de diretório de artifact"""
        artifact_dir = generate_artifact_dir(mock_context, "pre-stack")
        assert artifact_dir.exists()
        assert "pre-stack" in str(artifact_dir)
        assert artifact_dir.is_dir()
    
    def test_save_artifact(self, mock_context):
        """Testa salvamento de artifact"""
        artifact_dir = generate_artifact_dir(mock_context, "pre-stack")
        artifact_file = save_artifact(
            mock_context,
            "test content",
            "test.log",
            "pre-stack",
            artifact_dir,
        )
        assert artifact_file.exists()
        assert artifact_file.read_text() == "test content"
    
    def test_cleanup_old_artifacts(self, mock_context):
        """Testa limpeza de artifacts antigos"""
        # Cria múltiplos diretórios de artifacts
        base_dir = mock_context.resolve_project_path("ops", "dev", "artifacts", "pre-stack")
        for i in range(15):
            artifact_dir = base_dir / f"2025-01-{i:02d}T00-00-00"
            artifact_dir.mkdir(parents=True)
            (artifact_dir / "test.log").write_text("test")
        
        cleanup_old_artifacts(mock_context, "pre-stack", keep=10)
        
        # Deve manter apenas 10
        remaining = list(base_dir.iterdir())
        assert len([d for d in remaining if d.is_dir()]) <= 10
    
    def test_get_latest_artifact_dir(self, mock_context):
        """Testa obtenção do artifact mais recente"""
        base_dir = mock_context.resolve_project_path("ops", "dev", "artifacts", "pre-stack")
        
        # Cria alguns diretórios
        dir1 = base_dir / "2025-01-01T00-00-00"
        dir1.mkdir(parents=True)
        
        dir2 = base_dir / "2025-01-02T00-00-00"
        dir2.mkdir(parents=True)
        
        latest = get_latest_artifact_dir(mock_context, "pre-stack")
        assert latest is not None
        assert latest.name == "2025-01-02T00-00-00" or latest.name == "2025-01-01T00-00-00"


class TestContext:
    """Testes para MenuContext"""
    
    @pytest.fixture
    def context(self, tmp_path):
        """Cria contexto de teste"""
        project_root = tmp_path / "project"
        project_root.mkdir()
        return MenuContext(project_root)
    
    def test_resolve_project_path(self, context):
        """Testa resolução de caminhos do projeto"""
        path = context.resolve_project_path("ops", "dev", "docker-compose.yml")
        assert path == context.project_root / "ops" / "dev" / "docker-compose.yml"
    
    def test_resolve_environment_path(self, context):
        """Testa resolução de caminho de ambiente"""
        path = context.resolve_environment_path("personal")
        assert path == context.project_root / "config" / "envs" / "personal.json"

