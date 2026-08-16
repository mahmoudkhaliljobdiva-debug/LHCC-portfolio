export type ServerErrorCode =
  | "VALIDATION_ERROR"
  | "AUTHENTICATION_FAILED"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "ACCOUNT_INACTIVE"
  | "ACCOUNT_EXPIRED"
  | "PROFILE_MISSING"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INTERNAL_ERROR";

export interface ServerError {
  readonly code: ServerErrorCode;
  readonly message: string;
  readonly fieldErrors?: Readonly<Record<string, readonly string[]>>;
}

export type ServerResult<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly error: ServerError };
