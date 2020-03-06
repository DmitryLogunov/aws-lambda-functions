interface ILogger {
  info: ILoggerFunction;
  debug: ILoggerFunction;
  error: ILoggerFunction;
  warn: ILoggerFunction;
}

type ILoggerFunction = (message: string, params?: object, trace?: string[], label?: string) => void;

export default class Logger implements ILogger {
  public info: ILoggerFunction = (message, params = {}, trace = [], label = '') => {
    this.print('info', message, params, trace, label);
  };

  public debug: ILoggerFunction = (message, params = {}, trace = [], label = '') => {
    this.print('debug', message, params, trace, label);
  };

  public error: ILoggerFunction = (message, params = {}, trace = [], label = '') => {
    this.print('error', message, params, trace, label);
  };

  public warn: ILoggerFunction = (message, params = {}, trace = [], label = '') => {
    this.print('warn', message, params, trace, label);
  };

  /**
   * Prints log out
   *
   * @param level
   * @param message
   * @param params
   * @param trace
   * @param label
   */
  private print(level: string, message: string, params: object, trace: string[], label: string) {
    console.log(`${level}: ${message}`);    
  }
}
