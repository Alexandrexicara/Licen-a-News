import express from "express";
import { randomBytes, randomUUID, createHash, timingSafeEqual } from "node:crypto";
import { query, transaction } from "./db.js";
import { authRequired } from "./auth.js";
import {
  saveWooviAccount, getWooviAccount, getWooviAccountStatus, removeWooviAccount,
  getWooviAccountForWebhook, verifyWooviWebhook, wooviRequest, createPlatformCommissionPayout
} from "./woovi.js";

const router=express.Router();
const webhooks=express.Router();
const asyncRoute=fn=>(req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next);
const API_BASE=()=>String(process.env.PUBLIC_API_URL||"https://licenca-news-api.onrender.com").replace(/\/$/,"");

async function registerAccountWebhook(appId,userId,token,event) {
  return wooviRequest(appId,"/api/v1/webhook",{
    webhook:{
      name:"Licenca News - "+event,
      event,
      url:API_BASE()+"/api/v1/webhooks/woovi/"+encodeURIComponent(userId)+"/"+encodeURIComponent(token)+"?validate=false",
      authorization:token,
      isActive:true
    }
  });
}

router.get("/me",authRequired,asyncRoute(async(req,res)=>{
  res.json(await getWooviAccountStatus(req.user.sub));
}));
router.post("/me/authorization",authRequired,asyncRoute(async(req,res)=>{
  if(req.body?.accepted!==true) return res.status(400).json({error:"É necessário aceitar expressamente a autorização da comissão."});
  const account=await getWooviAccount(req.user.sub);
  if(!account) return res.status(409).json({error:"Conecte primeiro sua conta Woovi."});
  const version="licenca-news-commission-15-v1";
  const hint=String(process.env.WOOVI_PLATFORM_PIX_KEY||"").replace(/^(.{2}).+(@.+)$/,"$1••••$2");
  await query("UPDATE user_woovi_accounts SET consented_at=now(),consent_version=$2,consent_destination_hint=$3,payout_permission_status='pending',payout_permission_verified_at=NULL,updated_at=now() WHERE user_id=$1",[req.user.sub,version,hint]);
  await query("INSERT INTO woovi_authorization_audit(user_id,action,consent_version,destination_hint,details) VALUES($1,'commission_consent_accepted',$2,$3,$4::jsonb)",[req.user.sub,version,hint,JSON.stringify({commissionPercent:15,accepted:true})]);
  res.json({consented:true,commissionPercent:15,payoutPermissionStatus:"pending",message:"Autorização registrada. Falta comprovar a permissão Pix Out da Woovi."});
}));
router.post("/me/verify-payout",authRequired,asyncRoute(async(req,res)=>{
  if(req.body?.confirmTestTransfer!==true) return res.status(400).json({error:"Confirme expressamente o envio de um Pix real de R$ 0,01 para validar a permissão."});
  const state=await query("SELECT consented_at,payout_permission_status FROM user_woovi_accounts WHERE user_id=$1",[req.user.sub]);
  if(!state.rowCount||!state.rows[0].consented_at) return res.status(409).json({error:"Registre primeiro sua autorização da comissão de 15%."});
  const account=await getWooviAccount(req.user.sub);
  const pixKey=String(process.env.WOOVI_PLATFORM_PIX_KEY||"").trim();
  const pixKeyType=String(process.env.WOOVI_PLATFORM_PIX_KEY_TYPE||"").trim().toUpperCase();
  if(!pixKey||!["CPF","CNPJ","EMAIL","PHONE","RANDOM"].includes(pixKeyType)) return res.status(503).json({error:"Chave Pix de destino não configurada."});
  const correlationID="ln-validacao-"+req.user.sub+"-"+randomUUID();
  const result=await wooviRequest(account.appId,"/api/v1/payment",{type:"PIX_KEY",value:1,correlationID,destinationAlias:pixKey,destinationAliasType:pixKeyType,comment:"Validacao de permissao Pix Out - Licenca News",autoApprove:true});
  const status=String(result?.payment?.status||"").toUpperCase();
  if(!["APPROVED","CONFIRMED"].includes(status)) return res.status(409).json({error:"A Woovi não aprovou o Pix de validação.",providerStatus:status||"unknown"});
  await query("UPDATE user_woovi_accounts SET payout_test_correlation_id=$2,payout_permission_status='testing',updated_at=now() WHERE user_id=$1",[req.user.sub,correlationID]);
  await query("INSERT INTO woovi_authorization_audit(user_id,action,consent_version,destination_hint,details) VALUES($1,'pix_out_test_requested',$2,$3,$4::jsonb)",[req.user.sub,"licenca-news-commission-15-v1",String(process.env.WOOVI_PLATFORM_PIX_KEY||"").slice(-4),JSON.stringify({correlationID,valueCents:1,status})]);
  res.status(202).json({testRequested:true,status:"testing",message:"Pix de R$ 0,01 solicitado. A liberação ocorrerá somente após a confirmação do webhook da Woovi."});
}));
router.post("/me",authRequired,asyncRoute(async(req,res)=>{
  const appId=String(req.body?.appId||"").trim();
  if(!appId||appId.length>512)return res.status(400).json({error:"Informe o AppID da sua conta Woovi."});
  const profile=await query("SELECT account_type FROM publisher_profiles WHERE user_id=$1",[req.user.sub]);
  if(!profile.rowCount||!["journalist","publisher","influencer","both"].includes(profile.rows[0].account_type))
    return res.status(403).json({error:"A conexão Woovi está disponível para contas de jornalistas, veículos e criadores."});
  const token=randomBytes(32).toString("hex");
  const chargeHook=await registerAccountWebhook(appId,req.user.sub,token,"OPENPIX:CHARGE_COMPLETED");
  await registerAccountWebhook(appId,req.user.sub,token,"OPENPIX:MOVEMENT_CONFIRMED");
  await registerAccountWebhook(appId,req.user.sub,token,"OPENPIX:MOVEMENT_FAILED");
  const hmacSecret=chargeHook?.webhook?.hmacSecretKey||chargeHook?.hmacSecretKey;
  if(!hmacSecret)throw new Error("A Woovi não retornou a chave de assinatura do webhook. A conta não foi conectada.");
  await saveWooviAccount(req.user.sub,appId,hmacSecret,token);
  res.json({connected:true,message:"Woovi conectada. Os avisos de cobrança e transferência foram registrados automaticamente.",...(await getWooviAccountStatus(req.user.sub))});
}));
router.delete("/me",authRequired,asyncRoute(async(req,res)=>{
  await removeWooviAccount(req.user.sub);
  res.json({connected:false,message:"Conta Woovi desconectada do Licença News."});
}));
router.post("/licenses/:id/payment",authRequired,asyncRoute(async(req,res)=>{
  const found=await query(`SELECT o.*,p.name AS publisher_name,p.email AS publisher_email
    FROM license_orders o JOIN app_users p ON p.id=o.publisher_user_id
    WHERE o.id=$1 AND o.buyer_user_id=$2`,[req.params.id,req.user.sub]);
  if(!found.rowCount)return res.status(404).json({error:"Solicitação não encontrada."});
  const order=found.rows[0];
  if(order.status!=="accepted")return res.status(409).json({error:"O titular precisa aprovar a autorização antes do pagamento."});
  if(order.woovi_charge_correlation_id) {
    return res.json({payment:{correlationID:order.woovi_charge_correlation_id,brCode:order.woovi_br_code,paymentLinkUrl:order.woovi_payment_link_url,status:"ACTIVE"}});
  }
  const authorization=await query("SELECT consented_at,payout_permission_status,payout_permission_verified_at FROM user_woovi_accounts WHERE user_id=$1",[order.publisher_user_id]);
  if(!authorization.rowCount||!authorization.rows[0].consented_at||authorization.rows[0].payout_permission_status!=="verified"||!authorization.rows[0].payout_permission_verified_at)return res.status(409).json({error:"O titular ainda não autorizou a comissão ou não comprovou a permissão Pix Out."});
  const account=await getWooviAccount(order.publisher_user_id);
  if(!account)return res.status(409).json({error:"O titular ainda não conectou sua conta Woovi."});
  const correlationID=randomUUID();
  const amount=Number(order.gross_amount_cents);
  if(!Number.isSafeInteger(amount)||amount<=0)return res.status(400).json({error:"Valor da licença inválido."});
  const result=await wooviRequest(account.appId,"/api/v1/charge",{
    value:amount,correlationID,comment:"Licença News - pedido "+order.id,
    customer:{name:String(req.user.name||"Comprador").slice(0,100)}
  });
  const charge=result.charge||{};
  if(!charge.brCode&&!result.brCode&&!charge.paymentLinkUrl)throw new Error("A Woovi criou a cobrança sem retornar um código Pix ou link de pagamento.");
  const brCode=charge.brCode||result.brCode||null;
  const link=charge.paymentLinkUrl||null;
  const identifier=charge.identifier||charge.transactionID||null;
  await query(`UPDATE license_orders SET woovi_charge_correlation_id=$2,woovi_charge_identifier=$3,
    woovi_br_code=$4,woovi_payment_link_url=$5,updated_at=now()
    WHERE id=$1 AND buyer_user_id=$6 AND status='accepted'`,
    [order.id,correlationID,identifier,brCode,link,req.user.sub]);
  res.status(201).json({payment:{correlationID,brCode,paymentLinkUrl:link,qrCodeImage:charge.qrCodeImage||null,expiresDate:charge.expiresDate||null,status:charge.status||"ACTIVE"}});
}));
router.get("/me/payouts",authRequired,asyncRoute(async(req,res)=>{
  const r=await query(`SELECT p.id,p.order_id,p.amount_cents,p.status,p.provider_end_to_end_id,p.error_message,p.created_at,p.confirmed_at
    FROM woovi_payouts p WHERE p.user_id=$1 ORDER BY p.created_at DESC LIMIT 100`,[req.user.sub]);
  res.json({payouts:r.rows});
}));

