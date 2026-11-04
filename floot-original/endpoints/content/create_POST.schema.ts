import { z } from "zod";
import superjson from "superjson";
export const schema = z.object({
  contentType:z.enum(["article","photo","video","audio"]),
  title:z.string().min(5).max(240),
  summary:z.string().max(4000).optional().default(""),
  canonicalUrl:z.string().url().or(z.literal("")).optional().default(""),
  assetUrl:z.string().url().or(z.literal("")).optional().default(""),
  sourceName:z.string().max(180).optional().default(""),
  authorName:z.string().max(180).optional().default(""),
  rightsEvidenceUrl:z.string().url().or(z.literal("")).optional().default(""),
  rightsDeclaration:z.string().min(20).max(4000),
});
export type OutputType = {contentId:string;status:string};
export const postCreateContent = async (body:z.infer<typeof schema>):Promise<OutputType>=>{
 const result=await fetch("/_api/content/create",{method:"POST",headers:{"Content-Type":"application/json"},body:superjson.stringify(schema.parse(body))});
 const data=superjson.parse<OutputType|{error:string}>(await result.text());
 if(!result.ok) throw new Error("error" in data?data.error:"Falha ao cadastrar conteúdo");
 return data as OutputType;
};