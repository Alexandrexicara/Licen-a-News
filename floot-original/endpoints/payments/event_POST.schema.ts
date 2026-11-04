import { z } from "zod";

export const schema = z
  .object({
    eventId: z.string(),
    type: z.string(),
  })
  .passthrough();

export type InputType = z.infer<typeof schema>;

export type OutputType =
  | {
      received: true;
    }
  | {
      error: string;
    };
