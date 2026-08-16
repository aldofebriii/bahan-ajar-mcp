import React, { useState, useEffect } from 'react';
import { api, type ClientInfo } from '../api';
import { Server, Plus, Play, RefreshCw, AlertCircle } from 'lucide-react';

interface SidebarProps {
  onSessionStart: (sessionId: string) => void;
}

export function Sidebar({ onSessionStart }: SidebarProps) {
  const [clients, setClients] = useState<Record<string, ClientInfo>>({});
  const [selectedServers, setSelectedServers] = useState<Set<string>>(new Set());
  const [newServerName, setNewServerName] = useState('');
  const [newServerUrl, setNewServerUrl] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchClients = async () => {
    try {
      const data = await api.getClients();
      setClients(data);
    } catch (err: any) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  const handleAddServer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newServerName || !newServerUrl) return;

    setIsAdding(true);
    setError(null);
    try {
      await api.addClient(newServerName, newServerUrl);
      setNewServerName('');
      setNewServerUrl('');
      await fetchClients();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsAdding(false);
    }
  };

  const toggleServer = (name: string) => {
    const newSelected = new Set(selectedServers);
    if (newSelected.has(name)) {
      newSelected.delete(name);
    } else {
      newSelected.add(name);
    }
    setSelectedServers(newSelected);
  };

  const handleStartChat = async () => {
    if (selectedServers.size === 0) return;
    setIsStarting(true);
    setError(null);
    try {
      const sessionId = await api.startSession(Array.from(selectedServers));
      onSessionStart(sessionId);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <div className="sidebar">
      <h2><Server size={20} /> MCP Servers</h2>

      <form onSubmit={handleAddServer} className="form-group">
        <input
          type="text"
          placeholder="Server Name (e.g. weather-mcp)"
          value={newServerName}
          onChange={e => setNewServerName(e.target.value)}
        />
        <input
          type="text"
          placeholder="Server URL (e.g. http://localhost:8001/sse)"
          value={newServerUrl}
          onChange={e => setNewServerUrl(e.target.value)}
        />
        <button type="submit" disabled={isAdding || !newServerName || !newServerUrl}>
          {isAdding ? <RefreshCw size={16} className="animate-spin" /> : <Plus size={16} />}
          Add Server
        </button>
        {error && <div style={{ color: 'var(--danger-color)', fontSize: '0.8rem', display: 'flex', gap: '4px', alignItems: 'center' }}><AlertCircle size={14} /> {error}</div>}
      </form>

      <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Available Servers</h3>
        <button className="secondary" onClick={fetchClients} style={{ padding: '4px', borderRadius: '4px' }} title="Refresh list">
          <RefreshCw size={14} />
        </button>
      </div>

      <div className="server-list">
        {Object.entries(clients).length === 0 ? (
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', textAlign: 'center', marginTop: '20px' }}>
            No servers available. Add one above.
          </div>
        ) : (
          Object.entries(clients).map(([name, info]) => (
            <div
              key={name}
              className={`server-item ${selectedServers.has(name) ? 'selected' : ''}`}
              onClick={() => toggleServer(name)}
            >
              <input
                type="checkbox"
                className="server-checkbox"
                checked={selectedServers.has(name)}
                readOnly
              />
              <div className="server-info">
                <span className="server-name">{name}</span>
                <span className="server-url" title={info.url}>
                  {info.url.length > 30 ? info.url.substring(0, 30) + '...' : info.url}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      <button
        onClick={handleStartChat}
        disabled={selectedServers.size === 0 || isStarting}
        style={{ marginTop: 'auto' }}
      >
        {isStarting ? <RefreshCw size={16} className="animate-spin" /> : <Play size={16} />}
        Start New Chat
      </button>
    </div>
  );
}
