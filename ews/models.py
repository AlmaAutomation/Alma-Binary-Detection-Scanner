# almasysdet/ews/models.py

from datetime import datetime
from pydantic import BaseModel
from typing import Dict


class EWSEvent(BaseModel):
    id: str
    timestamp: datetime
    category: str
    severity: str
    source: str
    metrics: Dict
    message: str
    acknowledged: bool = False
