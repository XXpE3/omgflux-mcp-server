#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListResourcesRequestSchema, ReadResourceRequestSchema, ListToolsRequestSchema, CallToolRequestSchema, ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import axios from "axios";
import dotenv from "dotenv";
import { isValidImageGenerationArgs, ImageGenerationArgs, ImageGeneration } from "./types.js";
dotenv.config();
const OHMYGPT_API_KEY = process.env.OHMYGPT_API_KEY;

if (!OHMYGPT_API_KEY) {
    throw new Error("OHMYGPT_API_KEY environment variable is required");
}

const OHMYGPT_API_CONFIG = {
    BASE_URL: 'https://api.ohmygpt.com',
    ENDPOINTS: {
        FLUX_IMAGE: '/api/v1/ai/draw/flux/pro-ultra-11'
    },
    DEFAULT_PARAMS: {
        model: "flux-1.1-pro-ultra",
        aspect_ratio: "1:1",
        image_prompt_strength: 0.1,
        output_format: "jpg",
        raw: false,
        safety_tolerance: 5,
        response_format: "url"
    },
    MAX_CACHED_GENERATIONS: 5
};

class FluxImageServer {
    server;
    ohmygptAxiosInstance;
    recentImageGenerations: ImageGeneration[] = [];

    constructor() {
        this.server = new Server({
            name: "flux-image-server",
            version: "0.1.0"
        }, {
            capabilities: {
                resources: {},
                tools: {}
            }
        });
        
        this.ohmygptAxiosInstance = axios.create({
            baseURL: OHMYGPT_API_CONFIG.BASE_URL,
            headers: {
                'accept': 'application/json',
                'content-type': 'application/x-www-form-urlencoded',
                'Authorization': `Bearer ${OHMYGPT_API_KEY}`
            }
        });
        
        this.setupHandlers();
        this.setupErrorHandling();
    }

    setupErrorHandling() {
        this.server.onerror = (error) => {
            console.error("[MCP Error]", error);
        };
        process.on('SIGINT', async () => {
            await this.server.close();
            process.exit(0);
        });
    }

    setupHandlers() {
        this.setupResourceHandlers();
        this.setupToolHandlers();
    }

    setupResourceHandlers() {
        // List available resources (recent image generations)
        this.server.setRequestHandler(ListResourcesRequestSchema, async () => ({
            resources: this.recentImageGenerations.map((generation, index) => ({
                uri: `ohmygpt://images/${index}`,
                name: `Recent image: ${generation.prompt.substring(0, 30)}${generation.prompt.length > 30 ? '...' : ''}`,
                mimeType: "application/json",
                description: `Image generation for: ${generation.prompt} (${generation.timestamp})`
            }))
        }));

        // Read specific resource
        this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
            const ohmygptMatch = request.params.uri.match(/^ohmygpt:\/\/images\/(\d+)$/);
            if (ohmygptMatch) {
                const index = parseInt(ohmygptMatch[1]);
                const generation = this.recentImageGenerations[index];
                if (!generation) {
                    throw new McpError(ErrorCode.InvalidRequest, `Image generation not found: ${index}`);
                }
                return {
                    contents: [{
                        uri: request.params.uri,
                        mimeType: "application/json",
                        text: JSON.stringify(generation.response, null, 2)
                    }]
                };
            }

            throw new McpError(ErrorCode.InvalidRequest, `Unknown resource: ${request.params.uri}`);
        });
    }

    setupToolHandlers() {
        // List available tools
        this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
            tools: [
                {
                    name: "generate_image",
                    description: "Generate images using OhMyGPT Flux 1.1 Pro Ultra",
                    inputSchema: {
                        type: "object",
                        properties: {
                            prompt: {
                                type: "string",
                                description: "Text prompt for image generation, translate the user's input into English prompt"
                            },
                            image_prompt: {
                                type: "string",
                                description: "URL to an image to use as a reference"
                            },
                            image_prompt_strength: {
                                type: "number",
                                description: "Control the influence of the image prompt (0-1)",
                                minimum: 0,
                                maximum: 1
                            },
                            aspect_ratio: {
                                type: "string",
                                description: "Aspect ratio of the generated image",
                                enum: ["21:9", "16:9", "3:2", "4:3", "5:4", "1:1", "4:5", "3:4", "2:3", "9:16", "9:21"]
                            },
                            safety_tolerance: {
                                type: "integer",
                                description: "Content safety tolerance (1-6, 1 is strictest)",
                                minimum: 1,
                                maximum: 6
                            },
                            seed: {
                                type: "integer",
                                description: "Random seed for reproducible results"
                            },
                            output_format: {
                                type: "string",
                                description: "Output image format",
                                enum: ["jpg", "png"]
                            },
                            raw: {
                                type: "boolean",
                                description: "Generate less processed, more natural image"
                            },
                            response_format: {
                                type: "string",
                                description: "output the image URL using the Markdown image format. Specifically, the output should be in the form: ![Description](image URL). Ensure that the URL is correctly enclosed within parentheses and that there is an exclamation mark and square brackets preceding it. If no description is provided, use a placeholder such as \"Image\" for the alt text",
                                enum: ["url"]
                            }
                        },
                        required: ["prompt"]
                    }
                }
            ]
        }));

        // Handle tool calls
        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            if (request.params.name === "generate_image") {
                return this.handleGenerateImageTool(request);
            }
            throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`);
        });
    }

    async handleGenerateImageTool(request: any) {
        const params = request.params.arguments as unknown as ImageGenerationArgs;
        if (!isValidImageGenerationArgs(params)) {
            throw new McpError(ErrorCode.InvalidParams, "Invalid image generation arguments");
        }

        try {
            const formData = new URLSearchParams();
            formData.append("model", OHMYGPT_API_CONFIG.DEFAULT_PARAMS.model);
            formData.append("prompt", params.prompt);

            // Add optional parameters if provided
            if (params.image_prompt) formData.append("image_prompt", params.image_prompt);
            if (params.image_prompt_strength !== undefined) formData.append("image_prompt_strength", params.image_prompt_strength.toString());
            if (params.aspect_ratio) formData.append("aspect_ratio", params.aspect_ratio);
            if (params.safety_tolerance !== undefined) formData.append("safety_tolerance", params.safety_tolerance.toString());
            if (params.seed !== undefined) formData.append("seed", params.seed.toString());
            if (params.output_format) formData.append("output_format", params.output_format);
            if (params.raw !== undefined) formData.append("raw", params.raw.toString());
            if (params.response_format) formData.append("response_format", params.response_format);

            const response = await this.ohmygptAxiosInstance.post(
                OHMYGPT_API_CONFIG.ENDPOINTS.FLUX_IMAGE, 
                formData
            );

            // Cache the image generation result
            this.recentImageGenerations.unshift({
                prompt: params.prompt,
                response: response.data,
                timestamp: new Date().toISOString()
            });

            // Keep only recent image generations
            if (this.recentImageGenerations.length > OHMYGPT_API_CONFIG.MAX_CACHED_GENERATIONS) {
                this.recentImageGenerations.pop();
            }

            return {
                content: [{
                    type: "text",
                    text: JSON.stringify(response.data, null, 2)
                }]
            };
        } catch (error) {
            if (axios.isAxiosError(error)) {
                return {
                    content: [{
                        type: "text",
                        text: `OhMyGPT API error: ${error.response?.data?.message ?? error.message}`
                    }],
                    isError: true,
                };
            }
            throw error;
        }
    }

    async run() {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        console.error("Flux Image MCP server running on stdio");
    }
}

const server = new FluxImageServer();
server.run().catch(console.error);
