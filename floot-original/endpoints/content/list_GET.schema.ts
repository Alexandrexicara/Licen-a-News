import {z} from "zod";
import superjson from "superjson";
export const schema=z.object({});
export type OutputType={items:Array<{id:string;title:string;contentType:string;status:string;createdAt:string}>};
export const getMyContent=async():Promise<OutputType>=>{
 const r=await fetch("/_api/content/list",{method:"GET"});
 const d=superjson.parse<OutputType|{error:string}>(await r.text());
 if(!r.ok) throw new Error("error" in d?d.error:"Falha ao carregar conteúdos");
 return d as OutputType;
};