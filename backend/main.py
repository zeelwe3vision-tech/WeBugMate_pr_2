from fastapi import FastAPI
# from security.fastapi_routes import router as auth_router
from security import router as auth_router
from routers.chat_routes import router as chat_router
from routers.user_routes import router as user_router
from routers.work_routes import router as work_router
from routers.dual_routes import router as dual_router
from routers.llm_routes import router as llm_router
from routers.announcements_routes import router as announcement_router
from routers.feedback_routes import chat_feedback_router, general_feedback_router
from routers.broadcast_routes import router as broadcast_router
from routers.task_routes import router as task_router
from routers.project_routes import router as project_router
from routers.chat_id_routes import router as chat_id_router
from routers.records_routes import router as records_router
from routers import session
from fastapi.middleware.cors import CORSMiddleware
from fastapi import Request

origins = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:8000",
    "http://127.0.0.1:5173",
    
]

app = FastAPI()

@app.middleware("http")
async def log_requests(request: Request, call_next):
    if request.method == "OPTIONS":
        print(f"OPTIONS request to {request.url}")
        print("Origin:", request.headers.get("origin"))
        print("Access-Control-Request-Method:", request.headers.get("access-control-request-method"))
    response = await call_next(request)
    return response

# Move middleware to be the first thing added to app
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins, 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(auth_router)
app.include_router(chat_router)
app.include_router(user_router)
app.include_router(work_router)
app.include_router(dual_router)
app.include_router(llm_router)
app.include_router(announcement_router)
app.include_router(chat_feedback_router)
app.include_router(general_feedback_router)
app.include_router(broadcast_router)
app.include_router(task_router)
app.include_router(project_router)
app.include_router(chat_id_router)
app.include_router(session.router)
app.include_router(records_router)

@app.get("/")
def health():
    return {"status": "FastAPI running"}
