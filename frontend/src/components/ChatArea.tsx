import React, { useState, useEffect, useRef } from 'react';
import { api, type SessionInfo } from '../api';
import { Send, MessageSquare, Loader2, Server, Wrench, FileText } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ChatAreaProps {
  sessionId: string;
}

export function ChatArea({ sessionId }: ChatAreaProps) {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-completion states
  const [showPromptMenu, setShowPromptMenu] = useState(false);
  const [promptSearch, setPromptSearch] = useState('');
  const [selectedPrompts, setSelectedPrompts] = useState<{name: string, arguments?: any}[]>([]);

  const [showResourceMenu, setShowResourceMenu] = useState(false);
  const [resourceSearch, setResourceSearch] = useState('');
  const [selectedResources, setSelectedResources] = useState<{name: string, uri: string}[]>([]);

  // Template Modal State
  const [templateModal, setTemplateModal] = useState<{
    show: boolean;
    resource: any | null;
    variables: string[];
    values: Record<string, string>;
  }>({ show: false, resource: null, variables: [], values: {} });

  const fetchSession = async () => {
    try {
      const data = await api.getSession(sessionId);
      setSession(data);
    } catch (err: any) {
      console.error(err);
      setError("Failed to load session history");
    }
  };

  useEffect(() => {
    if (sessionId) {
      fetchSession();
      // Reset state when session changes
      setSelectedPrompts([]);
      setSelectedResources([]);
      setShowPromptMenu(false);
      setShowResourceMenu(false);
      setTemplateModal({ show: false, resource: null, variables: [], values: {} });
      setInput('');
    }
  }, [sessionId]);

  useEffect(() => {
    // Scroll to bottom when messages change
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [session?.messages, isSending]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInput(val);

    const lastSlashIdx = val.lastIndexOf('/');
    const lastHashIdx = val.lastIndexOf('#');

    if (lastSlashIdx > lastHashIdx && lastSlashIdx !== -1) {
      setShowResourceMenu(false);
      const textAfterSlash = val.slice(lastSlashIdx + 1);
      if (textAfterSlash.includes(' ')) {
        setShowPromptMenu(false);
      } else {
        setShowPromptMenu(true);
        setPromptSearch(textAfterSlash);
      }
    } else if (lastHashIdx > lastSlashIdx && lastHashIdx !== -1) {
      setShowPromptMenu(false);
      const textAfterHash = val.slice(lastHashIdx + 1);
      if (textAfterHash.includes(' ')) {
        setShowResourceMenu(false);
      } else {
        setShowResourceMenu(true);
        setResourceSearch(textAfterHash);
      }
    } else {
      setShowPromptMenu(false);
      setShowResourceMenu(false);
    }
  };

  const handlePromptSelect = (promptName: string) => {
    if (!selectedPrompts.find(p => p.name === promptName)) {
      setSelectedPrompts(prev => [...prev, { name: promptName }]);
    }
    const lastSlashIdx = input.lastIndexOf('/');
    if (lastSlashIdx !== -1) {
      setInput(input.slice(0, lastSlashIdx).trim());
    }
    setShowPromptMenu(false);
  };

  const addResourceToSelection = (name: string, uri: string) => {
    if (!selectedResources.find(r => r.uri === uri)) {
      setSelectedResources(prev => [...prev, { name, uri }]);
    }
  };

  const closeResourceMenuAndTrimInput = () => {
    const lastHashIdx = input.lastIndexOf('#');
    if (lastHashIdx !== -1) {
      setInput(input.slice(0, lastHashIdx).trim());
    }
    setShowResourceMenu(false);
  };

  const handleResourceSelect = (res: any) => {
    if (res.type === 'template') {
      const matches = [...res.uriTemplate.matchAll(/\{([^}]+)\}/g)];
      if (matches.length > 0) {
        const variables = matches.map(m => m[1]);
        setTemplateModal({
          show: true,
          resource: res,
          variables,
          values: {}
        });
        return; // wait for modal submission
      }
    }
    // Direct selection if no variables or not a template
    addResourceToSelection(res.name, res.uri || res.uriTemplate);
    closeResourceMenuAndTrimInput();
  };

  const handleTemplateSubmit = () => {
    if (!templateModal.resource) return;
    const res = templateModal.resource;
    let newUri = res.uriTemplate;
    const argsProvided: string[] = [];

    for (const v of templateModal.variables) {
      const val = templateModal.values[v] || '';
      newUri = newUri.replace(`{${v}}`, val);
      argsProvided.push(val);
    }
    
    const finalName = `${res.name} (${argsProvided.join(', ')})`;
    addResourceToSelection(finalName, newUri);
    closeResourceMenuAndTrimInput();
    setTemplateModal({ show: false, resource: null, variables: [], values: {} });
  };

  const handleSend = async () => {
    // Prevent sending if input is empty AND no prompts/resources are selected
    if ((!input.trim() && selectedPrompts.length === 0 && selectedResources.length === 0) || isSending) return;

    const message = input.trim();
    const currentPrompts = [...selectedPrompts];
    const currentResources = [...selectedResources];
    
    setInput('');
    setSelectedPrompts([]);
    setSelectedResources([]);
    setIsSending(true);
    setError(null);

    // Optimistically add user message
    if (session) {
      let content = message || '(Using attached resources/prompts)';
      if (currentPrompts.length > 0) {
        content = `${content}\n\n[Using prompts: ${currentPrompts.map(p => p.name).join(', ')}]`.trim();
      }
      if (currentResources.length > 0) {
        content = `${content}\n\n[Using resources: ${currentResources.map(r => r.name).join(', ')}]`.trim();
      }
      setSession({
        ...session,
        messages: [...session.messages, { role: 'user', content }]
      });
    }

    try {
      const result = await api.sendMessage(
        sessionId, 
        message, 
        currentPrompts, 
        currentResources.map(r => r.uri)
      );
      // The API returns the full history now
      if (session) {
        setSession({
          ...session,
          messages: result.history
        });
      }
    } catch (err: any) {
      setError(err.message);
      // Restore selected prompts/resources if sending failed
      setSelectedPrompts(currentPrompts);
      setSelectedResources(currentResources);
    } finally {
      setIsSending(false);
      // Refresh to ensure we have the absolute latest state
      await fetchSession();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (showPromptMenu && filteredPrompts.length > 0) {
        handlePromptSelect(filteredPrompts[0].name);
      } else if (showResourceMenu && filteredResources.length > 0) {
        handleResourceSelect(filteredResources[0]);
      } else {
        handleSend();
      }
    }
  };

  const availablePrompts = session?.clients.flatMap(c => c.prompts || []) || [];
  const filteredPrompts = availablePrompts.filter((p: any) => p.name.toLowerCase().includes(promptSearch.toLowerCase()));

  const availableResourcesList = session?.clients.flatMap(c => c.resources?.map(r => ({ ...r, type: 'resource' })) || []) || [];
  const availableTemplatesList = session?.clients.flatMap(c => c.resourceTemplates?.map(t => ({ ...t, type: 'template' })) || []) || [];
  const allResources = [...availableResourcesList, ...availableTemplatesList];
  
  const filteredResources = allResources.filter((r: any) => 
    r.name.toLowerCase().includes(resourceSearch.toLowerCase()) || 
    (r.uri && r.uri.toLowerCase().includes(resourceSearch.toLowerCase())) ||
    (r.uriTemplate && r.uriTemplate.toLowerCase().includes(resourceSearch.toLowerCase()))
  );

  if (!sessionId) {
    return (
      <div className="chat-area glass">
        <div className="empty-state">
          <MessageSquare size={48} />
          <h2>Select servers and start a new chat</h2>
          <p>Your conversation and MCP tool executions will appear here.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-area glass" style={{ position: 'relative' }}>
      
      {/* Template Input Modal */}
      {templateModal.show && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '16px' }}>
          <div style={{ backgroundColor: 'var(--glass-bg)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '24px', width: '90%', maxWidth: '400px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
            <h3 style={{ marginTop: 0, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              🏗️ Configure Template
            </h3>
            <p style={{ fontSize: '13px', opacity: 0.8, marginBottom: '20px' }}>
              {templateModal.resource?.name}: <code style={{ backgroundColor: 'rgba(0,0,0,0.2)', padding: '2px 6px', borderRadius: '4px' }}>{templateModal.resource?.uriTemplate}</code>
            </p>
            
            {templateModal.variables.map((v, i) => (
              <div key={v} style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '8px' }}>
                  Value for <code style={{ color: 'var(--primary-color)' }}>{v}</code>:
                </label>
                <input 
                  type="text" 
                  value={templateModal.values[v] || ''}
                  onChange={e => setTemplateModal(prev => ({ ...prev, values: { ...prev.values, [v]: e.target.value } }))}
                  placeholder={`Enter ${v}...`}
                  autoFocus={i === 0}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleTemplateSubmit();
                    if (e.key === 'Escape') setTemplateModal({ show: false, resource: null, variables: [], values: {} });
                  }}
                  style={{ width: '100%', padding: '10px 12px', backgroundColor: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', outline: 'none' }}
                />
              </div>
            ))}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
              <button 
                onClick={() => setTemplateModal({ show: false, resource: null, variables: [], values: {} })}
                style={{ padding: '8px 16px', backgroundColor: 'transparent', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', color: 'white', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button 
                onClick={handleTemplateSubmit}
                style={{ padding: '8px 16px', backgroundColor: '#3b82f6', border: 'none', borderRadius: '8px', color: 'white', cursor: 'pointer', fontWeight: 'bold' }}
              >
                Add Resource
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="chat-header">
        <h1>Agent Chat</h1>
        <div className="session-info">Session: {sessionId}</div>
      </div>

      <div className="messages-container">
        {session?.messages.length === 0 ? (
          <div className="empty-state" style={{ marginTop: 'auto', marginBottom: 'auto' }}>
            <MessageSquare size={48} />
            <h2>Session started</h2>
            <p>Send a message to begin interacting with the AI and connected MCP servers.</p>
            
            {session.clients && session.clients.length > 0 && (
              <div className="connected-servers-info" style={{ marginTop: '24px', textAlign: 'left', width: '100%', maxWidth: '800px', backgroundColor: 'var(--glass-bg)', padding: '16px', borderRadius: '12px' }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                  <Server size={20} /> Connected Servers
                </h3>
                {session.clients.map((client, idx) => (
                  <div key={idx} style={{ marginBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '16px' }}>
                    <div style={{ marginBottom: '8px' }}>
                      <strong style={{ fontSize: '16px' }}>{client.name || 'Unknown Server'}</strong> {client.version && <span style={{ opacity: 0.7, fontSize: '12px' }}>v{client.version}</span>}
                    </div>
                    <div style={{ fontSize: '13px', opacity: 0.8, marginBottom: '8px' }}>
                      <strong>URL:</strong> {client.url}
                    </div>
                    <div style={{ fontSize: '13px', backgroundColor: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '8px', marginBottom: '12px' }}>
                      <strong style={{ display: 'block', marginBottom: '4px' }}>Server Overview</strong>
                      This MCP server extends the AI's capabilities by providing:
                      <ul style={{ margin: '4px 0 0', paddingLeft: '20px', color: 'rgba(255,255,255,0.8)' }}>
                        <li><strong>{client.tools?.length || 0} Tools</strong> that the AI can call to perform actions or fetch live data.</li>
                        <li><strong>{(client.resources?.length || 0) + (client.resourceTemplates?.length || 0)} Resources</strong> (including templates) for the AI to read specialized context or files.</li>
                        <li><strong>{client.prompts?.length || 0} Prompts</strong> that you can trigger (using <code>/</code>) to instruct the AI.</li>
                      </ul>
                    </div>
                    {client.tools && client.tools.length > 0 && (
                      <details style={{ marginTop: '12px', cursor: 'pointer' }}>
                        <summary style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', userSelect: 'none' }}>
                          <Wrench size={16} /> Available Tools ({client.tools.length})
                        </summary>
                        <ul style={{ fontSize: '13px', margin: 0, paddingLeft: '20px', cursor: 'default' }}>
                          {client.tools.map((tool: any, tidx: number) => (
                            <li key={tidx} style={{ marginBottom: '6px' }}>
                              <strong>{tool.name}</strong>: {tool.description || <em style={{ opacity: 0.6 }}>No description</em>}
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                    {client.resources && client.resources.length > 0 && (
                      <details style={{ marginTop: '12px', cursor: 'pointer' }}>
                        <summary style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', userSelect: 'none' }}>
                          <FileText size={16} /> Available Resources ({client.resources.length})
                        </summary>
                        <ul style={{ fontSize: '13px', margin: 0, paddingLeft: '20px', cursor: 'default' }}>
                          {client.resources.map((res: any, ridx: number) => (
                            <li key={ridx} style={{ marginBottom: '6px' }}>
                              <strong>{res.name}</strong> ({res.uri})
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                    {client.resourceTemplates && client.resourceTemplates.length > 0 && (
                      <details style={{ marginTop: '12px', cursor: 'pointer' }}>
                        <summary style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', userSelect: 'none' }}>
                          <FileText size={16} /> Available Resource Templates ({client.resourceTemplates.length})
                        </summary>
                        <ul style={{ fontSize: '13px', margin: 0, paddingLeft: '20px', cursor: 'default' }}>
                          {client.resourceTemplates.map((res: any, ridx: number) => (
                            <li key={ridx} style={{ marginBottom: '6px' }}>
                              <strong>{res.name}</strong> ({res.uriTemplate})
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          session?.messages.map((msg, idx) => {
            let contentStr = '';
            if (typeof msg.content === 'string') {
              contentStr = msg.content;
            } else if (Array.isArray(msg.content)) {
              contentStr = msg.content.map((c: any) => c.text || JSON.stringify(c)).join('\n');
            } else if (msg.content) {
              contentStr = JSON.stringify(msg.content);
            }

            const reasoning = msg.reasoning_content || msg.reasoning;

            return (
              <div key={idx} className={`message ${msg.role}`}>
                <div className="message-bubble">
                  {msg.role === 'tool' && (
                    <details style={{ backgroundColor: 'rgba(0,0,0,0.1)', padding: '8px 12px', borderRadius: '8px', marginBottom: '8px', fontSize: '0.9em' }}>
                      <summary style={{ fontWeight: 'bold', cursor: 'pointer', outline: 'none' }}>
                        🔧 Tool Result: {msg.name || msg.tool_call_id}
                      </summary>
                      <div style={{ marginTop: '12px', overflowX: 'auto' }} className="markdown-body">
                        {contentStr && <ReactMarkdown remarkPlugins={[remarkGfm]}>{contentStr}</ReactMarkdown>}
                      </div>
                    </details>
                  )}
                  
                  {reasoning && (
                    <details className="reasoning-block" style={{ backgroundColor: 'rgba(0,0,0,0.1)', padding: '8px 12px', borderRadius: '8px', marginBottom: '12px', fontSize: '0.9em', borderLeft: '3px solid rgba(255,255,255,0.2)' }}>
                      <summary style={{ fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85em', opacity: 0.8, outline: 'none' }}>🤔 Thinking Process</summary>
                      <div style={{ marginTop: '12px' }} className="markdown-body">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{reasoning}</ReactMarkdown>
                      </div>
                    </details>
                  )}
                  
                  {msg.role !== 'tool' && contentStr && (
                    <div className="markdown-body">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{contentStr}</ReactMarkdown>
                    </div>
                  )}
                  {!contentStr && !reasoning && msg.tool_calls && (
                     <div style={{ fontStyle: 'italic', opacity: 0.7 }}>
                       [Calling tool: {msg.tool_calls.map((tc: any) => tc.function?.name).join(', ')}]
                     </div>
                  )}
                </div>
              </div>
            );
          })
        )}

        {isSending && (
          <div className="message assistant">
            <div className="message-bubble" style={{ padding: '12px 16px' }}>
              <div className="loading-dots">
                <span></span><span></span><span></span>
              </div>
            </div>
          </div>
        )}
        {error && (
          <div className="message system">
            <div className="message-bubble" style={{ color: 'var(--danger-color)' }}>
              Error: {error}
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="input-area" style={{ flexDirection: 'column' }}>
        {(selectedPrompts.length > 0 || selectedResources.length > 0) && (
           <div style={{ display: 'flex', gap: '8px', padding: '0 16px', marginBottom: '12px', flexWrap: 'wrap' }}>
             {selectedPrompts.map((p, i) => (
               <span key={`p-${i}`} style={{ backgroundColor: 'rgba(255,255,255,0.1)', padding: '4px 12px', borderRadius: '16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid rgba(255,255,255,0.2)' }}>
                 🚀 {p.name}
                 <button onClick={() => setSelectedPrompts(prev => prev.filter((_, idx) => idx !== i))} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: '0 4px', fontSize: '16px', lineHeight: 1 }}>&times;</button>
               </span>
             ))}
             {selectedResources.map((r, i) => (
               <span key={`r-${i}`} style={{ backgroundColor: 'rgba(255,255,255,0.1)', padding: '4px 12px', borderRadius: '16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid rgba(255,255,255,0.2)' }}>
                 📄 {r.name}
                 <button onClick={() => setSelectedResources(prev => prev.filter((_, idx) => idx !== i))} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: '0 4px', fontSize: '16px', lineHeight: 1 }}>&times;</button>
               </span>
             ))}
           </div>
        )}
        <div className="input-wrapper" style={{ position: 'relative' }}>
          {/* Prompts Auto-complete Menu */}
          {showPromptMenu && (
            <div style={{ position: 'absolute', bottom: '100%', left: 0, backgroundColor: '#2a2b36', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', marginBottom: '8px', maxHeight: '250px', overflowY: 'auto', zIndex: 10, width: '300px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
              {filteredPrompts.length === 0 ? (
                <div style={{ padding: '12px', fontSize: '13px', opacity: 0.7, textAlign: 'center' }}>No matching prompts</div>
              ) : (
                filteredPrompts.map((p: any, i: number) => (
                  <div key={i} onClick={() => handlePromptSelect(p.name)} style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: i < filteredPrompts.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none', transition: 'background-color 0.2s' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                     <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '4px' }}>{p.name}</div>
                     {p.description && <div style={{ fontSize: '12px', opacity: 0.7, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.description}</div>}
                  </div>
                ))
              )}
            </div>
          )}

          {/* Resources Auto-complete Menu */}
          {showResourceMenu && (
            <div style={{ position: 'absolute', bottom: '100%', left: 0, backgroundColor: '#2a2b36', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', marginBottom: '8px', maxHeight: '250px', overflowY: 'auto', zIndex: 10, width: '350px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
              {filteredResources.length === 0 ? (
                <div style={{ padding: '12px', fontSize: '13px', opacity: 0.7, textAlign: 'center' }}>No matching resources</div>
              ) : (
                filteredResources.map((r: any, i: number) => (
                  <div key={i} onClick={() => handleResourceSelect(r)} style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: i < filteredResources.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none', transition: 'background-color 0.2s' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                     <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                       {r.type === 'template' ? '🏗️' : '📄'} {r.name}
                     </div>
                     <div style={{ fontSize: '12px', opacity: 0.7, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                       {r.uri || r.uriTemplate}
                     </div>
                  </div>
                ))
              )}
            </div>
          )}

          <textarea
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Type your message... (Use / for Prompts, # for Resources)"
            disabled={isSending}
            rows={1}
          />
          <button
            onClick={handleSend}
            disabled={(!input.trim() && selectedPrompts.length === 0 && selectedResources.length === 0) || isSending}
            title="Send Message"
          >
            {isSending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </div>
      </div>
    </div>
  );
}
