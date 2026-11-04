import {z} from "zod";
import superjson from "superjson";
export const schema=z.object({entityType:z.enum(["publisher","content"]),entityId:z.string().regex(/^\d+$/),decision:z.enum(["approved","rejected"]),notes:z.string().max(3000).optional().default("")});
export type OutputType={updated:boolean;status:string};
export const postReview=async(body:z.infer<typeof schema>):Promise<OutputType>=>{const r=await fetch("/_api/admin/review",{method:"POST",headers:{"Content-Type":"application/json"},body:superjson.stringify(schema.parse(body))});const d=superjson.parse<OutputType|{error:string}>(await r.text());if(!r.ok)throw new Error("error" in d?d.error:"Falha na revisão");return d as OutputType;};