import { resolve } from 'path';
import axios from 'axios';
import bodyParser from 'body-parser';

const NuxtModule = function(moduleOptions = {}) {
  const options = {
    ...this.options.druxt || {},
    auth: {
      // Declared first, so they name the shape without overwriting what a
      // site configured. Spread after the configured values, every one of
      // these would reset it to undefined.
      clientId: void 0,
      clientSecret: void 0,
      // The password grant may want its own Consumer. The browser flow needs
      // a public one, and a Consumer cannot be public and confidential at
      // once, so a site that uses both points this at the second.
      passwordClientId: void 0,
      // The password grant issues a token and no Drupal session. A site that
      // proxies Drupal's own pages needs the session too, and sets this.
      passwordSession: void 0,
      scope: void 0,
      ...(this.options.druxt || {}).auth || {},
      ...moduleOptions
    }
  };
  const loginOption = (options.auth || {}).login;
  const loginPath = loginOption === false ? false : typeof loginOption === "string" ? loginOption : "/user/login";
  if (!options.auth.clientId) {
    throw new Error("DruxtAuth requires a clientId to be provided.");
  }
  let { baseUrl } = options;
  const proxy = (options.proxy || {}).api;
  if (proxy) {
    const existing = !this.options.proxy ? [] : Array.isArray(this.options.proxy) ? this.options.proxy : Object.entries(this.options.proxy);
    this.options.proxy = [
      ...existing,
      ["/oauth/userinfo", { target: baseUrl }],
      // Signing in with credentials puts a Drupal session cookie in the
      // browser, and it only reaches the authorize request when Drupal
      // answers on this origin. These four are what that takes.
      //
      // Proxied for POST alone. Drupal's JSON routes for all three are POST
      // (user.login.http, user.logout.http, user.pass.http), and a GET has to
      // reach whatever page sits at that path: the login page this module
      // adds, or a site's own logout and password pages. Proxying the GET
      // sends the visitor to Drupal's form and the page never renders.
      ...["/user/login", "/user/logout", "/user/password"].map((path) => [
        (candidate, req) => candidate === path && req.method === "POST",
        { target: baseUrl }
      ]),
      ["/oauth/authorize", { target: baseUrl }]
    ];
  }
  this.options.auth = {
    ...this.options.auth,
    redirect: {
      callback: "/callback",
      logout: "/",
      // Without this auth-next has nowhere to send an unauthenticated
      // visitor, so the page below would exist and nothing would reach it.
      ...loginPath ? { login: loginPath } : {},
      ...(this.options.auth || {}).redirect
    },
    strategies: {
      // OAuth 2 Authorization code grant with PKCE. The scheme is oauth2's,
      // plus sign-in with credentials through Drupal's JSON login.
      "drupal-authorization_code": {
        scheme: resolve(__dirname, "../templates/drupal-scheme.js"),
        // The Drupal login endpoints are same-origin paths, which only
        // resolve where this module registered the proxy. A site that
        // fronts both on one origin can set this back to true.
        credentials: !!proxy,
        endpoints: {
          // The browser-facing URL, and the default. Without credentials the
          // visitor signs in on Drupal's own page, which lives on Drupal's
          // origin, so the authorize request has to go there.
          authorization: baseUrl + "/oauth/authorize",
          authorizationBackend: baseUrl + "/oauth/authorize",
          // The same-origin path, when the proxy gives us one. Signing in
          // with credentials sets the Drupal session cookie on this origin,
          // and a cookie does not travel to the backend's, so that flow uses
          // this instead. The scheme picks between them per login.
          ...proxy ? { authorizationSameOrigin: "/oauth/authorize" } : {},
          token: baseUrl + "/oauth/token",
          userInfo: (!proxy ? baseUrl : "") + "/oauth/userinfo"
        },
        clientId: (options.auth || {}).clientId || process.env.DRUXT_AUTH_CLIENT_ID,
        responseType: "code",
        scope: (options.auth || {}).scope,
        grantType: "authorization_code",
        codeChallengeMethod: "S256"
      },
      // Password grant. Simple OAuth 6 moved it out of core, so the backend
      // needs the simple_oauth_password_grant module for this to answer.
      // A refresh scheme, plus the Drupal session a site can opt into.
      "drupal-password": {
        scheme: resolve(__dirname, "../templates/drupal-password-scheme.js"),
        session: !!(options.auth || {}).passwordSession,
        token: {
          property: "access_token",
          type: "Bearer",
          name: "Authorization",
          maxAge: 60 * 60 * 24 * 365
        },
        refreshToken: {
          property: "refresh_token",
          data: "refresh_token",
          maxAge: 60 * 60 * 24 * 30
        },
        endpoints: {
          token: baseUrl + "/oauth/token",
          login: {
            baseURL: "",
            url: "/_auth/drupal-password/token"
          },
          logout: false,
          refresh: {
            baseURL: "",
            url: "/_auth/drupal-password/token"
          },
          user: {
            url: (!proxy ? baseUrl : "") + "/oauth/userinfo",
            method: "post"
          }
        },
        user: {
          property: false
        },
        grantType: "password"
      },
      ...(this.options.auth || {}).strategies
    }
  };
  this.options.serverMiddleware.unshift({
    path: "/_auth/drupal-password/token",
    handler: async (req, res, next) => {
      if (req.method !== "POST") {
        return next();
      }
      const formMiddleware = bodyParser.json();
      await formMiddleware(req, res, async () => {
        const data = req.body;
        const grantFields = /* @__PURE__ */ new Map([
          ["password", ["username", "password", "scope"]],
          ["refresh_token", ["refresh_token", "scope"]]
        ]);
        const fields = grantFields.get(data.grant_type);
        if (!fields) {
          return next(new Error("Unsupported grant type"));
        }
        if (data.grant_type === "password" && (!data.username || !data.password)) {
          return next(new Error("Invalid username or password"));
        }
        try {
          const secret = (options.auth || {}).clientSecret || process.env.DRUXT_AUTH_CLIENT_SECRET;
          const postData = new URLSearchParams({
            ...Object.fromEntries(
              fields.filter((field) => data[field] !== void 0).map((field) => [field, data[field]])
            ),
            grant_type: data.grant_type,
            // Written last, so a caller cannot rename the consumer this
            // secret belongs to by sending a client_id of their own.
            client_id: (options.auth || {}).passwordClientId || (options.auth || {}).clientId || process.env.DRUXT_AUTH_CLIENT_ID,
            // Only a confidential consumer has one, and OAuth asks for it
            // from those alone. URLSearchParams would otherwise send the
            // string "undefined", which never validates.
            ...secret ? { client_secret: secret } : {}
          }).toString();
          const response = await axios.post(
            this.options.auth.strategies["drupal-password"].endpoints.token,
            postData,
            {
              headers: {
                "Content-Type": "application/x-www-form-urlencoded"
              }
            }
          );
          res.end(JSON.stringify(response.data));
        } catch (err) {
          console.error(err);
          res.statusCode = (err.response || {}).status || 500;
          res.end(JSON.stringify({ ...(err.response || {}).data || {} }));
        }
      });
    }
  });
  this.options.store = true;
  this.addModule("@nuxtjs/auth-next");
  this.nuxt.hook("components:dirs", (dirs) => {
    dirs.push({ path: resolve(__dirname, "components") });
  });
  this.extendRoutes((routes, resolve2) => {
    if (!routes.find((o) => o.path === "/callback")) {
      this.addTemplate({
        src: resolve2(__dirname, "../templates/callback.js"),
        fileName: "components/druxt-auth-callback.js",
        options
      });
      routes.push({
        name: "druxt-auth-callback",
        path: "/callback",
        component: resolve2(
          this.options.buildDir,
          "components/druxt-auth-callback.js"
        ),
        chunkName: "druxt-auth-callback"
      });
    }
  });
  if (loginPath) {
    this.extendRoutes((routes, resolve2) => {
      const tail = loginPath.replace(/^\//, "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const claimed = new RegExp(
        `^(/:[A-Za-z0-9_]+\\??)?/${tail}/?$`,
        (this.options.router || {}).caseSensitive ? "" : "i"
      );
      if (routes.find((o) => claimed.test(o.path))) {
        return;
      }
      this.addTemplate({
        src: resolve2(__dirname, "../templates/login.js"),
        fileName: "components/druxt-auth-login.js",
        options
      });
      routes.unshift({
        name: "druxt-auth-login",
        path: loginPath,
        component: resolve2(
          this.options.buildDir,
          "components/druxt-auth-login.js"
        ),
        chunkName: "druxt-auth-login"
      });
    });
  }
};

export { NuxtModule as default };