async function issueLicenseForPaidOrder(orderId) {
  await transaction(async client=>{
    const found=await client.query(`SELECT o.*,f.content_id,f.purpose,f.territory,f.duration_days
      FROM license_orders o JOIN license_offers f ON f.id=o.offer_id WHERE o.id=$1 FOR UPDATE OF o`,[orderId]);
    if(!found.rowCount)return;
    const o=found.rows[0];
    if(o.status!=="paid")return;
    const exists=await client.query("SELECT id FROM issued_licenses WHERE order_id=$1",[orderId]);
    if(exists.rowCount)return;
    const code="LN-"+randomBytes(12).toString("hex").toUpperCase();
    await client.query(`INSERT INTO issued_licenses(order_id,license_code,content_id,owner_user_id,buyer_user_id,purpose,territory,starts_at,expires_at,status)
      VALUES($1,$2,$3,$4,$5,$6,$7,now(),now()+($8::int * interval '1 day'),'active')
      ON CONFLICT(order_id) DO NOTHING`,
      [orderId,code,o.content_id,o.publisher_user_id,o.buyer_user_id,o.purpose,o.territory,o.duration_days]);
    await client.query("INSERT INTO audit_logs(actor_user_id,action,entity_type,entity_id,details) VALUES($1,'license.issued.payment_confirmed','license_order',$2,$3::jsonb)",
      [o.publisher_user_id,String(orderId),JSON.stringify({licenseCode:code,wooviPaymentConfirmed:true})]);
  });
}

