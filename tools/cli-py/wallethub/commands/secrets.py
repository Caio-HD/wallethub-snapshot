"""Comando secrets - Gerenciamento de segredos"""

import os
from pathlib import Path
from datetime import datetime
from typing import List
from urllib.parse import quote

import typer
from typer import Typer
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization

from wallethub.context import MenuContext
from wallethub.config import JWT_DEFAULT_BITS, JWT_DEFAULT_KEEP_HISTORY

app = Typer(name="secrets", help="Utilidades para geração e manutenção de segredos locais")


def build_timestamp() -> str:
    """Gera timestamp no formato YYYYMMDDHHMMSS"""
    now = datetime.utcnow()
    return f"{now.year}{now.month:02d}{now.day:02d}{now.hour:02d}{now.minute:02d}{now.second:02d}"


def generate_rsa_pair(bits: int) -> tuple[str, str]:
    """
    Gera par de chaves RSA.
    
    Returns:
        Tupla (private_key, public_key) em formato PEM
    """
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=bits)
    
    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    ).decode("utf-8")
    
    public_key = private_key.public_key()
    public_pem = public_key.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    ).decode("utf-8")
    
    return private_pem, public_pem


def prune_history(history_dir: Path, keep: int) -> None:
    """Remove arquivos antigos do histórico, mantendo apenas os últimos N pares"""
    if not history_dir.exists():
        return
    
    entries = list(history_dir.iterdir())
    if len(entries) <= keep * 2:
        return
    
    # Ordena por data de modificação
    files_with_mtime = [(f, f.stat().st_mtime) for f in entries if f.is_file()]
    files_with_mtime.sort(key=lambda x: x[1], reverse=True)
    
    # Remove os mais antigos (mantém apenas keep * 2, que são keep pares)
    to_remove = files_with_mtime[keep * 2:]
    for file_path, _ in to_remove:
        try:
            file_path.unlink()
        except Exception:
            pass


