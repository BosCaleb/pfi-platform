from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import inspect, text
from app.database import engine, Base
from app.routers import auth, members, assessments, progress, workout_plans, nutrition_plans, supplement_plans, dashboard, settings


def ensure_member_consent_columns():
    inspector = inspect(engine)
    if "members" not in inspector.get_table_names():
        return
    columns = {column["name"] for column in inspector.get_columns("members")}
    statements = {
        "privacy_consent": "ALTER TABLE members ADD COLUMN privacy_consent BOOLEAN DEFAULT false",
        "medical_disclaimer_accepted": "ALTER TABLE members ADD COLUMN medical_disclaimer_accepted BOOLEAN DEFAULT false",
        "marketing_consent": "ALTER TABLE members ADD COLUMN marketing_consent BOOLEAN DEFAULT false",
        "consent_signed_at": "ALTER TABLE members ADD COLUMN consent_signed_at TIMESTAMP",
    }
    with engine.begin() as connection:
        for column, statement in statements.items():
            if column not in columns:
                connection.execute(text(statement))

Base.metadata.create_all(bind=engine)
ensure_member_consent_columns()

app = FastAPI(
    title="Personalized Fitness Intelligence Platform API",
    description="Backend for the PFI Platform fitness intelligence and personalization system.",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(members.router)
app.include_router(assessments.router)
app.include_router(progress.router)
app.include_router(workout_plans.router)
app.include_router(nutrition_plans.router)
app.include_router(supplement_plans.router)
app.include_router(dashboard.router)
app.include_router(settings.router)
app.mount("/ui", StaticFiles(directory="app/static", html=True), name="ui")

@app.get("/")
def root():
    return {"message": "Personalized Fitness Intelligence Platform API", "short_name": "PFI Platform", "docs": "/docs", "redoc": "/redoc", "ui": "/ui"}
