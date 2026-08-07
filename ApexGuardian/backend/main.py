from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from core.config import settings
from api.v1.endpoints import router as api_v1_router

app = FastAPI(title="Apex Guardian Navigation Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_v1_router, prefix=settings.API_V1_STR)

@app.get("/")
async def root():
    return {
        "message": "Welcome to Apex Guardian Navigation Engine API",
        "docs": "/docs",
        "health": f"{settings.API_V1_STR}/health",
        "search": f"{settings.API_V1_STR}/search?q=Indiranagar"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

