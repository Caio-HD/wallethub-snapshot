"""Coleta de métricas e estatísticas para a CLI WalletHub"""

import json
import time
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Any
from collections import defaultdict


class MetricsCollector:
    """Coletor de métricas da CLI"""
    
    def __init__(self, data_dir: Optional[Path] = None):
        """
        Inicializa o coletor de métricas.
        
        Args:
            data_dir: Diretório para salvar métricas (opcional)
        """
        self.data_dir = data_dir or Path.home() / ".wallethub" / "metrics"
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.metrics_file = self.data_dir / "metrics.json"
        self._metrics: Dict[str, Any] = {
            "commands": defaultdict(list),
            "workflows": defaultdict(list),
            "errors": defaultdict(int),
            "performance": defaultdict(list),
        }
        self._load_metrics()
    
    def _load_metrics(self) -> None:
        """Carrega métricas do arquivo"""
        if self.metrics_file.exists():
            try:
                with open(self.metrics_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    # Converte listas de volta para defaultdict
                    self._metrics["commands"] = defaultdict(list, data.get("commands", {}))
                    self._metrics["workflows"] = defaultdict(list, data.get("workflows", {}))
                    self._metrics["errors"] = defaultdict(int, data.get("errors", {}))
                    self._metrics["performance"] = defaultdict(list, data.get("performance", {}))
            except Exception:
                pass
    
    def _save_metrics(self) -> None:
        """Salva métricas no arquivo"""
        try:
            # Limpa métricas antigas (mantém apenas últimos 1000 registros por categoria)
            for category in ["commands", "workflows", "performance"]:
                for key in list(self._metrics[category].keys()):
                    if len(self._metrics[category][key]) > 1000:
                        self._metrics[category][key] = self._metrics[category][key][-1000:]
            
            with open(self.metrics_file, "w", encoding="utf-8") as f:
                json.dump(self._metrics, f, indent=2, default=str)
        except Exception:
            pass  # Não falhar se não conseguir salvar
    
    def record_command(
        self,
        command: str,
        duration: float,
        success: bool,
        error: Optional[str] = None,
    ) -> None:
        """
        Registra execução de um comando.
        
        Args:
            command: Comando executado
            duration: Duração em segundos
            success: Se foi bem-sucedido
            error: Mensagem de erro (se houver)
        """
        entry = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "duration": duration,
            "success": success,
        }
        
        if error:
            entry["error"] = error
            self._metrics["errors"][error] += 1
        
        self._metrics["commands"][command].append(entry)
        self._save_metrics()
    
    def record_workflow(
        self,
        workflow: str,
        duration: float,
        success: bool,
        steps: Optional[int] = None,
        errors: Optional[List[str]] = None,
    ) -> None:
        """
        Registra execução de um workflow.
        
        Args:
            workflow: Nome do workflow
            duration: Duração em segundos
            success: Se foi bem-sucedido
            steps: Número de steps executados
            errors: Lista de erros (se houver)
        """
        entry = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "duration": duration,
            "success": success,
        }
        
        if steps is not None:
            entry["steps"] = steps
        
        if errors:
            entry["errors"] = errors
            for error in errors:
                self._metrics["errors"][error] += 1
        
        self._metrics["workflows"][workflow].append(entry)
        self._save_metrics()
    
    def record_performance(
        self,
        operation: str,
        duration: float,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        """
        Registra métrica de performance.
        
        Args:
            operation: Nome da operação
            duration: Duração em segundos
            metadata: Metadados adicionais
        """
        entry = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "duration": duration,
        }
        
        if metadata:
            entry.update(metadata)
        
        self._metrics["performance"][operation].append(entry)
        self._save_metrics()
    
    def get_command_stats(self, command: Optional[str] = None) -> Dict[str, Any]:
        """
        Obtém estatísticas de comandos.
        
        Args:
            command: Comando específico (se None, retorna todos)
        
        Returns:
            Estatísticas
        """
        if command:
            entries = self._metrics["commands"].get(command, [])
        else:
            entries = []
            for cmd_entries in self._metrics["commands"].values():
                entries.extend(cmd_entries)
        
        if not entries:
            return {
                "count": 0,
                "success_rate": 0.0,
                "avg_duration": 0.0,
                "total_duration": 0.0,
            }
        
        total = len(entries)
        successful = sum(1 for e in entries if e.get("success", False))
        durations = [e.get("duration", 0) for e in entries]
        
        return {
            "count": total,
            "success_rate": successful / total if total > 0 else 0.0,
            "avg_duration": sum(durations) / len(durations) if durations else 0.0,
            "total_duration": sum(durations),
            "min_duration": min(durations) if durations else 0.0,
            "max_duration": max(durations) if durations else 0.0,
        }
    
    def get_workflow_stats(self, workflow: Optional[str] = None) -> Dict[str, Any]:
        """
        Obtém estatísticas de workflows.
        
        Args:
            workflow: Workflow específico (se None, retorna todos)
        
        Returns:
            Estatísticas
        """
        if workflow:
            entries = self._metrics["workflows"].get(workflow, [])
        else:
            entries = []
            for wf_entries in self._metrics["workflows"].values():
                entries.extend(wf_entries)
        
        if not entries:
            return {
                "count": 0,
                "success_rate": 0.0,
                "avg_duration": 0.0,
                "total_duration": 0.0,
            }
        
        total = len(entries)
        successful = sum(1 for e in entries if e.get("success", False))
        durations = [e.get("duration", 0) for e in entries]
        
        return {
            "count": total,
            "success_rate": successful / total if total > 0 else 0.0,
            "avg_duration": sum(durations) / len(durations) if durations else 0.0,
            "total_duration": sum(durations),
            "min_duration": min(durations) if durations else 0.0,
            "max_duration": max(durations) if durations else 0.0,
        }
    
    def get_error_stats(self, limit: int = 10) -> List[tuple[str, int]]:
        """
        Obtém estatísticas de erros mais frequentes.
        
        Args:
            limit: Número máximo de erros a retornar
        
        Returns:
            Lista de tuplas (erro, contagem) ordenada por frequência
        """
        errors = sorted(
            self._metrics["errors"].items(),
            key=lambda x: x[1],
            reverse=True,
        )
        return errors[:limit]
    
    def get_recent_activity(self, hours: int = 24, limit: int = 50) -> List[Dict[str, Any]]:
        """
        Obtém atividade recente.
        
        Args:
            hours: Número de horas para buscar
            limit: Número máximo de entradas
        
        Returns:
            Lista de atividades recentes
        """
        cutoff = datetime.utcnow() - timedelta(hours=hours)
        activities = []
        
        # Comandos
        for command, entries in self._metrics["commands"].items():
            for entry in entries:
                timestamp = datetime.fromisoformat(entry["timestamp"].replace("Z", "+00:00"))
                if timestamp >= cutoff:
                    activities.append({
                        "type": "command",
                        "name": command,
                        "timestamp": entry["timestamp"],
                        "duration": entry.get("duration", 0),
                        "success": entry.get("success", False),
                    })
        
        # Workflows
        for workflow, entries in self._metrics["workflows"].items():
            for entry in entries:
                timestamp = datetime.fromisoformat(entry["timestamp"].replace("Z", "+00:00"))
                if timestamp >= cutoff:
                    activities.append({
                        "type": "workflow",
                        "name": workflow,
                        "timestamp": entry["timestamp"],
                        "duration": entry.get("duration", 0),
                        "success": entry.get("success", False),
                    })
        
        # Ordena por timestamp (mais recente primeiro)
        activities.sort(key=lambda x: x["timestamp"], reverse=True)
        return activities[:limit]


# Instância global do coletor de métricas
_metrics_collector: Optional[MetricsCollector] = None


def get_metrics_collector(data_dir: Optional[Path] = None) -> MetricsCollector:
    """
    Obtém instância global do coletor de métricas.
    
    Args:
        data_dir: Diretório para salvar métricas (apenas na primeira chamada)
    
    Returns:
        Coletor de métricas
    """
    global _metrics_collector
    if _metrics_collector is None:
        _metrics_collector = MetricsCollector(data_dir)
    return _metrics_collector

