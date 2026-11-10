// Errors thrown by the different functions in the engine that aren't yet implemented.
export class NotImplementedError extends Error {
  constructor(functionName: string) {
    super(`${functionName} is not implemented yet`);
    this.name = 'NotImplementedError';
  }
}