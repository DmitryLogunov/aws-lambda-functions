interface IErrorInfo {
  code: number;
  message: string;
}

export default class ApplicationError extends Error {
  public statusCode: number;

  constructor(errorInfo: IErrorInfo) {
    super(errorInfo.message);
    this.statusCode = errorInfo.code;
  }
}
