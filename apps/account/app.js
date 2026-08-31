(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const out=$('message'),signedOut=$('signedOut'),signedIn=$('signedIn');
  function message(text,type=''){out.textContent=text||'';out.className=`account-message ${type}`.trim()}
  function setBusy(b){['signIn','signUp','signOut','syncNow','pushNow','pullNow'].forEach(id=>{const el=$(id);if(el)el.disabled=b})}
  async function renderUser(){
    const user=await window.PTCGCloud.getUser();
    signedOut.hidden=!!user;signedIn.hidden=!user;
    if(user)$('userEmail').textContent=user.email||'Signed in';
    return user;
  }
  async function action(fn,success){
    setBusy(true);message('Working…');
    try{const result=await fn();message(success(result),'good');await renderUser();return result}catch(err){message(err?.message||String(err),'error')}finally{setBusy(false)}
  }
  $('signIn').addEventListener('click',()=>action(()=>window.PTCGCloud.signIn($('email').value.trim(),$('password').value),()=> 'Signed in.'));
  $('signUp').addEventListener('click',()=>action(()=>window.PTCGCloud.signUp($('email').value.trim(),$('password').value),r=>r?.session?'Account created and signed in.':'Account created. Check your email to confirm it, then return here and sign in.'));
  $('signOut').addEventListener('click',()=>action(()=>window.PTCGCloud.signOut(),()=> 'Signed out.'));
  $('syncNow').addEventListener('click',()=>action(()=>window.PTCGCloud.sync(),r=>{const text=r.direction==='down'?'Restored newer cloud data to this device.':'Uploaded this device to the cloud.';$('syncStatus').textContent=new Date(r.updatedAt).toLocaleString();return text}));
  $('pushNow').addEventListener('click',()=>action(()=>window.PTCGCloud.push(),r=>{$('syncStatus').textContent=new Date(r.updatedAt).toLocaleString();return 'Uploaded this device to the cloud.'}));
  $('pullNow').addEventListener('click',()=>{
    if(!confirm('Restore the cloud snapshot onto this device? Existing local decks with different IDs are kept; matching local state may be replaced.'))return;
    action(()=>window.PTCGCloud.pull(),r=>{if(!r)return 'No cloud backup exists yet.';$('syncStatus').textContent=new Date(r.updated_at).toLocaleString();return 'Cloud data restored. Reload the app to see all restored state.'});
  });
  renderUser().catch(err=>message(err?.message||String(err),'error'));
})();
