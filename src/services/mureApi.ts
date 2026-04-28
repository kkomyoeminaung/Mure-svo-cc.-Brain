import { BrainStats } from '../logic/brain/types';

export class MureApiService {
  private static instance: MureApiService;
  private backendUrl: string = 'http://localhost:8000'; // Default Python backend URL (ngrok or local)

  private constructor() {
    const savedUrl = localStorage.getItem('mure_backend_url');
    if (savedUrl) {
      this.backendUrl = savedUrl;
    }
  }

  static getInstance() {
    if (!MureApiService.instance) {
      MureApiService.instance = new MureApiService();
    }
    return MureApiService.instance;
  }

  setBackendUrl(url: string) {
    this.backendUrl = url;
    localStorage.setItem('mure_backend_url', url);
  }

  getBackendUrl() {
    return this.backendUrl;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 1000); // 1 second timeout
      const res = await fetch(`${this.backendUrl}/health`, { signal: controller.signal });
      clearTimeout(id);
      return res.ok;
    } catch {
      return false;
    }
  }

  async chat(message: string, settings?: any): Promise<any> {
    try {
      const isOnline = await this.healthCheck();
      if (!isOnline) {
        throw new Error('Python backend is offline, falling back to local TypeScript reasoner.');
      }

      const res = await fetch(`${this.backendUrl}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, settings })
      });
      if (!res.ok) throw new Error('API Error');
      const data = await res.json();
      return data;
    } catch (error) {
      console.warn('Falling back to local TS reasoner...', error);
      // Fallback to local server.ts `/api/chat`
      const fallbackRes = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, settings })
      });
      if (!fallbackRes.ok) throw new Error("Local fallback failed.");
      return fallbackRes.json();
    }
  }

  async reason(message: string): Promise<any> {
    const res = await fetch(`${this.backendUrl}/reason`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
    });
    return res.json();
  }

  async learn(message: string): Promise<any> {
    const res = await fetch(`${this.backendUrl}/learn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
    });
    return res.json();
  }

  async getStats(): Promise<Partial<BrainStats>> {
    try {
       const res = await fetch(`${this.backendUrl}/stats`);
       if (!res.ok) throw new Error();
       return res.json();
    } catch {
       return {};
    }
  }
}

export const mureApi = MureApiService.getInstance();
