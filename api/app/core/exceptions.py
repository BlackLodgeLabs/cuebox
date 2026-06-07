"""Application exception types and factory helpers."""

from app.schemas.errors import ErrorCode, ErrorDetail


class AppError(Exception):
    def __init__(
        self,
        code: ErrorCode,
        message: str,
        status_code: int,
        details: list[ErrorDetail] | None = None,
    ) -> None:
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details
        super().__init__(message)


def not_found(resource: str) -> AppError:
    return AppError(
        code=ErrorCode.NOT_FOUND,
        message=f"{resource} not found",
        status_code=404,
    )


def validation_error(
    message: str,
    details: list[ErrorDetail] | None = None,
) -> AppError:
    return AppError(
        code=ErrorCode.VALIDATION_ERROR,
        message=message,
        status_code=400,
        details=details,
    )
