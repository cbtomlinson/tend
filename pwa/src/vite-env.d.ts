/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

/** Build date (YYYY-MM-DD), injected by vite.config define. */
declare const __TEND_BUILT__: string;

declare module '*.module.css' {
  const classes: { readonly [key: string]: string };
  export default classes;
}
