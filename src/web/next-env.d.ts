/// <reference types="next" />
/// <reference types="next/image-types/global" />

// NOTE: This file should not be edited
// see https://nextjs.org/docs/basic-features/typescript for more information.

// Augment the JSX namespace to include Next.js specific types
declare namespace JSX {
  interface IntrinsicElements {
    // Allow all HTML elements
    [elemName: string]: any;
  }
}

// Augment the global namespace with Next.js specific types
declare global {
  // Extend Next.js component types
  type NextComponentType<
    C = NextPageContext,
    IP = {},
    P = {}
  > = React.ComponentType<P> & {
    getInitialProps?(context: C): IP | Promise<IP>;
  };

  // Define Next.js page context interface
  interface NextPageContext {
    /**
     * Query string section of URL parsed as an object
     */
    query: {
      [key: string]: string | string[];
    };
    /**
     * HTTP request object (server only)
     */
    req?: IncomingMessage & {
      cookies: {
        [key: string]: string;
      };
    };
    /**
     * HTTP response object (server only)
     */
    res?: ServerResponse;
  }
}

// Type augmentations for Next.js
declare module "next" {
  export type NextApiRequest = import("next").NextApiRequest;
  export type NextApiResponse = import("next").NextApiResponse;
  export type NextPage<P = {}, IP = P> = import("next").NextPage<P, IP>;
  export type GetServerSideProps<
    P extends { [key: string]: any } = { [key: string]: any },
  > = import("next").GetServerSideProps<P>;
  export type GetStaticProps<
    P extends { [key: string]: any } = { [key: string]: any },
  > = import("next").GetStaticProps<P>;
  export type GetStaticPaths<
    P extends { [key: string]: any } = { [key: string]: any },
  > = import("next").GetStaticPaths<P>;
}

// Type augmentations for React
declare module "react" {
  export interface CSSProperties extends React.CSSProperties {}
  export type ReactNode = React.ReactNode;
  export type ReactElement = React.ReactElement;
}