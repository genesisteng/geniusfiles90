declare module "mammoth/mammoth.browser" {
  export function convertToHtml(input: {
    arrayBuffer: ArrayBuffer;
  }): Promise<{ value: string; messages: unknown[] }>;
}

declare module "pdfjs-dist/legacy/build/pdf.mjs";
