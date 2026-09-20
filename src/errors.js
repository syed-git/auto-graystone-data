/** Thrown when the request body cannot be turned into an AutoGraystone data set. */
export class ValidationError extends Error {
  constructor(details) {
    const list = Array.isArray(details) ? details : [details];
    super(list.length === 1 ? `${list[0].path}: ${list[0].message}` : `${list.length} validation errors`);
    this.name = 'ValidationError';
    this.status = 400;
    this.details = list;
  }
}
