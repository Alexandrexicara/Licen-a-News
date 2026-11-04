(()=> {
 const API=(window.LICENCA_API_URL||"").replace(/\/$/,"");
 const root=document.querySelector("#lnAssistant"); if(!root)return;
 const panel=root.querySelector(".ln-assistant-panel"),bubble=root.querySelector(".ln-assistant-bubble"),launch=root.querySelector(".ln-bot-launch"),messages=root.querySelector(".ln-chat-messages");
 const compose=root.querySelector(".ln-chat-compose"),note=root.querySelector(".ln-chat-note"),status=root.querySelector(".ln-chat-head small");
 const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
 let history=[],awake=false,busy=false,recognition=null,listening=false,idleTimer=null,currentAudio=null,manuallyClosed=false;
 const IDLE_MS=45000;
 if(compose)compose.hidden=true;
 if(note)note.textContent="Conversa por voz. Toque no robô para acordar; após 45 segundos sem interação, ele volta a dormir.";
 function add(text,who="bot",error=false){const el=document.createElement("div");el.className="ln-chat-msg "+who+(error?" error":"");el.textContent=text;messages.append(el);messages.scrollTop=messages.scrollHeight;return el}
 function setStatus(t){if(status)status.textContent=t}
 function clearIdle(){clearTimeout(idleTimer);idleTimer=setTimeout(sleep,IDLE_MS)}
 function stopRecognition(){if(recognition){try{recognition.onend=null;recognition.stop()}catch(e){}recognition=null}listening=false}
 function stopAudio(){if(currentAudio){try{currentAudio.pause();currentAudio.src=""}catch(e){}currentAudio=null}}
 async function speak(text){stopAudio();try{const r=await fetch(API+"/api/v1/assistant/speak",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text})});if(!r.ok)throw new Error("Voz indisponível");const url=URL.createObjectURL(await r.blob()),audio=new Audio(url);currentAudio=audio;audio.onended=()=>{URL.revokeObjectURL(url);if(currentAudio===audio)currentAudio=null;if(awake&&!busy){clearIdle();startListening()}};await audio.play()}catch(e){setStatus("Voz indisponível; tente novamente");if(awake&&!busy)startListening()}}
 function sleep(){clearTimeout(idleTimer);stopRecognition();stopAudio();awake=false;busy=false;root.classList.add("sleeping");panel.hidden=true;bubble.hidden=false;setStatus("Em repouso — toque para conversar")}
 function startListening(){if(!awake||busy||listening)return;if(!SR){setStatus("Reconhecimento de voz não suportado neste navegador");add("Seu navegador não oferece reconhecimento de voz. Abra o Licença News no Google Chrome atualizado e permita o uso do microfone.","bot",true);return}
  recognition=new SR();recognition.lang="pt-BR";recognition.continuous=false;recognition.interimResults=false;recognition.maxAlternatives=1;
  recognition.onstart=()=>{listening=true;setStatus("Estou ouvindo… fale naturalmente");clearIdle()};
  recognition.onresult=ev=>{const text=ev.results?.[0]?.[0]?.transcript?.trim();if(text)sendToAI(text)};
  recognition.onerror=ev=>{listening=false;if(ev.error==="not-allowed"||ev.error==="service-not-allowed"){setStatus("Permita o microfone nas configurações do navegador");add("Preciso da permissão do microfone para conversar. Autorize o acesso ao microfone no navegador e toque no robô novamente.","bot",true)}else if(ev.error!=="no-speech"&&awake){setStatus("Não consegui ouvir; tentando novamente")}};
  recognition.onend=()=>{listening=false;recognition=null;if(awake&&!busy&&!currentAudio){clearIdle();setTimeout(startListening,350)}};
  try{recognition.start()}catch(e){listening=false;setTimeout(()=>{if(awake&&!busy)startListening()},800)}
 }
 async function sendToAI(text){if(!awake||busy)return;busy=true;stopRecognition();clearIdle();add(text,"user");history.push({role:"user",content:text});const wait=add("Deixe-me pensar…");setStatus("Preparando resposta…");
  try{const r=await fetch(API+"/api/v1/assistant/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({messages:history.slice(-12)})});const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.error||"Não consegui responder agora.");wait.remove();history.push({role:"assistant",content:data.reply});add(data.reply);busy=false;setStatus("Respondendo…");await speak(data.reply)}
  catch(e){wait.remove();add(e.message,"bot",true);history.pop();busy=false;setStatus("Tente falar novamente");if(awake){clearIdle();setTimeout(startListening,500)}}
 }
 async function wake(){if(awake){clearIdle();return}awake=true;manuallyClosed=false;root.classList.remove("sleeping");root.classList.add("waking");setTimeout(()=>root.classList.remove("waking"),550);bubble.hidden=true;panel.hidden=false;clearIdle();
  if(!messages.children.length){const h=new Date().getHours(),g=h<12?"Bom dia":h<18?"Boa tarde":"Boa noite";const hello=g+"! Eu sou a assistente virtual do Licença News. Pode falar comigo. Como posso ajudar?";add(hello);setStatus("Preparando para conversar…");await speak(hello)}else{setStatus("Estou pronta para conversar");startListening()}
 }
 launch.addEventListener("click",wake);
 root.querySelector(".ln-chat-close").addEventListener("click",()=>{manuallyClosed=true;sleep()});
 document.addEventListener("visibilitychange",()=>{if(document.hidden&&awake)sleep()});
 bubble.hidden=false;
})();