@app.command()
def jwt(
    ctx: typer.Context,
    target: str = typer.Option("secrets/jwt", "--target", help="Diretório para armazenar chaves"),
    bits: int = typer.Option(JWT_DEFAULT_BITS, "--bits", help="Tamanho da chave RSA (mínimo 2048)"),
    keep: int = typer.Option(JWT_DEFAULT_KEEP_HISTORY, "--keep", help="Quantidade de pares históricos a manter"),
    dry_run: bool = typer.Option(False, "--dry-run", help="Simula operação sem gerar arquivos"),
) -> None:
    """Gera/rotaciona chaves JWT RS256 e exporta variáveis de ambiente"""
    menu_ctx: MenuContext = ctx.obj
    
    bits = max(bits, 2048)
    keep = max(keep, 1)
    
    target_dir = menu_ctx.resolve_project_path(*Path(target).parts)
    history_dir = target_dir / "history"
    private_key_path = target_dir / "jwt_private.pem"
    public_key_path = target_dir / "jwt_public.pem"
    env_path = target_dir / ".env.jwt"
    
    if dry_run:
        print("🧪 Simulação ativada. Nenhum arquivo será modificado.\n")
    
    print(f"📁 Diretório das chaves: {target_dir.relative_to(menu_ctx.project_root) if target_dir.is_relative_to(menu_ctx.project_root) else target_dir}")
    print(f"🔐 Tamanho das chaves RSA: {bits} bits")
    
    if not dry_run:
        history_dir.mkdir(parents=True, exist_ok=True)
    
    timestamp = build_timestamp()
    archived: List[Path] = []
    
    # Arquivar chaves existentes
    if private_key_path.exists():
        destination = history_dir / f"jwt_private_{timestamp}.pem"
        if not dry_run:
            private_key_path.rename(destination)
        archived.append(destination)
    
    if public_key_path.exists():
        destination = history_dir / f"jwt_public_{timestamp}.pem"
        if not dry_run:
            public_key_path.rename(destination)
        archived.append(destination)
    
    # Gerar novo par
    if dry_run:
        private_key = f"-----BEGIN PRIVATE KEY-----\nSIMULATED-{bits}\n-----END PRIVATE KEY-----\n"
        public_key = f"-----BEGIN PUBLIC KEY-----\nSIMULATED-{bits}\n-----END PUBLIC KEY-----\n"
    else:
        private_key, public_key = generate_rsa_pair(bits)
    
    if not dry_run:
        # Salvar chaves
        private_key_path.write_text(private_key, encoding="utf-8")
        private_key_path.chmod(0o600)

        public_key_path.write_text(public_key, encoding="utf-8")
        public_key_path.chmod(0o600)
        
        # Gerar arquivo .env
        sanitize = lambda v: v.replace("\r\n", "\\n").replace("\n", "\\n")
        env_content = [
            "# Arquivo gerado automaticamente por wallethub secrets jwt",
            f'JWT_PRIVATE_KEY="{sanitize(private_key)}"',
            f'JWT_PUBLIC_KEY="{sanitize(public_key)}"',
            "",
        ]
        env_path.write_text("\n".join(env_content), encoding="utf-8")
        
        # Limpar histórico antigo
        prune_history(history_dir, keep)
    
    print("\n✅ Chaves atualizadas com sucesso:")
    rel_private = private_key_path.relative_to(menu_ctx.project_root) if private_key_path.is_relative_to(menu_ctx.project_root) else private_key_path
    rel_public = public_key_path.relative_to(menu_ctx.project_root) if public_key_path.is_relative_to(menu_ctx.project_root) else public_key_path
    rel_env = env_path.relative_to(menu_ctx.project_root) if env_path.is_relative_to(menu_ctx.project_root) else env_path
    
    print(f"   • Chave privada: {rel_private}")
    print(f"   • Chave pública: {rel_public}")
    print(f"   • Export .env:   {rel_env}")
    
    if archived:
        print("\n📦 Histórico mantido:")
        for entry in archived:
            rel_entry = entry.relative_to(menu_ctx.project_root) if entry.is_relative_to(menu_ctx.project_root) else entry
            print(f"   - {rel_entry}")


