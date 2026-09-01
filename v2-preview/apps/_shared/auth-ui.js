(function(global){
  'use strict';
  const providerNames={apple:'Apple',google:'Google',discord:'Discord'};
  const els=()=>({
    status:[...document.querySelectorAll('[data-ptcg-auth-status]')],
    name:[...document.querySelectorAll('[data-ptcg-auth-name]')],
    provider:[...document.querySelectorAll('[data-ptcg-auth-provider-label]')],
    signedIn:[...document.querySelectorAll('[data-ptcg-auth-signed-in]')],
    signedOut:[...document.querySelectorAll('[data-ptcg-auth-signed-out]')],
    message:[...document.querySelectorAll('[data-ptcg-auth-message]')]
  });
  function setMessage(text,isError){for(const el of els().message){el.textContent=text||'';el.classList.toggle('is-error',!!isError)}}
  async function render(){
    if(!global.PTCGCloud)return;
    const user=await global.PTCGCloud.getUser();
    const e=els();
    const label=global.PTCGCloud.userLabel(user);
    const provider=global.PTCGCloud.providerLabel(user);
    for(const el of e.status){el.textContent=user?label:'Not signed in';el.dataset.signedIn=user?'true':'false'}
    for(const el of e.name)el.textContent=user?label:'Guest';
    for(const el of e.provider)el.textContent=user?(provider?`Signed in with ${provider}`:'Signed in'):'Not signed in';
    for(const el of e.signedIn)el.hidden=!user;
    for(const el of e.signedOut)el.hidden=!!user;
  }
  async function signIn(provider,button){
    setMessage('');
    if(button)button.disabled=true;
    try{await global.PTCGCloud.signInWithProvider(provider,new URL('./',location.href).href)}
    catch(error){setMessage(error?.message||`Could not sign in with ${providerNames[provider]||provider}.`,true);if(button)button.disabled=false}
  }
  async function signOut(button){
    setMessage('');
    if(button)button.disabled=true;
    try{await global.PTCGCloud.signOut();await render();setMessage('Signed out.')}catch(error){setMessage(error?.message||'Could not sign out.',true)}finally{if(button)button.disabled=false}
  }
  document.addEventListener('click',event=>{
    const providerButton=event.target.closest('[data-ptcg-auth-provider]');
    if(providerButton){event.preventDefault();signIn(providerButton.dataset.ptcgAuthProvider,providerButton);return}
    const out=event.target.closest('[data-ptcg-auth-signout]');
    if(out){event.preventDefault();signOut(out)}
  });
  async function init(){
    if(!global.PTCGCloud)return;
    await render();
    try{
      const result=await global.PTCGCloud.onAuthStateChange(()=>{render();window.dispatchEvent(new CustomEvent('ptcg:auth-change'))});
      global.__ptcgAuthSubscription=result?.data?.subscription||null;
    }catch(error){console.warn('Auth state listener unavailable',error)}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
  global.PTCGAuthUI={render};
})(window);
