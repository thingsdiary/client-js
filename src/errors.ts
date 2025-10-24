export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public errorCode?: string,
    public errorReason?: string
  ) {
    super(
      `API Error (${statusCode}): ${errorCode || "Unknown"} - ${
        errorReason || ""
      }`
    );
    this.name = "ApiError";
  }
}
