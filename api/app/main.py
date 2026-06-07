"""FastAPI application entry point."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import get_settings, init_app_config
from app.core.exceptions import AppError
from app.database.session import init_engine
from app.routers.v1 import router as v1_router
from app.schemas.errors import ErrorBody, ErrorCode, ErrorDetail, ErrorResponse

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    init_app_config(settings.config_path)
    init_engine(settings.database_url)
    yield


def create_app() -> FastAPI:
    app = FastAPI(title="Cuebox API", lifespan=lifespan)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(v1_router, prefix="/api/v1")

    @app.exception_handler(AppError)
    async def app_error_handler(_request: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content=ErrorResponse(
                error=ErrorBody(
                    code=exc.code,
                    message=exc.message,
                    details=exc.details,
                )
            ).model_dump(),
        )

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(
        _request: Request,
        exc: RequestValidationError,
    ) -> JSONResponse:
        details = [
            ErrorDetail(
                field=".".join(str(part) for part in err["loc"]),
                message=err["msg"],
            )
            for err in exc.errors()
        ]
        return JSONResponse(
            status_code=400,
            content=ErrorResponse(
                error=ErrorBody(
                    code=ErrorCode.VALIDATION_ERROR,
                    message="Request validation failed",
                    details=details,
                )
            ).model_dump(),
        )

    @app.exception_handler(HTTPException)
    async def http_exception_handler(
        _request: Request,
        exc: HTTPException,
    ) -> JSONResponse:
        if exc.status_code == 404:
            code = ErrorCode.NOT_FOUND
        elif exc.status_code == 409:
            code = ErrorCode.CONFLICT
        else:
            code = ErrorCode.INTERNAL_ERROR

        message = exc.detail if isinstance(exc.detail, str) else "Request failed"
        return JSONResponse(
            status_code=exc.status_code,
            content=ErrorResponse(
                error=ErrorBody(code=code, message=message)
            ).model_dump(),
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(
        _request: Request,
        exc: Exception,
    ) -> JSONResponse:
        logger.exception("Unhandled exception", exc_info=exc)
        return JSONResponse(
            status_code=500,
            content=ErrorResponse(
                error=ErrorBody(
                    code=ErrorCode.INTERNAL_ERROR,
                    message="An unexpected error occurred",
                )
            ).model_dump(),
        )

    return app


app = create_app()
