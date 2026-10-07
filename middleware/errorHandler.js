export function notFound(req, res, next) {
  res.status(404).json({ message: `Not found - ${req.originalUrl}` });
}

export function errorHandler(err, req, res, next) {
  console.error(err);
  let status = res.statusCode && res.statusCode !== 200 ? res.statusCode : 500;
  // Allow errors to carry their own status (e.g. OTP helper).
  if (err.status) status = err.status;
  res.status(status).json({
    message: err.message || "Server error",
  });
}
