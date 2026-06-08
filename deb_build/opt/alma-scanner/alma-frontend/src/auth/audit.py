from .models import AuditLog

def audit_log(db, user_id: int, action: str, resource: str):
    db.add(AuditLog(user_id=user_id, action=action, resource=resource))
    db.commit()
