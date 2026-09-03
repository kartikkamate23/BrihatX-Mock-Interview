import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Neither `eslint.ignoreDuringBuilds` nor `typescript.ignoreBuildErrors` is
  // set here on purpose. Both had been masking real errors in this project
  // (profileImage / profileURL). `npx tsc --noEmit` and `npm run lint` both
  // pass, so the build checks them for real. Do not re-add either flag to
  // silence a future error.

  // Lets a second Next.js process keep its build output somewhere other than
  // `.next`.
  //
  // Every `next dev`, `next build` and `next start` in a project writes to the
  // same `.next` by default, and they do not coordinate: a build started while
  // a dev server is running deletes the manifests that server is holding open.
  // The dev server does not crash -- it stays up and answers every route with a
  // bare "Internal Server Error", while its log fills with ENOENT for files
  // like `app-build-manifest.json`. That is what took this application down,
  // and from the browser it is indistinguishable from a code fault.
  //
  // The browser suite now sets this so its own server can never collide with
  // the one the developer is working against. Unset, the default is unchanged.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
