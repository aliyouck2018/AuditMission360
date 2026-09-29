from fastapi import FastAPI

app = FastAPI(
    title="AuditMission360 API",
    description="API stateless du démonstrateur AuditMission360.",
    version="0.1.0",
)


@app.get("/health", tags=["health"])
def health_check() -> dict[str, str]:
    """Indique que l'API de démonstration est disponible."""
    return {"status": "ok"}