@app.command()
def validate(
    ctx: typer.Context,
    env_file: str = typer.Option(None, "--env-file", help="Arquivo .env para validar (padrão: lê de os.environ)"),
    strict: bool = typer.Option(False, "--strict", help="Falha se encontrar valores inseguros"),
) -> None:
    """Valida variáveis de ambiente e detecta valores inseguros"""
    menu_ctx: MenuContext = ctx.obj
    
    env: dict[str, str] = {}
    
    # Carregar variáveis de ambiente
    if env_file:
        from pathlib import Path
        env_path = menu_ctx.resolve_project_path(*Path(env_file).parts) if not Path(env_file).is_absolute() else Path(env_file)
        try:
            with env_path.open("r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        key, value = line.split("=", 1)
                        # Remove aspas se presentes
                        value = value.strip('"\'')
                        env[key.strip()] = value
        except Exception as e:
            print(f"❌ Erro ao ler arquivo {env_file}: {e}")
            raise typer.Exit(1)
    else:
        env = dict(os.environ)
    
    print("🔍 Validando variáveis de ambiente...\n")
    
    # Valores padrão inseguros
    unsafe_defaults = [
        "change_me", "changeme", "dummy", "test", "password", "secret",
        "admin", "123456", "default", "example", "localhost", "127.0.0.1",
    ]
    
    errors: list[dict[str, str]] = []
    warnings: list[dict[str, str]] = []
    
    # Variáveis obrigatórias
    required_vars = [
        {"name": "JWT_PRIVATE_KEY", "description": "Chave privada JWT"},
        {"name": "JWT_PUBLIC_KEY", "description": "Chave pública JWT"},
    ]
    
    # Verificar variáveis obrigatórias
    for var_info in required_vars:
        name = var_info["name"]
        description = var_info["description"]
        value = env.get(name, "")
        if not value or value.strip() == "":
            errors.append({
                "variable": name,
                "message": f"{description} ({name}) é obrigatória mas não está definida",
            })
        elif any(unsafe in value.lower() for unsafe in unsafe_defaults):
            warnings.append({
                "variable": name,
                "message": f"{name} contém valor padrão inseguro: \"{value[:20]}...\"",
            })
    
    # Verificar conexão de banco de dados
    has_database_url = bool(env.get("DATABASE_URL"))
    has_db_vars = bool(env.get("DB_HOST") and env.get("DB_USER") and env.get("DB_PASSWORD") and env.get("DB_NAME"))
    if not has_database_url and not has_db_vars:
        errors.append({
            "variable": "DATABASE_URL ou DB_*",
            "message": "Conexão de banco de dados não configurada (use DATABASE_URL ou DB_HOST/DB_USER/DB_PASSWORD/DB_NAME)",
        })
    
    # Verificar conexão Redis
    has_redis_url = bool(env.get("REDIS_URL"))
    has_redis_vars = bool(env.get("REDIS_HOST") or env.get("REDIS_PORT"))
    if not has_redis_url and not has_redis_vars:
        warnings.append({
            "variable": "REDIS_URL ou REDIS_*",
            "message": "Conexão Redis não configurada (opcional, mas necessário para filas)",
        })
    
    # Verificar valores inseguros em variáveis sensíveis
    sensitive_vars = [
        "DB_PASSWORD", "REDIS_PASSWORD", "JWT_PRIVATE_KEY", "JWT_PUBLIC_KEY",
        "META_APP_SECRET", "WHATSAPP_ACCESS_TOKEN", "OPENAI_API_KEY",
    ]
    
    for var_name in sensitive_vars:
        value = env.get(var_name, "")
        if value:
            lower_value = value.lower()
            if any(unsafe in lower_value for unsafe in unsafe_defaults):
                warnings.append({
                    "variable": var_name,
                    "message": f"{var_name} contém valor padrão inseguro",
                })
    
    # Verificar formato de URLs
    if env.get("DATABASE_URL") and not env["DATABASE_URL"].startswith(("postgres://", "postgresql://")):
        warnings.append({
            "variable": "DATABASE_URL",
            "message": "DATABASE_URL não parece ser uma URL PostgreSQL válida",
        })
    
    if env.get("REDIS_URL") and not env["REDIS_URL"].startswith(("redis://", "rediss://")):
        warnings.append({
            "variable": "REDIS_URL",
            "message": "REDIS_URL não parece ser uma URL Redis válida",
        })
    
    # Verificar formato de chaves JWT
    if env.get("JWT_PRIVATE_KEY") and "BEGIN" not in env["JWT_PRIVATE_KEY"]:
        warnings.append({
            "variable": "JWT_PRIVATE_KEY",
            "message": "JWT_PRIVATE_KEY não parece estar no formato PEM",
        })
    
    if env.get("JWT_PUBLIC_KEY") and "BEGIN" not in env["JWT_PUBLIC_KEY"]:
        warnings.append({
            "variable": "JWT_PUBLIC_KEY",
            "message": "JWT_PUBLIC_KEY não parece estar no formato PEM",
        })
    
    # Exibir resultados
    if not errors and not warnings:
        print("✅ Todas as variáveis de ambiente estão configuradas corretamente!\n")
        return
    
    if errors:
        print("❌ Erros encontrados:\n")
        for error in errors:
            print(f"   • {error['variable']}: {error['message']}")
        print()
    
    if warnings:
        print("⚠️  Avisos encontrados:\n")
        for warning in warnings:
            print(f"   • {warning['variable']}: {warning['message']}")
        print()
    
    exit_code = 1 if (errors or (strict and warnings)) else 0
    if exit_code == 0:
        print("✅ Validação concluída (com avisos)")
    else:
        print("❌ Validação falhou")
    
    raise typer.Exit(exit_code)


