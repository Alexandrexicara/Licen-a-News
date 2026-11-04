import {schema,OutputType} from "./request_POST.schema";
import {db} from "../../helpers/db";
import {getServerUserSession} from "../../helpers/getServerUserSession";
import {NotAuthenticatedError} from "../../helpers/getSetServerSession";
import {createStripeCheckoutSession} from "../../helpers/createStripeCheckoutSession";
import superjson from "superjson";
export async function handle(request:Request){
 try{
  const {user}=await getServerUserSession(request);const input=schema.parse(superjson.parse(await request.text()));
  if(!input.acceptedTerms)return new Response(superjson.stringify({error:"É necessário aceitar os termos da licença."}),{status:400});
  const buyer=await db.selectFrom("publisherProfiles").select(["accountType","verificationStatus"]).where("userId","=",user.id).executeTakeFirst();
  if(!buyer||buyer.verificationStatus!=="approved"||!["buyer","both"].includes(buyer.accountType))return new Response(superjson.stringify({error:"A solicitação exige perfil de empresa compradora aprovado."}),{status:403});
  const offer=await db.selectFrom("licenseOffers").innerJoin("contentItems","contentItems.id","licenseOffers.contentId").innerJoin("publisherProfiles","publisherProfiles.userId","licenseOffers.ownerUserId").select(["licenseOffers.id","licenseOffers.contentId","licenseOffers.ownerUserId","licenseOffers.purpose","licenseOffers.priceCents","licenseOffers.currency","licenseOffers.territory","licenseOffers.durationDays","licenseOffers.terms","contentItems.status as contentStatus","publisherProfiles.verificationStatus"]).where("licenseOffers.id","=",input.offerId).where("licenseOffers.active","=",true).executeTakeFirst();
  if(!offer||offer.contentStatus!=="approved"||offer.verificationStatus!=="approved")return new Response(superjson.stringify({error:"Oferta indisponível: conteúdo e titular precisam estar aprovados."}),{status:409});
  if(offer.ownerUserId===user.id)return new Response(superjson.stringify({error:"Não é possível licenciar seu próprio conteúdo."}),{status:400});
  const amount=offer.priceCents;const fee=Math.round(amount*0.15);const ownerAmount=amount-fee;
  const req=await db.insertInto("licenseRequests").values({offerId:offer.id,contentId:offer.contentId,buyerUserId:user.id,ownerUserId:offer.ownerUserId,companyName:input.companyName,requestedPurpose:offer.purpose,agreedTerms:offer.terms,status:"approved_pending_payment",amountCents:amount,platformFeeCents:fee,ownerAmountCents:ownerAmount}).returning("id").executeTakeFirstOrThrow();
  try{
   const session=await createStripeCheckoutSession(request,{mode:"payment",line_items:[{price_data:{currency:"brl",unit_amount:amount,product_data:{name:"Licença de conteúdo Licença News",description:"Autorização contratual com escopo definido. Solicitação "+String(req.id)}},quantity:1}],payment_intent_data:{metadata:{licenseRequestId:String(req.id),purpose:offer.purpose,contentId:String(offer.contentId)}},metadata:{licenseRequestId:String(req.id)}});
   await db.updateTable("licenseRequests").set({paymentSessionId:session.id}).where("id","=",req.id).execute();
   await db.insertInto("auditLogs").values({actorUserId:user.id,action:"license.checkout_created",entityType:"license_request",entityId:String(req.id),details:{amountCents:amount,platformFeeCents:fee,ownerAmountCents:ownerAmount}}).execute();
   return new Response(superjson.stringify({requestId:String(req.id),checkoutUrl:session.url,amountCents:amount,platformFeeCents:fee,ownerAmountCents:ownerAmount} satisfies OutputType),{headers:{"Content-Type":"application/json"}});
  }catch(paymentError){
   await db.updateTable("licenseRequests").set({status:"rejected"}).where("id","=",req.id).execute();
   throw paymentError;
  }
 }catch(e){const status=e instanceof NotAuthenticatedError?401:400;return new Response(superjson.stringify({error:e instanceof Error?e.message:"Erro ao solicitar licença"}),{status,headers:{"Content-Type":"application/json"}});}
}