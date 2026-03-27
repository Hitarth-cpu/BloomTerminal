// Minimal type shim for rss-parser until npm install is run.
// Once rss-parser is installed it ships its own bundled types which take precedence.
declare module 'rss-parser' {
  interface Item {
    title?: string;
    link?: string;
    guid?: string;
    pubDate?: string;
    content?: string;
    contentSnippet?: string;
    summary?: string;
    isoDate?: string;
  }

  interface Feed {
    title?: string;
    items: Item[];
  }

  interface ParserOptions {
    timeout?: number;
    maxRedirects?: number;
    headers?: Record<string, string>;
  }

  class Parser {
    constructor(options?: ParserOptions);
    parseURL(url: string): Promise<Feed>;
    parseString(xml: string): Promise<Feed>;
  }

  export = Parser;
}
