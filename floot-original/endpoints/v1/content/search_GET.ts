import {db} from "../../../helpers/db";
import superjson from "superjson";
export const flootPublic=true;
export const flootPreviewPublic=true;
async function sha256(value:string){const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));return Array.from(new Uint8Array(digest)).map(x=>x.toString(16).padStart(2,"0")).join("");}
export async function handle(request:Request){
 const auth=request.headers.get("authorization")||"";const key=auth.startsWith("Bearer ")?auth.slice(7):"";
 if(!key)return Response.json({error:"API key required"},{status:401});
 const hash=await sha256(key);const credential=await db.selectFrom("apiCredentials").select("id").where("keyHash","=",hash).where("revokedAt","is",null).executeTakeFirst();
 if(!credential)return Response.json({error:"Invalid API key"},{status:401});
 await db.updateTable("apiCredentials").set({lastUsedAt:new Date()}).where("id","=",credential.id).execute();
 const url=new URL(request.url);const q=(url.searchParams.get("q")||"").trim();const purpose=url.searchParams.get("purpose");
 let query=db.selectFrom("licenseOffers").innerJoin("contentItems","contentItems.id","licenseOffers.contentId").innerJoin("users","users.id","licenseOffers.ownerUserId").innerJoin("publisherProfiles","publisherProfiles.userId","licenseOffers.ownerUserId")
  .select(["contentItems.id as contentId","contentItems.title","contentItems.summary","contentItems.contentType","users.displayName as publisher","licenseOffers.purpose","licenseOffers.priceCents","licenseOffers.currency","licenseOffers.territory","licenseOffers.durationDays"])
  .where("licenseOffers.active","=",true).where("contentItems.status","=","approved").where("publisherProfiles.verificationStatus","=","approved");
 if(q)query=query.where("contentItems.title","ilike","%"+q+"%");
 if(purpose&&["indexing","summary","snippet","reproduction","ai_training"].includes(purpose))query=query.where("licenseOffers.purpose","=",purpose);
 const items=await query.orderBy("contentItems.createdAt","desc").limit(50).execute();
 return new Response(superjson.stringify({items:items.map(x=>({...x,contentId:String(x.contentId)}))}),{headers:{"Content-Type":"application/json"}});
}