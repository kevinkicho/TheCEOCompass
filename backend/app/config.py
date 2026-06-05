from pydantic_settings import BaseSettings
from pydantic import Field
from typing import Optional
import socket


class Settings(BaseSettings):
    database_url: str = Field(
        default="postgresql+asyncpg://ceo_user:ceo_password@localhost:5432/ceo_platform",
        alias="DATABASE_URL"
    )
    redis_url: str = Field(default="redis://localhost:6379/0", alias="REDIS_URL")
    
    openai_api_key: Optional[str] = Field(default=None, alias="OPENAI_API_KEY")
    anthropic_api_key: Optional[str] = Field(default=None, alias="ANTHROPIC_API_KEY")
    llm_provider: str = Field(default="openai", alias="LLM_PROVIDER")
    llm_model: str = Field(default="gpt-4o", alias="LLM_MODEL")
    
    secret_key: str = Field(default="dev-secret-change-in-production", alias="SECRET_KEY")
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30 * 24 * 60
    
    environment: str = Field(default="development", alias="ENVIRONMENT")
    api_prefix: str = "/api"
    
    cors_origins: list[str] = []

    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()

# Auto-detect all local origins (localhost, 127.0.0.1, WSL IPs)
_local_origins = [
    "http://localhost:33221",
    "http://127.0.0.1:33221",
    "http://localhost:50128",
    "http://127.0.0.1:50128",
]

# Add WSL IPs
try:
    hostname = socket.gethostname()
    ips = socket.gethostbyname_ex(hostname)[2]
    for ip in ips:
        if ip.startswith("172.") or ip.startswith("192.168."):
            _local_origins.append(f"http://{ip}:3000")
            _local_origins.append(f"http://{ip}:8000")
except Exception:
    pass

settings.cors_origins = _local_origins