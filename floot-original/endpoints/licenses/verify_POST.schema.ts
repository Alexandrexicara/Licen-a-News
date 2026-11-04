import {z} from "zod";
import superjson from "superjson";
export const schema=z.object({licenseCode:z.string().min(10).max(80)});
export type OutputType={valid:boolean;license?:{licenseCode:string;contentTitle:string;purpose:string;territory:string;startsAt:string;expiresAt:string;status:string};message:string};
export const postVerifyLicense=async(body:z.infer<typeof schema>):Promise<OutputType>=>{const r=await fetch("/_api/licenses/verify",{method:"POST",headers:{"Content-Type":"application/json"},body:superjson.stringify(schema.parse(body))});return superjson.parse<OutputType>(await r.text());};