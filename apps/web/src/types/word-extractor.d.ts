declare module "word-extractor" {
  type ExtractedWordDocument = {
    getBody(): string;
    getHeaders(options?: { includeFooters?: boolean }): string;
    getFooters(): string;
  };

  export default class WordExtractor {
    extract(source: Buffer | string): Promise<ExtractedWordDocument>;
  }
}