webhooks.post("/:userId/:token",asyncRoute(async(req,res)=>{
  const account=await getWooviAccountForWebhook(req.params.userId,req.params.token);
  if(!account)return res.status(401).json({error:"Webhook não autorizado."});
  const authorization=String(req.headers.authorization||"").replace(/^Bearer\s+/i,"");
  const event=String(req.body?.event||"");
  const chargeEvent=event==="OPENPIX:CHARGE_COMPLETED";
  const authOk=authorization===req.params.token;
  const signatureOk=chargeEvent&&verifyWooviWebhook(req.rawBody,req.headers,account.hmacSecret);
  if(!authOk&&!signatureOk)return res.status(401).json({error:"Assinatura do webhook inválida."});

  const correlationID=String(req.body?.charge?.correlationID||req.body?.payment?.correlationID||"");
  if(!correlationID)return res.status(200).json({received:true,ignored:true});
  const inserted=await query(`INSERT INTO woovi_webhook_events(user_id,event_type,correlation_id,payload)
    VALUES($1,$2,$3,$4::jsonb) ON CONFLICT(user_id,event_type,correlation_id) DO NOTHING RETURNING id`,
    [req.params.userId,event,correlationID,JSON.stringify(req.body||{})]);
  if(!inserted.rowCount)return res.status(200).json({received:true,duplicate:true});

  if(event==="OPENPIX:MOVEMENT_CONFIRMED" || event==="OPENPIX:MOVEMENT_FAILED") {
    const test=await query("SELECT payout_test_correlation_id FROM user_woovi_accounts WHERE user_id=$1",[req.params.userId]);
    if(test.rowCount && test.rows[0].payout_test_correlation_id===correlationID) {
      if(event==="OPENPIX:MOVEMENT_CONFIRMED") {
        await query("UPDATE user_woovi_accounts SET payout_permission_status='verified',payout_permission_verified_at=now(),payout_test_confirmed_at=now(),updated_at=now() WHERE user_id=$1",[req.params.userId]);
        await query("INSERT INTO woovi_authorization_audit(user_id,action,consent_version,destination_hint,details) VALUES($1,'pix_out_permission_verified',$2,$3,$4::jsonb)",[req.params.userId,"licenca-news-commission-15-v1",String(process.env.WOOVI_PLATFORM_PIX_KEY||"").slice(-4),JSON.stringify({correlationID})]);
      } else {
        await query("UPDATE user_woovi_accounts SET payout_permission_status='failed',updated_at=now() WHERE user_id=$1",[req.params.userId]);
      }
      return res.status(200).json({received:true,permissionTest:true});
    }
  }

  if(chargeEvent) {
    const charge=req.body.charge||{};
    if(String(charge.status||"").toUpperCase()!=="COMPLETED")return res.status(200).json({received:true,ignored:true});
    const paid=await transaction(async client=>{
      const r=await client.query(`SELECT * FROM license_orders WHERE woovi_charge_correlation_id=$1 AND publisher_user_id=$2 FOR UPDATE`,[correlationID,req.params.userId]);
      if(!r.rowCount)return null;
      const order=r.rows[0];
      if(Number(charge.value)!==Number(order.gross_amount_cents))throw new Error("Valor do webhook Woovi não confere com o pedido.");
      if(order.status==="paid")return order;
      if(order.status!=="accepted")throw new Error("Pedido não está aprovado para pagamento.");
      const fee=Math.round(Number(order.gross_amount_cents)*0.15);
      await client.query(`UPDATE license_orders SET status='paid',platform_fee_cents=$2,creator_net_cents=$3,paid_at=now(),woovi_paid_at=now(),updated_at=now() WHERE id=$1`,
        [order.id,fee,Number(order.gross_amount_cents)-fee]);
      await client.query(`INSERT INTO woovi_payouts(order_id,user_id,correlation_id,amount_cents,status)
        VALUES($1,$2,$3,$4,'queued') ON CONFLICT(order_id) DO NOTHING`,
        [order.id,req.params.userId,"ln-comissao-"+order.id,fee]);
      return {...order,platform_fee_cents:fee};
    });
    if(paid) {
      try {
        const fee=Number(paid.platform_fee_cents||Math.round(Number(paid.gross_amount_cents)*0.15));
        const payout=await createPlatformCommissionPayout({appId:account.appId,orderId:paid.id,userId:req.params.userId,amountCents:fee});
        await query("UPDATE woovi_payouts SET status='approved',provider_reference=$2,error_message=NULL,updated_at=now() WHERE order_id=$1",
          [paid.id,payout.providerReference]);
      } catch(error) {
        await query("UPDATE woovi_payouts SET status='needs_attention',error_message=$2,updated_at=now() WHERE order_id=$1",
          [paid.id,String(error.message||"Falha no Pix Out").slice(0,500)]);
        await query("UPDATE user_woovi_accounts SET payout_permission_status='needs_attention',updated_at=now() WHERE user_id=$1",[req.params.userId]);
      }
    }
  } else if(event==="OPENPIX:MOVEMENT_CONFIRMED" || event==="OPENPIX:MOVEMENT_FAILED") {
    const payment=req.body.payment||{};
    const payoutCorrelation=String(payment.correlationID||correlationID);
    const payout=await query("SELECT order_id FROM woovi_payouts WHERE correlation_id=$1 AND user_id=$2",[payoutCorrelation,req.params.userId]);
    if(payout.rowCount) {
      if(event==="OPENPIX:MOVEMENT_CONFIRMED") {
        await query("UPDATE woovi_payouts SET status='confirmed',provider_end_to_end_id=$2,confirmed_at=now(),updated_at=now(),error_message=NULL WHERE correlation_id=$1",
          [payoutCorrelation,req.body.transaction?.endToEndId||null]);
        await issueLicenseForPaidOrder(payout.rows[0].order_id);
      } else {
        await query("UPDATE woovi_payouts SET status='failed',error_message=$2,updated_at=now() WHERE correlation_id=$1",
          [payoutCorrelation,String(req.body.error?.message||"Woovi informou falha no Pix Out").slice(0,500)]);
      }
    }
  }
  res.status(200).json({received:true});
}));

export { router as wooviRouter, webhooks as wooviWebhookRouter };
