"""Home Assistant Adapter.

Jediná vrstva produktu, která zná konkrétní Home Assistant API.
Nikde jinde v kódu nesmí být HA WebSocket command.
"""

from .client import HaClient, HaCommandError

__all__ = ["HaClient", "HaCommandError"]
