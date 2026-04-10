declare module "html-to-docx" {
  function HTMLtoDOCX(
    htmlString: string,
    headerHTMLString: string,
    documentOptions: Record<string, unknown>,
    footerHTMLString: string,
  ): Promise<Buffer | Blob>;

  export default HTMLtoDOCX;
}
