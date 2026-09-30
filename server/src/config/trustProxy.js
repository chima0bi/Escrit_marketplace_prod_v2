// The API runs behind a reverse proxy (Render). Trusting one hop makes
// `req.ip` and `req.secure` reflect the real client, which rate limiting
// and the HTTPS redirect depend on.
export function applyTrustProxy(app) {
  app.set('trust proxy', 1);
}
