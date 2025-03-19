/**
 * Interface for image generation arguments
 */
export interface ImageGenerationArgs {
    prompt: string;
    image_prompt?: string;
    image_prompt_strength?: number;
    aspect_ratio?: string;
    safety_tolerance?: number;
    seed?: number;
    output_format?: string;
    raw?: boolean;
    response_format?: string;
}

/**
 * Interface for storing image generation results
 */
export interface ImageGeneration {
    prompt: string;
    response: any;
    timestamp: string;
}

/**
 * Validates arguments for the generate_image tool
 * @param {ImageGenerationArgs} args - The arguments to validate
 * @returns {boolean} - Whether the arguments are valid
 */
export function isValidImageGenerationArgs(args: ImageGenerationArgs): boolean {
    if (!args || typeof args !== 'object') return false;
    if (typeof args.prompt !== 'string' || args.prompt.trim() === '') return false;
    
    // Validate optional parameters if provided
    if (args.image_prompt !== undefined && typeof args.image_prompt !== 'string') return false;
    
    if (args.image_prompt_strength !== undefined) {
        const strength = Number(args.image_prompt_strength);
        if (isNaN(strength) || strength < 0 || strength > 1) return false;
    }
    
    if (args.aspect_ratio !== undefined) {
        const validRatios = ["21:9", "16:9", "3:2", "4:3", "5:4", "1:1", "4:5", "3:4", "2:3", "9:16", "9:21"];
        if (!validRatios.includes(args.aspect_ratio)) return false;
    }
    
    if (args.safety_tolerance !== undefined) {
        const tolerance = Number(args.safety_tolerance);
        if (!Number.isInteger(tolerance) || tolerance < 1 || tolerance > 6) return false;
    }
    
    if (args.seed !== undefined && !Number.isInteger(Number(args.seed))) return false;
    
    if (args.output_format !== undefined && !["jpg", "png"].includes(args.output_format)) return false;
    
    if (args.raw !== undefined && typeof args.raw !== 'boolean') return false;
    
    if (args.response_format !== undefined && !["url", "b64_json"].includes(args.response_format)) return false;
    
    return true;
} 