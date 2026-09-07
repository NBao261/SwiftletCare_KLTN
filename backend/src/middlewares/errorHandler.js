'use strict';
/** Error Handler Middleware */
const logger = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
  logger.error({ err, path: req.path, method: req.method });

  if (err.name === 'ValidationError') {
    return res.status(422).json({ error: 'Validation failed', details: err.message });
  }
  if (err.code === 11000) {
    return res.status(409).json({ error: 'Duplicate entry', field: Object.keys(err.keyPattern)[0] });
  }

  const status = err.status || 500;
  const message = status === 500 ? 'Internal server error' : err.message;
  res.status(status).json({ error: message });
};

module.exports = { errorHandler };
