import { z } from "zod";
import superjson from "superjson";
export const schema = z.object({
  accountType: z.enum(["journalist","publisher","buyer","both"]),
  organizationName: z.string().max(180).optional().default(""),
  documentNumber: z.string().max(40).optional().default(""),
  websiteUrl: z.string().url().or(z.literal("")).optional().default(""),
  contactPhone: z.string().max(40).optional().default(""),
  rightsDeclaration: z.string().max(4000).optional().default(""),
});
export type OutputType = { profileId: string; verificationStatus: string };
export const postSaveProfile = async (body: z.infer<typeof schema>): Promise<OutputType> => {
  const result = await fetch("/_api/profile/save", { method:"POST", headers:{"Content-Type":"application/json"}, body:superjson.stringify(schema.parse(body)) });
  const data = superjson.parse<OutputType | {error:string}>(await result.text());
  if (!result.ok) throw new Error("error" in data ? data.error : "Falha ao salvar perfil");
  return data as OutputType;
};