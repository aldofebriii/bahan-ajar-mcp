import express from 'express';
import cors from 'cors';
import { McpServer, isInitializeRequest } from '@modelcontextprotocol/server';
import { NodeStreamableHTTPServerTransport } from '@modelcontextprotocol/node';
import { v7 } from 'uuid';
import { z } from 'zod';

const PORT = 8003;

const app = express();
app.use(cors);
app.use(express.json());

const TransportSession: Map<string, NodeStreamableHTTPServerTransport> = new Map();

function createMcpServer() {
    const server = new McpServer({ name: 'graph-viz', version: '0.0.1' });
    return server;
}

/**
 * Post request digunakan untuk membuat transport baru atau terhubung dengan transport yang sudah ada
 * Terhubung melalui TransportSession
 */
app.post('/mcp', async (req, res, next) => {
    try {
        const sessionId = req.headers['mcp-session-id'] as string;
        let transport: NodeStreamableHTTPServerTransport;
        if (sessionId && TransportSession.has(sessionId)) {
            transport = TransportSession.get(sessionId)!;
        } else if (!sessionId && isInitializeRequest(req.body)) {
            transport = new NodeStreamableHTTPServerTransport({
                sessionIdGenerator: () => v7(),
                onsessioninitialized: (newSessionId) => {
                    TransportSession.set(newSessionId, transport);
                },
            });

            transport.onclose = () => {
                if (TransportSession.has(sessionId)) {
                    TransportSession.delete(sessionId)
                }
            }
        } else {
            res.status(400).json({
                jsonrpc: "2.0",
                error: { code: -32000, message: "Bad Request: No valid session ID provided" },
                id: null,
            });
            return;
        }
        const server = createMcpServer();
        server.connect(transport)
        await transport.handleRequest(req, res, req.body);
    } catch (err) {
        return res.status(500).json('Internal Error : ' + err?.toString())
    }
})
app.get('/mcp')
app.delete('/mcp')

app.listen(PORT, () => {
    console.log('Server is connected ' + PORT)
})