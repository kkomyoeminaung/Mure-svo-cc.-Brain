import * as cheerio from 'cheerio';

interface SearchResult {
  title: string;
  snippet: string;
  source: string;
}

interface CausalExtraction {
  cause: string;
  effect: string;
  strength: number;
}

export class WebSearchService {
  private userAgent = 'MURE-AI/2.0 (Educational AI Studio; nodejs)';

  async searchWikipedia(query: string): Promise<SearchResult[]> {
    try {
      const isMyanmar = /[\u1000-\u109f]/.test(query);
      const domain = isMyanmar ? 'my' : 'en';
      const searchUrl = `https://${domain}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&srlimit=3`;
      const response = await fetch(searchUrl, { headers: { 'User-Agent': this.userAgent } });
      const data = await response.json();

      const results: SearchResult[] = [];
      const searchItems = data.query?.search || [];

      for (const item of searchItems) {
        const title = item.title;
        const extractUrl = `https://${domain}.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=extracts&exintro&explaintext&format=json`;
        const extResponse = await fetch(extractUrl, { headers: { 'User-Agent': this.userAgent } });
        const extData = await extResponse.json();

        const pages = extData.query?.pages || {};
        const pageId = Object.keys(pages)[0];
        const extract = pages[pageId]?.extract?.slice(0, 500) || '';

        if (extract) {
          results.push({
            title,
            snippet: extract,
            source: isMyanmar ? 'myanmar_wikipedia' : 'wikipedia'
          });
        }
      }
      return results;
    } catch (e) {
      console.error('Wikipedia search error:', e);
      return [];
    }
  }

  async searchDuckDuckGo(query: string): Promise<SearchResult[]> {
    try {
      // Mocking the DuckDuckGo Instant Answer API which is public
      const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
      const response = await fetch(url, { headers: { 'User-Agent': this.userAgent } });
      const data = await response.json();

      const results: SearchResult[] = [];

      if (data.AbstractText) {
        results.push({
          title: data.Heading || query,
          snippet: data.AbstractText.slice(0, 500),
          source: 'duckduckgo'
        });
      }

      if (data.RelatedTopics) {
        for (const topic of data.RelatedTopics.slice(0, 2)) {
          if (topic.Text) {
            results.push({
              title: topic.Text.slice(0, 50),
              snippet: topic.Text.slice(0, 300),
              source: 'duckduckgo'
            });
          }
        }
      }

      return results;
    } catch (e) {
      console.error('DuckDuckGo search error:', e);
      return [];
    }
  }

  async searchAll(query: string): Promise<SearchResult[]> {
    console.log(`🌐 MURE: Global Search initiated for: ${query}`);
    const wiki = await this.searchWikipedia(query);
    const ddg = await this.searchDuckDuckGo(query);
    return [...wiki, ...ddg];
  }

  extractCausal(text: string): CausalExtraction[] {
    const textLower = text.toLowerCase();
    const causalPatterns = [
      { pattern: /(\w+(?:\s+\w+)*) causes (\w+(?:\s+\w+)*)/gi, strength: 0.7 },
      { pattern: /(\w+(?:\s+\w+)*) leads to (\w+(?:\s+\w+)*)/gi, strength: 0.7 },
      { pattern: /(\w+(?:\s+\w+)*) results in (\w+(?:\s+\w+)*)/gi, strength: 0.7 },
      { pattern: /because of (\w+(?:\s+\w+)*), (\w+(?:\s+\w+)*)/gi, strength: 0.6 },
      { pattern: /(\w+(?:\s+\w+)*) is caused by (\w+(?:\s+\w+)*)/gi, strength: 0.6 },
    ];

    const extracted: CausalExtraction[] = [];
    
    for (const { pattern, strength } of causalPatterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        if (match[1] && match[2]) {
          const cause = match[1].trim();
          const effect = match[2].trim();
          
          // Basic validation (length)
          if (cause.split(' ').length <= 6 && effect.split(' ').length <= 6) {
            extracted.push({ cause, effect, strength });
          }
        }
      }
    }

    return extracted.slice(0, 5);
  }
}
