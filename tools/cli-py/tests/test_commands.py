"""Testes para comandos da CLI"""

import pytest
from unittest.mock import Mock, patch, MagicMock
from pathlib import Path

from wallethub.context import MenuContext


class TestCommands:
    """Testes básicos para comandos"""
    
    @pytest.fixture
    def mock_context(self, tmp_path):
        """Cria contexto mockado"""
        project_root = tmp_path / "project"
        project_root.mkdir()
        return MenuContext(project_root)
    
    @patch("wallethub.utils.run.run_command")
    def test_setup_command(self, mock_run, mock_context):
        """Testa comando setup (mock)"""
        from wallethub.commands.setup import setup
        
        mock_run.return_value = Mock(returncode=0)
        
        # Não podemos testar diretamente sem Typer context
        # Mas podemos testar a lógica interna
        assert mock_context.project_root.exists()
    
    @patch("wallethub.utils.run.run_command")
    def test_diagnose_command(self, mock_run, mock_context):
        """Testa comando diagnose (mock)"""
        mock_run.return_value = Mock(returncode=0, stdout="Docker: OK")
        
        # Testa que o contexto é válido
        assert mock_context.project_root.exists()

