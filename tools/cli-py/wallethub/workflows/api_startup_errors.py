"""
Catálogo de erros conhecidos ao arranque da API (logs do container).
Quando "Aguardando API estar pronta" falha, os logs são comparados com estes padrões
para sugerir correções.
"""
import re

# Lista (pattern, suggestion). Pattern é substring ou regex (string).
# Sugestion é texto curto para mostrar ao utilizador.
API_STARTUP_ERROR_CATALOG = [
    (
        "class-validator",
        "Pacote class-validator não encontrado no container. Garantir NODE_PATH=/app/node_modules no CMD e que npm install na raiz inclui as dependências da API.",
    ),
    (
        "No driver (HTTP)",
        "Driver HTTP (platform-express) não encontrado. Garantir NODE_PATH no container e que @nestjs/platform-express está instalado; ou passar ExpressAdapter explicitamente em main.ts.",
    ),
    (
        "platform-express",
        "Pacote @nestjs/platform-express não resolvido. Definir NODE_PATH=/app/node_modules no ambiente do container e executar npm install na raiz do repo.",
    ),
    (
        "PackageLoader",
        "Nest não conseguiu carregar um pacote (ValidationPipe, HTTP adapter, etc.). Verificar que NODE_PATH inclui o node_modules onde as dependências estão instaladas.",
    ),
]


def match_api_startup_errors(log_text: str) -> list[tuple[str, str]]:
    """
    Compara log_text com o catálogo e devolve lista de (detected_pattern, suggestion).
    """
    if not log_text:
        return []
    matched = []
    for pattern, suggestion in API_STARTUP_ERROR_CATALOG:
        try:
            if re.search(pattern, log_text, re.IGNORECASE):
                matched.append((pattern, suggestion))
        except re.error:
            if pattern in log_text:
                matched.append((pattern, suggestion))
    return matched
