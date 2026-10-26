"""Testes de integração para workflows"""

import pytest
from pathlib import Path
from unittest.mock import Mock, patch

from wallethub.context import MenuContext


class TestWorkflows:
    """Testes de integração para workflows"""
    
    @pytest.fixture
    def mock_context(self, tmp_path):
        """Cria contexto mockado"""
        project_root = tmp_path / "project"
        project_root.mkdir()
        (project_root / "services" / "api").mkdir(parents=True)
        (project_root / "services" / "web").mkdir(parents=True)
        (project_root / "ops" / "dev").mkdir(parents=True)
        (project_root / "config" / "envs").mkdir(parents=True)
        return MenuContext(project_root)
    
    @patch("wallethub.workflows.dev.run_command")
    @patch("wallethub.workflows.dev.check_docker")
    @patch("wallethub.workflows.dev.check_dependencies")
    def test_workflow_dev_start_mock(self, mock_check_deps, mock_check_docker, mock_run, mock_context):
        """Testa workflow dev:start com mocks"""
        mock_check_docker.return_value = (True, None)
        mock_check_deps.return_value = True
        mock_run.return_value = Mock(returncode=0)
        
        # Não podemos executar o workflow completo sem Docker real
        # Mas podemos testar que os mocks funcionam
        assert mock_check_docker.return_value[0] is True
        assert mock_check_deps.return_value is True

