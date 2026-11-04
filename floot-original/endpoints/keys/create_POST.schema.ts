import {z} from "zod";
import superjson from "superjson";
export const schema=z.object({label:z.string().min(2).max(80)});
export type OutputType={apiKey:string;prefix:string;message:string};
export const postCreateApiCredential=async(body:z.infer<typeof schema>):Promise<OutputType>=>{const r=await fetch("/_api/keys/create",{method:"POST",headers:{"Content-Type":"application/json"},body:superjson.stringify(schema.parse(body))});const d=superjson.parse<OutputType|{error:string}>(await r.text());if(!r.ok)throw new Error("error" in d?d.error:"Falha ao criar chave");return d as OutputType;};