from __future__ import annotations

import json
import sqlite3
from datetime import datetime
from typing import Any, Dict, List, Optional

from app.core.database import get_connection


def init_execution_history():
    with get_connection() as conn:
        conn.execute("""
        CREATE TABLE IF NOT EXISTS execution_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,

            timestamp TEXT NOT NULL,

            file_path TEXT,
            file_name TEXT,
            file_hash TEXT,

            runtime TEXT,
            architecture TEXT,
            installer_type TEXT,

            command TEXT,

            success INTEGER,
            exit_code INTEGER,

            detected_error TEXT,
            remediation_applied TEXT,

            stdout TEXT,
            stderr TEXT,

            telemetry_snapshot TEXT,

            metadata TEXT
        )
        """)
        conn.commit()


def add_execution_record(
    *,
    file_path: str,
    runtime: str,
    success: bool,
    exit_code: Optional[int] = None,
    architecture: Optional[str] = None,
    installer_type: Optional[str] = None,
    detected_error: Optional[str] = None,
    remediation_applied: Optional[str] = None,
    stdout: Optional[str] = None,
    stderr: Optional[str] = None,
    telemetry_snapshot: Optional[Dict[str, Any]] = None,
    metadata: Optional[Dict[str, Any]] = None,
    command: Optional[List[str]] = None,
    file_hash: Optional[str] = None,
):
    with get_connection() as conn:
        conn.execute("""
        INSERT INTO execution_history (
            timestamp,
            file_path,
            file_name,
            file_hash,
            runtime,
            architecture,
            installer_type,
            command,
            success,
            exit_code,
            detected_error,
            remediation_applied,
            stdout,
            stderr,
            telemetry_snapshot,
            metadata
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            datetime.utcnow().isoformat(),

            file_path,
            file_path.split("/")[-1],
            file_hash,

            runtime,
            architecture,
            installer_type,

            json.dumps(command or []),

            int(success),
            exit_code,

            detected_error,
            remediation_applied,

            stdout,
            stderr,

            json.dumps(telemetry_snapshot or {}),
            json.dumps(metadata or {}),
        ))

        conn.commit()


def get_recent_execution_history(limit: int = 50):
    with get_connection() as conn:
        rows = conn.execute("""
        SELECT *
        FROM execution_history
        ORDER BY id DESC
        LIMIT ?
        """, (limit,)).fetchall()

    return [dict(row) for row in rows]


def get_execution_failures(limit: int = 50):
    with get_connection() as conn:
        rows = conn.execute("""
        SELECT *
        FROM execution_history
        WHERE success = 0
        ORDER BY id DESC
        LIMIT ?
        """, (limit,)).fetchall()

    return [dict(row) for row in rows]


def get_error_statistics():
    with get_connection() as conn:
        rows = conn.execute("""
        SELECT detected_error, COUNT(*) as count
        FROM execution_history
        GROUP BY detected_error
        ORDER BY count DESC
        """).fetchall()

    return [dict(row) for row in rows]
