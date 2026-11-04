import { z } from "zod";

export const schema = z.object({}).passthrough();

export type InputType = z.infer<typeof schema>;

export type OutputType = string;
