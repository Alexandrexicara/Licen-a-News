import {
  getPaymentCallbackEventFromRequest,
  PaymentCallbackEvent,
} from "@floot/payments";
import { OutputType } from "./event_POST.schema";
import { db } from "../../helpers/db";
import { nanoid } from "nanoid";

export async function handle(request: Request) {
  let event: PaymentCallbackEvent;
  try {
    event = await getPaymentCallbackEventFromRequest(request);
  } catch {
    return Response.json(
      { error: "Invalid payment callback" } satisfies OutputType,
      { status: 400 }
    );
  }

  const recorded = await db.insertInto("paymentEvents")
    .values({ eventId: event.eventId, eventType: event.type, payload: event as any })
    .onConflict((oc) => oc.column("eventId").doNothing())
    .returning("id").executeTakeFirst();
  if (!recorded) return Response.json({ received: true } satisfies OutputType);

  if ((event.type === "payment.refunded" || event.type === "dispute.created") && event.metadata.licenseRequestId) {
    const requestId = event.metadata.licenseRequestId;
    await db.updateTable("issuedLicenses").set({status:"revoked"}).where("requestId","=",requestId).execute();
    await db.updateTable("licenseRequests").set({status:"revoked"}).where("id","=",requestId).execute();
    await db.updateTable("ownerPayouts").set({status:"failed",updatedAt:new Date()}).where("requestId","=",requestId).where("status","=","pending").execute();
    await db.insertInto("auditLogs").values({actorUserId:null,action:event.type==="payment.refunded"?"license.revoked_refund":"license.suspended_dispute",entityType:"license_request",entityId:String(requestId),details:{eventId:event.eventId,amountRefunded:event.amountRefunded??null}}).execute();
  }

  if (event.type === "payment.succeeded" && event.metadata.licenseRequestId) {
    const requestId = event.metadata.licenseRequestId;
    const licenseRequest = await db.selectFrom("licenseRequests")
      .selectAll().where("id", "=", requestId).executeTakeFirst();
    if (licenseRequest && licenseRequest.status === "approved_pending_payment" &&
        event.amount === licenseRequest.amountCents && event.currency === "brl") {
      const now = new Date(event.occurredAt * 1000);
      const offer = await db.selectFrom("licenseOffers").select(["durationDays","territory","terms"])
        .where("id","=",licenseRequest.offerId).executeTakeFirst();
      if (offer) {
        const expiresAt = new Date(now.getTime() + offer.durationDays * 86400000);
        const code = "LN-" + nanoid(18).toUpperCase();
        await db.insertInto("issuedLicenses").values({
          licenseCode:code,requestId:licenseRequest.id,contentId:licenseRequest.contentId,
          ownerUserId:licenseRequest.ownerUserId,buyerUserId:licenseRequest.buyerUserId,
          purpose:licenseRequest.requestedPurpose,territory:offer.territory,
          startsAt:now,expiresAt,termsSnapshot:offer.terms,status:"active"
        }).onConflict((oc)=>oc.column("requestId").doNothing()).returning("id").executeTakeFirst();
        await db.insertInto("ownerPayouts").values({requestId:licenseRequest.id,ownerUserId:licenseRequest.ownerUserId,amountCents:licenseRequest.ownerAmountCents,currency:"BRL",status:"pending"}).onConflict((oc)=>oc.column("requestId").doNothing()).execute();
        await db.updateTable("licenseRequests").set({
          status:"active",paidAt:now,paymentIntentId:event.paymentIntentId ?? null
        }).where("id","=",requestId).where("status","=","approved_pending_payment").execute();
        await db.insertInto("auditLogs").values({
          actorUserId:null,action:"license.activated",entityType:"license_request",
          entityId:String(requestId),details:{licenseCode:code,eventId:event.eventId,stage:event.stage}
        }).execute();
      }
    } else {
      console.error("Payment event did not match a pending license request", event.eventId);
    }
  }

  return Response.json({ received: true } satisfies OutputType);
}
