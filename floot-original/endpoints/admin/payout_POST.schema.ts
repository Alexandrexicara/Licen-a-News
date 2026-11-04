import {z} from "zod";
import superjson from "superjson";
export const schema=z.object({payoutId:z.string().regex(/^\d+$/),method:z.enum(["pix","bank_transfer","other"]),reference:z.string().min(3).max(180)});
export type OutputType={updated:boolean;status:string};
export const postMarkPayout=async(body:z.infer<typeof schema>):Promise<OutputType>=>{const r=await fetch("/_api/admin/payout",{method:"POST",headers:{"Content-Type":"application/json"},body:superjson.stringify(schema.parse(body))});const d=superjson.parse<OutputType|{error:string}>(await r.text());if(!r.ok)throw new Error("error" in d?d.error:"Falha ao atualizar repasse");return d as OutputType;};