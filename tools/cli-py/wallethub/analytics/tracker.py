"""Rastreamento de comandos e analytics"""

import time
from typing import Optional, Dict, List, Any
from datetime import datetime, timedelta
from pathlib import Path
import json
from collections import defaultdict


class CommandTracker:
    """Rastreia comandos executados para analytics"""
    
    def __init__(self, data_dir: Optional[Path] = None):
        """
        Inicializa o tracker.
        
        Args:
            data_dir: Diretório para salvar dados (opcional)
        """
        self.data_dir = data_dir or Path.home() / ".wallethub" / "analytics"
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.history_file = self.data_dir / "command_history.json"
        self._history: list = []
        self._load_history()
    
    def _load_history(self) -> None:
        """Carrega histórico de comandos"""
        if self.history_file.exists():
            try:
                with open(self.history_file, "r", encoding="utf-8") as f:
                    self._history = json.load(f)
            except Exception:
                self._history = []
        else:
            self._history = []
    
    def _save_history(self) -> None:
        """Salva histórico de comandos"""
        try:
            # Mantém apenas últimos 1000 comandos
            if len(self._history) > 1000:
                self._history = self._history[-1000:]
            
            with open(self.history_file, "w", encoding="utf-8") as f:
                json.dump(self._history, f, indent=2)
        except Exception:
            pass  # Não falhar se não conseguir salvar
    
    def track_command(
        self,
        command: str,
        duration: float,
        success: bool,
        error: Optional[str] = None,
    ) -> None:
        """
        Rastreia um comando executado.
        
        Args:
            command: Nome do comando
            duration: Duração em segundos
            success: Se o comando foi bem-sucedido
            error: Mensagem de erro se falhou
        """
        entry = {
            "timestamp": datetime.now().isoformat(),
            "command": command,
            "duration": duration,
            "success": success,
            "error": error,
        }
        
        self._history.append(entry)
        self._save_history()
    
    def get_stats(self) -> dict:
        """
        Retorna estatísticas de comandos (expandido).
        
        Returns:
            Dicionário com estatísticas
        """
        if not self._history:
            return {
                "total": 0,
                "success": 0,
                "failed": 0,
                "success_rate": 0.0,
                "avg_duration": 0.0,
                "min_duration": 0.0,
                "max_duration": 0.0,
                "median_duration": 0.0,
            }
        
        total = len(self._history)
        success = sum(1 for entry in self._history if entry.get("success", False))
        failed = total - success
        success_rate = (success / total) * 100 if total > 0 else 0.0
        
        durations = [entry.get("duration", 0) for entry in self._history]
        durations_sorted = sorted(durations)
        avg_duration = sum(durations) / total if durations else 0.0
        min_duration = min(durations) if durations else 0.0
        max_duration = max(durations) if durations else 0.0
        
        # Mediana
        median_duration = 0.0
        if durations_sorted:
            n = len(durations_sorted)
            if n % 2 == 0:
                median_duration = (durations_sorted[n // 2 - 1] + durations_sorted[n // 2]) / 2
            else:
                median_duration = durations_sorted[n // 2]
        
        return {
            "total": total,
            "success": success,
            "failed": failed,
            "success_rate": success_rate,
            "avg_duration": avg_duration,
            "min_duration": min_duration,
            "max_duration": max_duration,
            "median_duration": median_duration,
        }
    
    def _get_entries_by_period(self, hours: int) -> List[Dict[str, Any]]:
        """
        Obtém entradas dentro de um período específico.
        
        Args:
            hours: Número de horas para trás
        
        Returns:
            Lista de entradas no período
        """
        cutoff = datetime.now() - timedelta(hours=hours)
        
        entries = []
        for entry in self._history:
            try:
                timestamp_str = entry.get("timestamp", "")
                if not timestamp_str:
                    continue
                # Parse timestamp (pode ter ou não timezone)
                timestamp = datetime.fromisoformat(timestamp_str.replace("Z", "+00:00"))
                # Converter para timezone local se necessário
                if timestamp.tzinfo is not None:
                    timestamp = timestamp.replace(tzinfo=None) + (datetime.now() - datetime.utcnow())
                if timestamp >= cutoff:
                    entries.append(entry)
            except (ValueError, AttributeError):
                continue
        return entries
    
    def get_stats_by_period(self, hours: int = 24) -> dict:
        """
        Retorna estatísticas para um período específico.
        
        Args:
            hours: Número de horas para trás (padrão: 24 = hoje)
        
        Returns:
            Dicionário com estatísticas do período
        """
        entries = self._get_entries_by_period(hours)
        
        if not entries:
            return {
                "total": 0,
                "success": 0,
                "failed": 0,
                "success_rate": 0.0,
                "avg_duration": 0.0,
                "period_hours": hours,
            }
        
        total = len(entries)
        success = sum(1 for entry in entries if entry.get("success", False))
        failed = total - success
        success_rate = (success / total) * 100 if total > 0 else 0.0
        durations = [entry.get("duration", 0) for entry in entries]
        avg_duration = sum(durations) / total if durations else 0.0
        
        return {
            "total": total,
            "success": success,
            "failed": failed,
            "success_rate": success_rate,
            "avg_duration": avg_duration,
            "period_hours": hours,
        }
    
    def get_command_breakdown(self) -> Dict[str, Dict[str, Any]]:
        """
        Retorna estatísticas detalhadas por comando.
        
        Returns:
            Dicionário com estatísticas por comando
        """
        if not self._history:
            return {}
        
        # Agrupar por comando
        by_command = defaultdict(list)
        for entry in self._history:
            command = entry.get("command", "unknown")
            by_command[command].append(entry)
        
        breakdown = {}
        for command, entries in by_command.items():
            total = len(entries)
            success = sum(1 for e in entries if e.get("success", False))
            failed = total - success
            durations = [e.get("duration", 0) for e in entries]
            
            breakdown[command] = {
                "count": total,
                "success": success,
                "failed": failed,
                "success_rate": (success / total * 100) if total > 0 else 0.0,
                "avg_duration": sum(durations) / len(durations) if durations else 0.0,
                "min_duration": min(durations) if durations else 0.0,
                "max_duration": max(durations) if durations else 0.0,
            }
        
        return breakdown
    
    def get_top_commands(self, metric: str = "count", limit: int = 5) -> List[tuple]:
        """
        Retorna top comandos por uma métrica específica.
        
        Args:
            metric: Métrica para ordenar ('count', 'avg_duration', 'max_duration', 'failed', 'success_rate')
            limit: Número de comandos a retornar
        
        Returns:
            Lista de tuplas (comando, valor) ordenada
        """
        breakdown = self.get_command_breakdown()
        
        if not breakdown:
            return []
        
        # Determinar função de ordenação
        if metric == "count":
            key_func = lambda x: x[1]["count"]
        elif metric == "avg_duration":
            key_func = lambda x: x[1]["avg_duration"]
        elif metric == "max_duration":
            key_func = lambda x: x[1]["max_duration"]
        elif metric == "failed":
            key_func = lambda x: x[1]["failed"]
        elif metric == "success_rate":
            key_func = lambda x: x[1]["success_rate"]
        else:
            key_func = lambda x: x[1]["count"]
        
        # Ordenar (decrescente para maioria, exceto para success_rate que queremos maior)
        reverse = True  # Sempre decrescente (top = maior valor)
        
        sorted_commands = sorted(breakdown.items(), key=key_func, reverse=reverse)
        
        # Retornar top N
        top = sorted_commands[:limit]
        return top
    
    def get_recent_commands(self, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Retorna comandos mais recentes.
        
        Args:
            limit: Número de comandos a retornar
        
        Returns:
            Lista de comandos ordenados por timestamp (mais recente primeiro)
        """
        if not self._history:
            return []
        
        # Ordenar por timestamp (mais recente primeiro)
        sorted_history = sorted(
            self._history,
            key=lambda x: x.get("timestamp", ""),
            reverse=True
        )
        
        return sorted_history[:limit]
    
    def get_trends(self) -> Dict[str, Any]:
        """
        Retorna análise de tendências comparando períodos.
        
        Returns:
            Dicionário com comparações de tendências
        """
        stats_today = self.get_stats_by_period(24)
        stats_week = self.get_stats_by_period(168)  # 7 dias
        
        # Calcular taxa de mudança
        def calculate_change(current: float, previous: float) -> float:
            if previous == 0:
                return 0.0 if current == 0 else 100.0
            return ((current - previous) / previous) * 100
        
        trends = {
            "today": stats_today,
            "week": stats_week,
            "change": {
                "total": calculate_change(stats_today.get("total", 0), stats_week.get("total", 0)),
                "success_rate": calculate_change(
                    stats_today.get("success_rate", 0),
                    stats_week.get("success_rate", 0)
                ),
                "avg_duration": calculate_change(
                    stats_today.get("avg_duration", 0),
                    stats_week.get("avg_duration", 0)
                ),
            }
        }
        
        return trends


# Instância global do tracker
_tracker: Optional[CommandTracker] = None


def get_tracker() -> CommandTracker:
    """Obtém instância global do tracker"""
    global _tracker
    if _tracker is None:
        _tracker = CommandTracker()
    return _tracker


def track_command(command: str, duration: float, success: bool, error: Optional[str] = None) -> None:
    """
    Rastreia um comando (função de conveniência).
    
    Args:
        command: Nome do comando
        duration: Duração em segundos
        success: Se foi bem-sucedido
        error: Mensagem de erro se falhou
    """
    try:
        tracker = get_tracker()
        tracker.track_command(command, duration, success, error)
        
        # Também registra no coletor de métricas
        from wallethub.analytics.metrics import get_metrics_collector
        metrics = get_metrics_collector()
        metrics.record_command(command, duration, success, error)
    except Exception:
        pass  # Não falhar se tracking der erro

