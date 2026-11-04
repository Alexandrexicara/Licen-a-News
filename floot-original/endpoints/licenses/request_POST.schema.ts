import {z} from "zod";
import superjson from "superjson";
export const schema=z.object({offerId:z.string().regex(/^\d+$/),companyName:z.string().min(2).max(180),acceptedTerms:z.literal(true)});
export type OutputType={requestId:string;checkoutUrl:string;amountCents:number;platformFeeCents:number;ownerAmountCents:number};
export const postRequestLicense=async(body:z.infer<typeof schema>):Promise<OutputType>=>{const r=await fetch("/_api/licenses/request",{method:"POST",headers:{"Content-Type":"application/json"},body:superjson.stringify(schema.parse(body))});const d=superjson.parse<OutputType|{error:string}>(await r.text());if(!r.ok)throw new Error("error" in d?d.error:"Falha ao solicitar licença");return d as OutputType;};