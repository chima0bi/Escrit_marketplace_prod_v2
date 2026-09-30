// Express 4 does not catch rejected promises from async handlers. Wrapping
// every async route sends thrown errors (including AppError) to the error
// handler instead of hanging the request or crashing the process.
export function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
