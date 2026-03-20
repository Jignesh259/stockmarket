from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
import asyncio

from .routes.stocks import router as stocks_router
from .services.scheduler_service import start_scheduler
from .db import init_db

from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from .routes.stocks import limiter

app = FastAPI(
    title="Indian Stock Prediction API",
    version="0.1.0"
)

# ✅ CORS CONFIGURATION (FIXED)
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://stockmarket-25.onrender.com",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,              # Allowed frontend domains
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],  # Explicit methods
    allow_headers=["*"],
    expose_headers=["*"],
)

# ✅ EXCEPTION LOGGING MIDDLEWARE
@app.middleware("http")
async def log_exceptions(request: Request, call_next):
    try:
        return await call_next(request)
    except Exception as e:
        import traceback
        print(f"❌ BACKEND ERROR: {str(e)}")
        traceback.print_exc()
        from fastapi.responses import JSONResponse
        return JSONResponse(
            status_code=500,
            content={"detail": f"Internal Server Error: {str(e)}"}
        )

# ✅ RATE LIMITER SETUP
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ✅ ROUTES
app.include_router(stocks_router, prefix="/api")

# ✅ STARTUP EVENTS
@app.on_event("startup")
async def on_startup() -> None:
    init_db()
    asyncio.create_task(start_scheduler())

# ✅ HEALTH CHECK
@app.get("/health")
async def health():
    return {"status": "ok"}

# ✅ LOCAL RUN
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=19099, reload=True)