"""Logging estruturado para a CLI WalletHub"""

import logging
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, Any
import json


class StructuredFormatter(logging.Formatter):
    """Formatter que gera logs estruturados em JSON"""
    
    def format(self, record: logging.LogRecord) -> str:
        """Formata log como JSON estruturado"""
        log_data: Dict[str, Any] = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        
        # Adiciona campos extras se existirem
        if hasattr(record, "command"):
            log_data["command"] = record.command
        if hasattr(record, "duration"):
            log_data["duration"] = record.duration
        if hasattr(record, "success"):
            log_data["success"] = record.success
        if hasattr(record, "error"):
            log_data["error"] = record.error
        
        # Adiciona informações de exceção se existirem
        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)
        
        return json.dumps(log_data, ensure_ascii=False)


class ConsoleFormatter(logging.Formatter):
    """Formatter para output no console (legível por humanos)"""
    
    COLORS = {
        "DEBUG": "\033[36m",      # Cyan
        "INFO": "\033[32m",       # Green
        "WARNING": "\033[33m",    # Yellow
        "ERROR": "\033[31m",      # Red
        "CRITICAL": "\033[35m",   # Magenta
    }
    RESET = "\033[0m"
    
    def format(self, record: logging.LogRecord) -> str:
        """Formata log para console"""
        level = record.levelname
        color = self.COLORS.get(level, "")
        reset = self.RESET if color else ""
        
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        message = record.getMessage()
        
        # Formato: [timestamp] LEVEL: message
        return f"{color}[{timestamp}] {level}:{reset} {message}"


def setup_logging(
    log_file: Optional[Path] = None,
    level: str = "INFO",
    structured: bool = False,
    console: bool = True,
) -> logging.Logger:
    """
    Configura logging para a CLI.
    
    Args:
        log_file: Arquivo para salvar logs (opcional)
        level: Nível de log (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        structured: Se True, usa formato JSON estruturado
        console: Se True, também loga no console
    
    Returns:
        Logger configurado
    """
    logger = logging.getLogger("wallethub")
    logger.setLevel(getattr(logging, level.upper()))
    
    # Remove handlers existentes
    logger.handlers.clear()
    
    # Handler para console
    if console:
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setLevel(getattr(logging, level.upper()))
        console_formatter = ConsoleFormatter()
        console_handler.setFormatter(console_formatter)
        logger.addHandler(console_handler)
    
    # Handler para arquivo (se especificado)
    if log_file:
        log_file.parent.mkdir(parents=True, exist_ok=True)
        file_handler = logging.FileHandler(log_file, encoding="utf-8")
        file_handler.setLevel(getattr(logging, level.upper()))
        
        if structured:
            file_formatter = StructuredFormatter()
        else:
            file_formatter = logging.Formatter(
                "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
            )
        
        file_handler.setFormatter(file_formatter)
        logger.addHandler(file_handler)
    
    return logger


def get_logger(name: str = "wallethub") -> logging.Logger:
    """
    Obtém um logger configurado.
    
    Args:
        name: Nome do logger
    
    Returns:
        Logger
    """
    return logging.getLogger(name)


def log_command(
    logger: logging.Logger,
    command: str,
    duration: float,
    success: bool,
    error: Optional[str] = None,
) -> None:
    """
    Registra execução de um comando.
    
    Args:
        logger: Logger a usar
        command: Comando executado
        duration: Duração em segundos
        success: Se o comando foi bem-sucedido
        error: Mensagem de erro (se houver)
    """
    extra = {
        "command": command,
        "duration": duration,
        "success": success,
    }
    
    if error:
        extra["error"] = error
    
    if success:
        logger.info(f"Comando executado: {command} ({duration:.2f}s)", extra=extra)
    else:
        logger.error(f"Comando falhou: {command} ({duration:.2f}s) - {error}", extra=extra)

