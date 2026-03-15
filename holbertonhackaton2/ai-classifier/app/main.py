from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.controllers import classify_controller, health_controller
from app.services.classifier_service import ClassifierService


@asynccontextmanager
async def lifespan(app: FastAPI):
    classifier = ClassifierService()
    classifier.load_models("ml_models")
    app.state.classifier = classifier
    yield


app = FastAPI(
    title="AI Classifier",
    description="Network traffic classification service",
    version="1.0.0",
    lifespan=lifespan,
)

app.include_router(classify_controller.router)
app.include_router(health_controller.router)
