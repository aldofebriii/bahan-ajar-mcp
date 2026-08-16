import { Client, StreamableHTTPClientTransport, type ListPromptsResult, type ListResourcesResult, type ListResourceTemplatesResult, type ListToolsResult } from "@modelcontextprotocol/client";
import { Router, type Request } from "express";
import { v7 } from 'uuid';

interface ClientInformation {
    url: string;
    client: Client;
    transport: StreamableHTTPClientTransport;
    tools?: ListToolsResult['tools'];
    resources?: ListResourcesResult['resources'];
    resourceTemplates?: ListResourceTemplatesResult['resourceTemplates'];
    prompts?: ListPromptsResult['prompts'];
}
//Digunakan untuk menyimpan map url -> client information
const clientRecords: Map<string, ClientInformation> = new Map();
//Digunakna untuk menyimpan chat session -> seluruh client information terhubung
const userInMemory: Map<string, ClientInformation[]> = new Map();

interface ISinglePayload {
    url: string;
    name: string;
}

const router = Router();
/**
 * Digunakan untuk inisasi MCP Server dari client ke mcp server
 */
router.post('/single', async (req: Request<{}, {}, ISinglePayload>, res, next) => {
    const { url, name } = req.body;
    if (url && URL.canParse(url) && name) {
        //Validasi terlebih dahulu namenya
        if (clientRecords.get(name)) return res.status(400).json({ message: 'invalid client name' })
        //Selalu terhubung menggunakan client dan transport
        const client = new Client({ name: name, version: '0.0.1' })
        const transport = new StreamableHTTPClientTransport(new URL(url));
        //Hubungkan Client,Transport dan Server
        let clientInformation: ClientInformation = { client, transport, url };
        try {
            await client.connect(transport, { timeout: 10000 });
        } catch (err) {
            console.error(err);
            return res.status(500).json({ message: err })
        };

        const capabilites = client.getServerCapabilities();
        if (!capabilites) return res.status(500).json({ message: "server doest not have any capabilites" })
        if (capabilites.tools) {
            const listTools = await client.listTools();
            clientInformation.tools = listTools.tools;
        };

        if (capabilites.resources) {
            const listResources = await client.listResources();
            const listTemplateResources = await client.listResourceTemplates()
            clientInformation.resources = listResources.resources;
            clientInformation.resourceTemplates = listTemplateResources.resourceTemplates;
        };

        if (capabilites.prompts) {
            const listPrompts = await client.listPrompts();
            clientInformation.prompts = listPrompts.prompts;
        }
        clientRecords.set(name, clientInformation);
        return res.status(200).json(clientInformation)
    } else {
        return res.status(400).json({ message: 'invalid url' });
    }
});

interface INewChatPayload {
    names: string[];
}

router.post('/new', (req: Request<{}, {}, INewChatPayload>, res, next) => {
    const { names } = req.body;
    const usedClients: ClientInformation[] = [];
    try {
        for (const name of names) {
            const client = clientRecords.get(name);
            if (!client) throw new Error('client tidak ditemukan');
            usedClients.push(client);
        };
    } catch (err) {
        return res.status(500).json({ message: err?.toString() })
    }
    const uuid = v7();
    userInMemory.set(uuid, usedClients);
    return res.status(200).json({ sessionId: uuid });
});

router.get('/session/:sessionId', (req: Request<{ sessionId: string }>, res, next) => {
    const sessionId = req.params.sessionId;
    const userSession = userInMemory.get(sessionId);
    if (!userSession) return res.status(404).json({ message: "session not found" })
    return res.status(200).json(userSession);
})

export default router;