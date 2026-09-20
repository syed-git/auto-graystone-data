import { createApp, ENDPOINT } from './src/app.js';

// Render injects PORT; bind to 0.0.0.0 so the service is reachable from outside the container.
const port = Number(process.env.PORT) || 4000;
const host = process.env.HOST || '0.0.0.0';

const server = createApp().listen(port, host, () => {
  console.log(`auto-graystone-data listening on http://${host}:${port}  (POST ${ENDPOINT})`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    console.log(`${signal} received, shutting down`);
    server.close(() => process.exit(0));
  });
}
