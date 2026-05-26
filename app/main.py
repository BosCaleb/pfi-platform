from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base
from app.routers import auth, members, assessments, progress, workout_plans, nutrition_plans, supplement_plans, dashboard

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="CyberFit Intelligence Platform API",
    description="Backend for the CyberFit fitness intelligence and coaching platform.",
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

@app.get("/")
def root():
    return {"message": "CyberFit Intelligence Platform API", "docs": "/docs", "redoc": "/redoc"}
