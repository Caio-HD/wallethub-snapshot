"""Configuração robusta de encoding UTF-8"""

import os
import sys
import subprocess
from typing import Optional
from wallethub.utils.platform import is_windows


def configure_utf8_encoding() -> None:
    """
    Configura stdout e stderr para UTF-8 com fallback gracioso.
    Reconfigura streams se possível, caso contrário mantém encoding padrão.
    No Windows, também configura o code page do PowerShell para UTF-8.
    """
    try:
        if hasattr(sys.stdout, "reconfigure"):
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        if hasattr(sys.stderr, "reconfigure"):
            sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        # Se falhar, continua com encoding padrão
        # Não deve bloquear a execução
        pass
    
    # Configurar code page UTF-8 no Windows/PowerShell quando possível
    if is_windows():
        try:
            # Tentar configurar code page para UTF-8 (65001)
            # Isso funciona melhor no PowerShell Core e Windows Terminal
            if sys.stdout.isatty():
                # Chcp 65001 define code page para UTF-8
                # Executa silenciosamente sem mostrar output
                subprocess.run(
                    ["chcp", "65001"],
                    shell=True,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                    timeout=1,
                )
        except Exception:
            # Se falhar, continua normalmente
            # Não deve bloquear a execução
            pass


def safe_encode(text: str, encoding: str = "utf-8") -> bytes:
    """
    Codifica texto de forma segura com fallback.
    
    Args:
        text: Texto a codificar
        encoding: Encoding a usar (padrão: utf-8)
    
    Returns:
        Bytes codificados
    """
    try:
        return text.encode(encoding)
    except UnicodeEncodeError:
        # Fallback para ASCII com substituição de caracteres problemáticos
        return text.encode("ascii", errors="replace")


def safe_decode(data: bytes, encoding: str = "utf-8") -> str:
    """
    Decodifica bytes de forma segura com fallback.
    
    Args:
        data: Bytes a decodificar
        encoding: Encoding a usar (padrão: utf-8)
    
    Returns:
        String decodificada
    """
    try:
        return data.decode(encoding)
    except UnicodeDecodeError:
        # Fallback para ASCII com substituição de caracteres problemáticos
        return data.decode("ascii", errors="replace")

