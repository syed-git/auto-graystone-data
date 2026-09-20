import express from 'express';
import { ValidationError } from './errors.js';
import { buildAutoGraystoneData } from './generator.js';

export const ENDPOINT = '/getAutoGraystoneData';

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('json spaces', 2);

  // Every body is parsed as JSON whatever the Content-Type says; an empty body is `{}`.
  app.use(express.json({ limit: '200kb', strict: false, type: () => true }));

  app.get('/', (_req, res) => {
    res.json({
      service: 'auto-graystone-data',
      endpoints: { [`POST ${ENDPOINT}`]: 'Builds an AutoGraystone data set from an optional partial JSON body', 'GET /health': 'Liveness probe' },
    });
  });

  app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

  app.post(ENDPOINT, (req, res) => {
    // body-parser leaves `{}` for requests without a body -> defaults
    if (!isPlainObject(req.body)) {
      return sendError(res, 400, 'Request body must be a JSON object', [{ path: '$', message: `received ${describe(req.body)}` }]);
    }
    return res.status(200).json(buildAutoGraystoneData(req.body));
  });

  // Right path, wrong verb
  app.all(ENDPOINT, (req, res) => {
    res.set('Allow', 'POST');
    sendError(res, 405, `${req.method} is not allowed on ${ENDPOINT}; use POST`);
  });

  app.use((req, res) => sendError(res, 404, `No route for ${req.method} ${req.path}`, [{ path: '$', message: `POST ${ENDPOINT} is the only data endpoint` }]));

  // 4 parameters are required for Express to treat this as the error handler
  app.use((err, _req, res, _next) => {
    if (err instanceof ValidationError) return sendError(res, 400, 'Invalid request body', err.details);
    if (err.type === 'entity.parse.failed') return sendError(res, 400, 'Request body is not valid JSON', [{ path: '$', message: err.message }]);
    if (err.type === 'entity.too.large') return sendError(res, 413, 'Request body is too large (limit 200kb)');
    if (err.type === 'encoding.unsupported' || err.type === 'charset.unsupported') return sendError(res, 415, err.message);
    if (typeof err.status === 'number' && err.status >= 400 && err.status < 500) return sendError(res, err.status, err.message);
    console.error(err);
    return sendError(res, 500, 'Unexpected error while building the data set');
  });

  return app;
}

function describe(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'an array';
  return `a ${typeof value}`;
}

function sendError(res, status, error, details) {
  const payload = { status, error };
  if (details) payload.details = details;
  res.status(status).json(payload);
}
