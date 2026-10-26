"""Verificação e instalação automática de dependências Python"""

import sys
import subprocess
import importlib
from typing import Optional, Tuple, List, Set

# Cache de pacotes já instalados nesta sessão
_AUTO_INSTALLED_PACKAGES: Set[str] = set()

# Dependências essenciais (sempre tentar instalar)
ESSENTIAL_DEPENDENCIES = {
    "typer": "typer",
    "rich": "rich",
    "questionary": "questionary",
    "click": "click",
    "setuptools": "setuptools",
}

# Dependências opcionais (melhoram UX mas não são obrigatórias)
OPTIONAL_DEPENDENCIES = {
    "tenacity": "tenacity",
    "pydantic": "pydantic",
    "dotenv": "python-dotenv",
    "yaml": "pyyaml",
    "requests": "requests",
    "cryptography": "cryptography",
}


def ensure_python_dependency(module_name: str, package_name: Optional[str] = None) -> bool:
    """
    Garante que um módulo Python esteja disponível, instalando via pip se necessário.
    
    Args:
        module_name: Nome do módulo a importar
        package_name: Nome do pacote pip (se diferente do module_name)
    
    Returns:
        True se o módulo puder ser importado após a execução, False caso contrário
    """
    package = package_name or module_name
    
    # Tenta importar primeiro
    try:
        importlib.import_module(module_name)
        return True
    except ImportError:
        pass
    
    # Verifica se já tentou instalar nesta sessão
    pkg_identifier = package.lower()
    if pkg_identifier in _AUTO_INSTALLED_PACKAGES:
        return False
    
    # Marca como tentado
    _AUTO_INSTALLED_PACKAGES.add(pkg_identifier)
    
    print(f"📦 Instalando dependência Python: {package} ...")
    
    try:
        result = subprocess.run(
            [sys.executable, "-m", "pip", "install", package],
            capture_output=True,
            text=True,
            timeout=120,  # 2 minutos de timeout
        )
    except subprocess.TimeoutExpired:
        print(f"❌ Timeout ao instalar {package}")
        return False
    except Exception as error:
        print(f"❌ Falha ao executar pip para {package}: {error}")
        return False
    
    if result.returncode != 0:
        err = (result.stderr or result.stdout or "").strip()
        print(f"❌ Erro ao instalar {package}: {err}")
        if "externally-managed-environment" in err or "PEP 668" in err:
            print(
                "💡 Use o launcher na raiz: `python wallethub.py` (cria tools/cli-py/.venv) "
                "ou ative um venv e `pip install -e tools/cli-py`.",
                file=sys.stderr,
            )
        return False
    
    # Tenta importar novamente
    try:
        importlib.import_module(module_name)
        print(f"✅ Dependência {package} instalada.")
        return True
    except ImportError:
        print(f"❌ Não foi possível importar {module_name} mesmo após instalar {package}.")
        return False


def check_python_dependencies() -> Tuple[List[str], List[str]]:
    """
    Verifica quais dependências Python estão faltando.
    
    Returns:
        Tupla (missing_essential, missing_optional):
        - missing_essential: Lista de dependências essenciais faltando
        - missing_optional: Lista de dependências opcionais faltando
    """
    missing_essential: List[str] = []
    missing_optional: List[str] = []
    
    # Verifica dependências essenciais
    for module, package in ESSENTIAL_DEPENDENCIES.items():
        try:
            importlib.import_module(module)
        except ImportError:
            missing_essential.append(package)
    
    # Verifica dependências opcionais
    for module, package in OPTIONAL_DEPENDENCIES.items():
        try:
            importlib.import_module(module)
        except ImportError:
            missing_optional.append(package)
    
    return missing_essential, missing_optional


def install_missing_packages(packages: List[str]) -> bool:
    """
    Instala pacotes Python faltantes via pip.
    
    Args:
        packages: Lista de nomes de pacotes a instalar
    
    Returns:
        True se todos foram instalados com sucesso, False caso contrário
    """
    if not packages:
        return True
    
    print(f"📦 Instalando {len(packages)} pacote(s) faltante(s)...")
    
    try:
        result = subprocess.run(
            [sys.executable, "-m", "pip", "install"] + packages,
            capture_output=True,
            text=True,
            timeout=300,  # 5 minutos de timeout
        )
    except subprocess.TimeoutExpired:
        print("❌ Timeout ao instalar pacotes")
        return False
    except Exception as error:
        print(f"❌ Falha ao executar pip: {error}")
        return False
    
    if result.returncode != 0:
        err = (result.stderr or result.stdout or "").strip()
        print(f"❌ Erro ao instalar pacotes: {err}")
        if "externally-managed-environment" in err or "PEP 668" in err:
            print(
                "💡 Use o launcher na raiz: `python wallethub.py` (cria tools/cli-py/.venv) "
                "ou ative um venv e `pip install -e tools/cli-py`.",
                file=sys.stderr,
            )
        return False
    
    print("✅ Pacotes instalados com sucesso.")
    return True


def auto_setup() -> bool:
    """
    Configura ambiente automaticamente:
    1. Verifica dependências Python
    2. Instala faltantes via pip
    3. Verifica ferramentas externas
    4. Retorna True se setup foi bem-sucedido
    
    Returns:
        True se setup foi bem-sucedido, False caso contrário
    """
    missing_essential, missing_optional = check_python_dependencies()
    
    # Instala dependências essenciais (obrigatório)
    if missing_essential:
        if not install_missing_packages(missing_essential):
            return False
    
    # Instala dependências opcionais (não bloqueia se falhar)
    if missing_optional:
        install_missing_packages(missing_optional)
    
    # Verifica ferramentas externas (apenas avisos, não bloqueia)
    from wallethub.utils.tools import check_docker, check_node, check_npm
    
    docker_installed, docker_error = check_docker()
    if not docker_installed:
        print(f"⚠️  {docker_error}")
    
    node_installed, node_error = check_node()
    if not node_installed:
        print(f"⚠️  {node_error}")
    
    npm_installed, npm_error = check_npm()
    if not npm_installed:
        print(f"⚠️  {npm_error}")
    
    return True


def auto_repair() -> bool:
    """
    Tenta reparar problemas comuns automaticamente.
    
    Returns:
        True se reparo foi bem-sucedido, False caso contrário
    """
    print("🔧 Tentando reparar problemas automaticamente...")
    
    # Tenta reinstalar dependências essenciais
    missing_essential, _ = check_python_dependencies()
    if missing_essential:
        print("📦 Reinstalando dependências essenciais...")
        if install_missing_packages(missing_essential):
            print("✅ Dependências reparadas.")
            return True
        else:
            print("❌ Não foi possível reparar dependências.")
            return False
    
    print("✅ Nenhum problema detectado que precise de reparo.")
    return True

