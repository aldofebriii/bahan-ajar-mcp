import { Client, StreamableHTTPClientTransport, type ListPromptsResult, type ListResourcesResult, type ListResourceTemplatesResult, type ListToolsResult } from "@modelcontextprotocol/client";
import { Router, type Request } from "express";
import { v7 } from 'uuid';
import OpenAI from 'openai';

interface ClientInformation {
    url: string;
    client: Client;
    tools?: ListToolsResult['tools'];
    resources?: ListResourcesResult['resources'];
    resourceTemplates?: ListResourceTemplatesResult['resourceTemplates'];
    prompts?: ListPromptsResult['prompts'];
}
//Digunakan untuk menyimpan map url -> client information
const clientRecords: Map<string, ClientInformation> = new Map();

//Session dari user terdiri dari mcp-client yang terhubung dan history messagenya
interface UserSession {
    clients: ClientInformation[];
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[];
}
//Digunakan untuk menyimpan chat session -> client information + messages history
const userInMemory: Map<string, UserSession> = new Map();

interface ISinglePayload {
    url: string;
    name: string;
}

const router = Router();
/**
 * Digunakan untuk menambahkan hubungan 1 mcp server
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
        let clientInformation: ClientInformation = { client, url };
        try {
            await client.connect(transport, { timeout: 10000 });
        } catch (err) {
            console.error(err);
            return res.status(500).json({ message: err?.toString() })
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
    userInMemory.set(uuid, { clients: usedClients, messages: [] });
    return res.status(200).json({ sessionId: uuid });
});

router.get('/clients', (req, res, next) => {
    return res.status(200).json(Object.fromEntries(clientRecords));
});

router.get('/session/:sessionId', (req: Request<{ sessionId: string }>, res, next) => {
    const sessionId = req.params.sessionId;
    const session = userInMemory.get(sessionId);
    if (!session) return res.status(404).json({ message: "session not found" })
    return res.status(200).json({
        clients: session.clients.map(c => {
            const serverInfo = c.client.getServerVersion();
            return {
                url: c.url,
                name: serverInfo?.name,
                version: serverInfo?.version,
                tools: c.tools,
                resources: c.resources,
                resourceTemplates: c.resourceTemplates,
                prompts: c.prompts
            };
        }),
        messages: session.messages
    });
})


interface IAgentPayload {
    message: string;
    model?: string;
    resources?: string[];
    prompts?: { name: string, arguments?: Record<string, string> }[];
}

router.post('/session/:sessionId/agent', async (req: Request<{ sessionId: string }, {}, IAgentPayload>, res, next) => {
    const sessionId = req.params.sessionId;
    const session = userInMemory.get(sessionId);
    if (!session) return res.status(404).json({ message: "session not found" });

    const { message, model = "deepseek/deepseek-v4-flash-0731", resources = [], prompts = [] } = req.body;
    if (!message) {
        return res.status(400).json({ message: "Missing message" });
    }

    const endpoint = process.env.OPENAI_BASE_URL;
    const apiKey = process.env.OPENAI_API_KEY;

    if (!endpoint || !apiKey) {
        return res.status(500).json({ message: "Missing OPENAI_BASE_URL or OPENAI_API_KEY in environment variables" });
    }

    try {
        const openai = new OpenAI({
            baseURL: endpoint,
            apiKey: apiKey
        });
        const openAiTools: OpenAI.Chat.Completions.ChatCompletionTool[] = [];
        const availableTools: Record<string, { name: string; client: Client }> = {};

        for (const info of session.clients) {
            if (info.tools && info.tools.length > 0) {
                for (const tool of info.tools) {
                    openAiTools.push({
                        type: "function",
                        function: {
                            name: tool.name,
                            description: tool.description as string,
                            parameters: tool.inputSchema as any
                        }
                    });
                    availableTools[tool.name] = { name: tool.name, client: info.client };
                }
            }
        }

        let systemPromptContext = "You are a helpful AI assistant\n";

        // Fetch specified resources and inject into system prompt
        for (const resUrl of resources) {
            for (const info of session.clients) {
                try {
                    const resourceResult = await info.client.readResource({ uri: resUrl });
                    let content = '';
                    for (const c of resourceResult.contents) {
                        if ('text' in c) {
                            content += c.text;
                        }

                        if ('blob' in c) {
                            session.messages.push({
                                role: 'user',
                                content: [
                                    {
                                        type: 'file',
                                        file: { file_data: c.blob },
                                    },
                                ],
                            });
                        }

                    }
                    systemPromptContext += `--- Resource: ${resUrl} ---\n${content}\n\n`;
                    break; // Stop looking in other clients if found
                } catch (e) {
                    // Ignore and try next client
                }
            }
        }

        let userMessageContent = message;

        // Fetch specified prompts and inject into user message
        for (const p of prompts) {
            for (const info of session.clients) {
                try {
                    const promptResult = await info.client.getPrompt({ name: p.name, arguments: p.arguments });
                    for (const pm of promptResult.messages) {
                        const textContent = pm.content.type === 'text' ? pm.content.text : '[binary content]';
                        userMessageContent += `\n\n--- Prompt: ${p.name} ---\n${textContent}`;
                    }
                    break; // Stop looking in other clients if found
                } catch (e) {
                    // Ignore and try next client
                }
            }
        }

        // Jika ini pesan pertama, tambahkan system prompt
        if (session.messages.length === 0) {
            session.messages.push({ role: "system", content: systemPromptContext });
        }
        // Tambahkan pesan user baru ke history
        session.messages.push({ role: "user", content: userMessageContent });

        // Gunakan reference ke session.messages agar history terupdate otomatis
        const messages = session.messages;

        while (true) {
            const response = await openai.chat.completions.create({
                model: model,
                messages: messages,
                tools: openAiTools,
                tool_choice: "auto"
            });
            const choice = response.choices[0];
            if (!choice) {
                throw new Error("No response choice returned from OpenAI API");
            }
            const responseMessage = choice.message;
            messages.push(responseMessage);

            if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
                for (const toolCall of responseMessage.tool_calls) {
                    if (toolCall.type !== 'function') {
                        continue;
                    }
                    const functionName = toolCall.function.name;

                    let functionArgs;
                    try {
                        functionArgs = JSON.parse(toolCall.function.arguments);
                    } catch (e) {
                        functionArgs = {};
                    }

                    const toolInfo = availableTools[functionName];
                    if (toolInfo) {
                        try {
                            const result = await toolInfo.client.callTool({
                                name: toolInfo.name,
                                arguments: functionArgs
                            });

                            const resultText = result.content.map((c: any) => c.type === 'text' ? c.text : '[non-text content]').join('\n');

                            messages.push({
                                tool_call_id: toolCall.id,
                                role: "tool",
                                content: resultText
                            });
                        } catch (err: any) {
                            messages.push({
                                tool_call_id: toolCall.id,
                                role: "tool",
                                content: `Error executing tool: ${err.message}`
                            });
                        }
                    } else {
                        messages.push({
                            tool_call_id: toolCall.id,
                            role: "tool",
                            content: "Error: Tool not found"
                        });
                    }
                }
            } else {
                return res.status(200).json({
                    response: responseMessage.content,
                    history: session.messages
                });
            }
        }
    } catch (err: any) {
        console.error(err);
        return res.status(500).json({ message: err.message });
    }
});

export default router;