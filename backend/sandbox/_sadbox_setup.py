from dataclasses import dataclass, field


@dataclass(frozen=True)
class SandboxConfig:
    image: str = "python:3.12-slim"
    mem_limit: str = "512m"          
    nano_cpus: int = 500_000_000     
    pids_limit: int = 128            
    network_disabled: bool = True    
    timeout_sec: int = 60            
    workdir: str = "/workspace"      

DEFAULT_CONFIG = SandboxConfig()
