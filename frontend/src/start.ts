import { createMiddleware, createStart } from "@tanstack/react-start";

const isProduction = process.env["NODE_ENV"] === "production";

const CSRF_PROTECTED_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const csrfMiddleware = createMiddleware().server(async ({ next, request }) => {
  if (!CSRF_PROTECTED_METHODS.has(request.method)) {
    return next();
  }

  const secFetchSite = request.headers.get("sec-fetch-site");
  if (secFetchSite === "same-origin" || secFetchSite === "same-site" || secFetchSite === "none") {
    return next();
  }

  const origin = request.headers.get("origin");
  if (origin) {
    const originHost = new URL(origin).host;
    const host = request.headers.get("host") ?? request.headers.get("x-forwarded-host");
    if (host && originHost === host) {
      return next();
    }
  }

  const referer = request.headers.get("referer");
  if (referer) {
    try {
      const refererHost = new URL(referer).host;
      const host = request.headers.get("host") ?? request.headers.get("x-forwarded-host");
      if (host && refererHost === host) {
        return next();
      }
    } catch {
      // Invalid referer URL falls through to rejection
    }
  }

  if (!isProduction && !origin && !referer) {
    return next();
  }

  return new Response("Cross-site request forgery validation failed", {
    status: 403,
  });
});

export const startInstance = createStart(() => ({
  requestMiddleware: [csrfMiddleware],
}));
