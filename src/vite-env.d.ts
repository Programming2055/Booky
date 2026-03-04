/// <reference types="vite/client" />

/* eslint-disable @typescript-eslint/no-namespace */
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'pdfjs-viewer-element': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          src?: string;
          page?: string;
          zoom?: string;
          pagemode?: string;
          search?: string;
          phrase?: string;
          locale?: string;
          'viewer-css-theme'?: string;
          'worker-src'?: string;
          'iframe-title'?: string;
        },
        HTMLElement
      >;
    }
  }
}
