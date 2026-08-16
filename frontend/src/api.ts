const API_BASE_URL = 'http://localhost:8000/chat/v1';

export interface ClientInfo {
  url: string;
  name?: string;
  version?: string;
  tools?: any[];
  resources?: any[];
  resourceTemplates?: any[];
  prompts?: any[];
}

export interface SessionInfo {
  clients: ClientInfo[];
  messages: any[];
}

export const api = {
  async addClient(name: string, url: string): Promise<ClientInfo> {
    const res = await fetch(`${API_BASE_URL}/single`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, url })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Failed to add client');
    }
    return res.json();
  },

  async getClients(): Promise<Record<string, ClientInfo>> {
    const res = await fetch(`${API_BASE_URL}/clients`);
    if (!res.ok) throw new Error('Failed to fetch clients');
    return res.json();
  },

  async startSession(names: string[]): Promise<string> {
    const res = await fetch(`${API_BASE_URL}/new`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ names })
    });
    if (!res.ok) throw new Error('Failed to start session');
    const data = await res.json();
    return data.sessionId;
  },

  async getSession(sessionId: string): Promise<SessionInfo> {
    const res = await fetch(`${API_BASE_URL}/session/${sessionId}`);
    if (!res.ok) throw new Error('Failed to fetch session');
    return res.json();
  },

  async sendMessage(sessionId: string, message: string, prompts?: {name: string, arguments?: any}[], resources?: string[]): Promise<{ response: string, history: any[] }> {
    const res = await fetch(`${API_BASE_URL}/session/${sessionId}/agent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, prompts: prompts || [], resources: resources || [] })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Failed to send message');
    }
    return res.json();
  }
};
