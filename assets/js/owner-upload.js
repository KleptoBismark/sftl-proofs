/* Owner-only album creation. Photo bytes are held locally until Upload is chosen. */
(function (root) {
  'use strict';
  const MAX_FINAL = 50000000;
  const formatBytes = n => n < 100000 ? Math.ceil(n / 1000) + ' KB' : (n / 1000000).toFixed(1) + ' MB';
  async function hash(blob) {
    return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())), x => x.toString(16).padStart(2,'0')).join('');
  }
  async function derivative(bitmap, maximum, quality) {
    const scale = Math.min(1, maximum / Math.max(bitmap.width,bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width*scale)); canvas.height = Math.max(1, Math.round(bitmap.height*scale));
    canvas.getContext('2d', {alpha:false}).drawImage(bitmap,0,0,canvas.width,canvas.height);
    const blob = await new Promise(resolve => canvas.toBlob(resolve,'image/jpeg',quality));
    canvas.width=canvas.height=1;
    if (!blob) throw new Error('This browser could not prepare a JPEG preview.');
    return blob;
  }
  async function prepare(file, kind, previous) {
    if (!/\.jpe?g$/i.test(file.name) || file.type && file.type !== 'image/jpeg') throw new Error('Choose JPEG photographs. RAW files cannot be uploaded.');
    if (file.size > (kind === 'delivery' ? MAX_FINAL : 150000000)) throw new Error(file.name + ' is too large. Choose a smaller JPEG export.');
    const signature = new Uint8Array(await file.slice(0,3).arrayBuffer());
    if (signature[0] !== 255 || signature[1] !== 216 || signature[2] !== 255) throw new Error(file.name + ' is not a JPEG.');
    const bitmap = await createImageBitmap(file, {imageOrientation:'from-image'});
    try {
      if (bitmap.width * bitmap.height > 120000000) throw new Error('Export ' + file.name + ' at 120 megapixels or less.');
      const preview = await derivative(bitmap,2048,0.86), thumbnail = await derivative(bitmap,480,0.8);
      const blobs = {preview, thumbnail}; if (kind === 'delivery') blobs.final=file;
      const assets={};
      for (const [role,blob] of Object.entries(blobs)) assets[role]={size:blob.size,sha256:await hash(blob)};
      const meta={id:previous?.id || crypto.randomUUID(),filename:file.name,width:bitmap.width,height:bitmap.height,image_id:previous?.image_id || null,assets};
      if (previous) {
        if (meta.width !== previous.width || meta.height !== previous.height || Object.keys(assets).some(role => assets[role].sha256 !== previous.assets[role]?.sha256 || assets[role].size !== previous.assets[role]?.size)) throw new Error(file.name + ' differs from the saved batch. Choose the same original file in the same browser.');
      }
      return {meta,blobs,url:URL.createObjectURL(thumbnail)};
    } finally {bitmap.close();}
  }
  function install(options) {
    const {host,token,key,supa,rpc,refresh,getAlbums,escape:esc}=options;
    const section=document.createElement('section'); section.className='upload-toolbar';
    section.innerHTML='<button class="chip go" id="new-album">New album</button><div id="upload-pending" aria-live="polite"></div>';
    host.before(section);
    const dialog=document.createElement('dialog');dialog.className='upload-dialog';dialog.setAttribute('aria-labelledby','upload-title');
    dialog.innerHTML=`<div class="upload-heading"><h2 id="upload-title">New album</h2><button type="button" class="chip" data-close>Close</button></div>
      <p class="gsub" id="upload-intro">Choose photographs, review them, then publish your album.</p>
      <form id="album-upload-form"><fieldset id="upload-details"><label>Album title<input name="title" maxlength="160" required></label>
      <label>Client name<input name="client_name" maxlength="160"></label><div class="upload-kind"><label for="upload-kind">Album type</label><select id="upload-kind" name="kind"><option value="proofing">Client selection</option><option value="delivery">Finished photos</option></select></div></fieldset>
      <p id="upload-guidance"></p><label id="export-confirmation" hidden><input name="edited_exports" type="checkbox"> These are edited JPEG exports approved for client delivery, not original captures.</label>
      <label class="upload-drop" id="upload-drop">Choose or drop JPEG photographs<input id="upload-files" type="file" accept="image/jpeg,.jpg,.jpeg" multiple></label>
      <p class="gsub">Up to 500 photographs. Finished exports: up to 50 MB each. Keep this page open while uploading.</p>
      <div id="upload-review"></div><p id="upload-total"></p>
      <p id="upload-message" role="status" aria-live="polite"></p><progress aria-label="Upload progress" id="upload-progress" hidden max="100" value="0"></progress>
      <div class="linkrow"><button class="chip go" type="submit" id="upload-start">Upload and verify</button><button class="chip go" type="button" id="upload-publish" hidden>Publish album</button><button class="chip" type="button" id="upload-rebase" hidden>Review current album</button></div>
      <div id="upload-success" hidden></div></form>`;
    document.body.append(dialog);
    const $=s=>dialog.querySelector(s), form=$('form'), details=$('#upload-details'), message=$('#upload-message'), picker=$('#upload-files'), review=$('#upload-review');
    let local=[], batch=null, target=null, proofs=[], busy=false, attempt=null, rebaseCandidate=null;
    function say(text){message.textContent=text;}
    function clearLocal(){for(const p of local)URL.revokeObjectURL(p.url);local=[];}
    function lock(value){busy=value;$('[data-close]').disabled=value;form.querySelectorAll('button,input,select').forEach(el=>el.disabled=value);details.disabled=value||!!batch||!!target||!!attempt;picker.disabled=value||!!attempt&&!batch;review.querySelectorAll('select').forEach(el=>el.disabled=value||!!batch||!!attempt);$('#upload-publish').disabled=value;$('#upload-start').disabled=value;$('#upload-progress').hidden=!value;}
    function guidance(){const delivery=form.elements.kind.value==='delivery';$('#export-confirmation').hidden=!delivery;$('#upload-guidance').textContent=delivery?'Finished photos are delivered at the exact quality and size you choose.':'Only resized previews and thumbnails will be uploaded. Your original photographs stay on this device. Clients choose edits with 4 or 5 stars.';}
    function renderReview(){
      const files=batch?.manifest.files || local.map(p=>p.meta);
      review.innerHTML=files.map(f=>{
        const p=local.find(p=>p.meta.id===f.id);
        return '<div class="upload-photo">'+(p?'<img src="'+p.url+'" alt="">':'')+'<div><b>'+esc(f.filename)+'</b><p class="gsub">'+formatBytes(Object.values(f.assets).reduce((s,a)=>s+a.size,0))+'</p>'+ (target?'<label for="map-'+f.id+'">Corresponding selection photo</label><select id="map-'+f.id+'" data-map="'+f.id+'"'+(batch?' disabled':'')+'><option value="">Standalone finished photo</option>'+proofs.map(i=>'<option value="'+esc(i.id)+'"'+(f.image_id===i.id?' selected':'')+'>'+esc(i.filename)+(i.rating>=4?' · ★'+i.rating:'')+'</option>').join('')+'</select>':'')+'</div></div>';
      }).join('');
      const bytes=files.reduce((s,f)=>s+Object.values(f.assets).reduce((n,a)=>n+a.size,0),0);
      $('#upload-total').textContent=files.length?files.length+(files.length===1?' photograph · ':' photographs · ')+formatBytes(bytes)+' to upload':'';
      $('#upload-publish').textContent=target?'Publish finished photos':'Publish album';
    }
    async function api(action,extra={}) {
      const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),90000);
      try {
        const response=await fetch(supa+'/functions/v1/proof-owner-upload',{method:'POST',signal:controller.signal,headers:{'Content-Type':'application/json',apikey:key},body:JSON.stringify({action,token,...extra})});
        const data=await response.json();if(!response.ok){const error=new Error(data.error||'Request failed.');error.confirmed=response.status===400||response.status===403;throw error;}return data;
      } catch(error){if(error.name==='AbortError'||error instanceof TypeError)throw new Error('Connection interrupted. Retry this batch to check its saved status.');throw error;}
      finally{clearTimeout(timeout);}
    }
    function clearAttempt(){try{sessionStorage.removeItem('sftl-upload-attempt');}catch{}}
    async function loadPending(){
      const area=section.querySelector('#upload-pending');
      try{const list=await api('list');area.innerHTML=list.filter(b=>b.status==='pending').map(b=>'<button class="chip" data-resume="'+esc(b.id)+'">Resume '+esc(b.title)+' ('+b.count+')</button>').join('');}
      catch{area.textContent='Upload service unavailable. You can still manage existing albums.';}
    }
    function reset(){clearLocal();batch=null;attempt=null;rebaseCandidate=null;target=null;proofs=[];form.reset();details.disabled=false;$('#upload-success').hidden=true;$('#upload-publish').hidden=true;$('#upload-rebase').hidden=true;$('#upload-start').hidden=false;picker.value='';say('');renderReview();guidance();lock(false);}
    async function open(album,saved){
      reset();target=album||null;
      if(target){form.elements.title.value=target.title;form.elements.client_name.value=target.client_name||'';form.elements.kind.value='delivery';details.disabled=true;}
      $('#upload-title').textContent=target?'Add finished photos':'New album';$('#upload-intro').textContent=target?'Add edited exports to this album. Its existing client link stays the same.':'Choose photographs, review them, then publish your album.';dialog.showModal();guidance();
      if(target){lock(true);try{proofs=(await rpc('proof_get_gallery',{p_token:target.admin_token})).images||[];}catch{lock(false);say('Could not load selection photos. Close and try again.');$('#upload-start').disabled=true;return;}lock(false);}
      if(saved){batch=saved;const m=saved.manifest;form.elements.title.value=m.title;form.elements.client_name.value=m.client_name;form.elements.kind.value=m.kind;form.elements.edited_exports.checked=m.edited_exports;details.disabled=true;guidance();renderReview();say('Checking the saved batch is safe. Reselect the same photographs only if an upload is missing.');if(batch.status==='published')await published();}
    }
    async function choose(files){
      if(busy)return;
      if(attempt&&!batch){say('Retry the interrupted request before changing these files.');return;}
      if(!files.length){say('Choose at least one photograph.');return;}
      if(files.length>500){say('Choose up to 500 photographs.');return;}
      lock(true);clearLocal();$('#upload-publish').hidden=true;
      try{
        const seen=new Set();
        for(let i=0;i<files.length;i++){
          const file=files[i],name=file.name.toLowerCase();if(seen.has(name))throw new Error('Duplicate filename: '+file.name);seen.add(name);
          say('Preparing '+(i+1)+' of '+files.length+'…');
          const previous=batch?.manifest.files.find(p=>p.filename===file.name);
          if(batch&&!previous)throw new Error(file.name+' is not in this saved batch.');
          const p=await prepare(file,form.elements.kind.value,previous);
          if(!batch&&target)p.meta.image_id=proofs.find(i=>i.filename===file.name)?.id||null;
          local.push(p);
        }
        if(batch&&local.length!==batch.manifest.files.length)throw new Error('Choose all '+batch.manifest.files.length+' photographs from the saved batch.');
        if(local.reduce((s,p)=>s+Object.values(p.meta.assets).reduce((n,a)=>n+a.size,0),0)>900000000)throw new Error('This batch exceeds the storage safety limit. Choose fewer or smaller exports.');
        attempt=null;renderReview();say('Review these photographs'+(target?' and their selection-photo matches':'')+', then upload.');
      }catch(error){clearLocal();renderReview();say(error.message);}
      finally{lock(false);}
    }
    function put(url,blob,onProgress){return new Promise((resolve,reject)=>{
      const xhr=new XMLHttpRequest();xhr.open('PUT',url);xhr.timeout=180000;xhr.setRequestHeader('Content-Type','image/jpeg');xhr.setRequestHeader('x-upsert','false');
      xhr.upload.onprogress=e=>{if(e.lengthComputable)onProgress(e.loaded/e.total);};
      xhr.onload=()=>xhr.status>=200&&xhr.status<300?resolve():reject(new Error('Upload response was not confirmed. Retry to verify this same file.'));
      xhr.onerror=xhr.ontimeout=()=>reject(new Error('Upload interrupted. Retry to check which files arrived.'));xhr.send(blob);
    });}
    async function published(){
      await refresh();$('#upload-start').hidden=true;$('#upload-publish').hidden=true;$('#upload-rebase').hidden=true;$('#upload-success').hidden=false;
      $('#upload-success').innerHTML='<p>Published. Your album is ready.</p><button type="button" class="chip go" id="upload-invitation">Copy client invitation</button>';
      $('#upload-invitation').onclick=()=>{
        const album=getAlbums().find(g=>g.id===batch.gallery_id);if(!album){say('Refresh the dashboard to copy the invitation.');return;}
        const portal=location.origin+location.pathname.replace(/admin\/?(index\.html)?$/,'');
        const text='Your album: '+album.title+'\n\n'+portal+'?t='+album.share_token+'\n\nYou can also visit '+portal+' and enter your gallery code: '+(album.access_code||'').match(/.{1,4}/g)?.join('-');
        navigator.clipboard.writeText(text).then(()=>say('Client invitation copied.')).catch(()=>window.prompt('Copy client invitation:',text));
      };
      say(target?'Finished photos published. The existing client link still works.':'Album published. Copy the invitation when you are ready to share it.');await loadPending();
    }
    form.onsubmit=async event=>{
      event.preventDefault();if(busy)return;
      if(!batch&&!local.length){say('Choose photographs first.');return;}
      if(form.elements.kind.value==='delivery'&&!form.elements.edited_exports.checked){say('Confirm that these are edited exports approved for delivery.');return;}
      lock(true);$('#upload-rebase').hidden=true;
      try{
        if(!batch){
          if(!attempt)attempt={id:crypto.randomUUID(),gallery_id:target?.id||null,expected_version:target?.workflow_version??null,title:form.elements.title.value,client_name:form.elements.client_name.value,kind:form.elements.kind.value,edited_exports:form.elements.edited_exports.checked,files:local.map(p=>p.meta)};
          // Save the ID and metadata before the first request, so a lost response
          // or page reload can recover this exact batch without creating another.
          try{sessionStorage.setItem('sftl-upload-attempt',JSON.stringify(attempt));}catch{const error=new Error('Enable site storage in this browser so interrupted uploads can be recovered.');error.confirmed=true;throw error;}
          batch=await api('begin',{manifest:attempt});clearAttempt();
        }else batch=await api('status',{id:batch.manifest.id});
        if(batch.status==='published'){await published();return;}
        const assets=batch.manifest.files.flatMap(f=>Object.entries(f.assets).map(([role,asset])=>({file:f,role,asset})));
        for(let i=0;i<assets.length;i++){
          const {file,role,asset}=assets[i];say('Checking '+file.filename+' · '+role+' ('+(i+1)+'/'+assets.length+')');$('#upload-progress').value=100*i/assets.length;
          let result=await api('verify',{id:batch.manifest.id,path:asset.path});
          if(result.missing){
            const blob=local.find(p=>p.meta.id===file.id)?.blobs[role];
            if(!blob)throw new Error('Reselect the same '+batch.manifest.files.length+' photographs to finish missing uploads.');
            const signed=await api('sign',{id:batch.manifest.id,path:asset.path});say('Uploading '+file.filename+' · '+role);
            await put(signed.signedUrl,blob,p=>$('#upload-progress').value=100*(i+p)/assets.length);
            result=await api('verify',{id:batch.manifest.id,path:asset.path});if(!result.verified)throw new Error('This upload is not verified yet. Retry the batch.');
          }
        }
        batch=await api('status',{id:batch.manifest.id});renderReview();$('#upload-publish').hidden=false;
        say('All '+batch.manifest.files.length+' photographs are uploaded and verified. Review the list, then publish.');
      }catch(error){if(!batch&&error.confirmed){attempt=null;clearAttempt();}say(error.message);}
      finally{lock(false);loadPending();}
    };
    $('#upload-publish').onclick=async()=>{
      if(busy||!batch)return;
      lock(true);say('Publishing…');
      try{batch=await api('publish',{id:batch.manifest.id});await published();}
      catch(error){say(error.message+' Retry to check the saved publication status.');if(/album changed/.test(error.message))$('#upload-rebase').hidden=false;}
      finally{lock(false);}
    };
    $('#upload-rebase').onclick=async()=>{
      if(busy)return;lock(true);
      try{
        if(!rebaseCandidate){
          await refresh();const current=getAlbums().find(g=>g.id===batch.manifest.gallery_id);
          if(!current)throw new Error('Album not found.');
          rebaseCandidate=current;
          say('“'+current.title+'” is now '+current.stage+' with '+current.edit_count+' selected photos and '+current.finals_count+' finished photos. Review these changes. Using this album preserves its selections and links.');
          $('#upload-rebase').textContent='Use current album';
          return;
        }
        batch=await api('rebase',{id:batch.manifest.id,expected_version:rebaseCandidate.workflow_version});target=rebaseCandidate;rebaseCandidate=null;
        $('#upload-rebase').hidden=true;$('#upload-rebase').textContent='Review current album';say('Current album reviewed. Select Publish finished photos to continue.');
      }catch(error){rebaseCandidate=null;$('#upload-rebase').textContent='Review current album';say(error.message);}finally{lock(false);}
    };
    review.onchange=e=>{if(e.target.dataset.map){local.find(p=>p.meta.id===e.target.dataset.map).meta.image_id=e.target.value||null;attempt=null;}};
    picker.onchange=()=>choose(Array.from(picker.files));
    const drop=$('#upload-drop');drop.ondragover=e=>{e.preventDefault();};drop.ondrop=e=>{e.preventDefault();choose(Array.from(e.dataTransfer.files));};
    form.elements.kind.onchange=()=>{clearLocal();attempt=null;picker.value='';renderReview();guidance();};
    $('[data-close]').onclick=()=>{if(busy||attempt&&!batch){say('Retry the interrupted request before closing this upload.');return;}dialog.close();};
    dialog.addEventListener('cancel',e=>{if(busy||attempt&&!batch)e.preventDefault();});
    window.addEventListener('beforeunload',e=>{if(busy){e.preventDefault();e.returnValue='';}});
    section.querySelector('#new-album').onclick=()=>open();
    section.onclick=async e=>{const b=e.target.closest('[data-resume]');if(!b)return;b.disabled=true;try{const saved=await api('status',{id:b.dataset.resume});await open(getAlbums().find(g=>g.id===saved.manifest.gallery_id),saved);}catch(error){section.querySelector('#upload-pending').textContent=error.message;}finally{b.disabled=false;}};
    host.addEventListener('click',e=>{const b=e.target.closest('[data-add-finals]');if(b)open(getAlbums()[+b.dataset.i]);});
    // Recover an uncertain initial request after reload, without silently retrying writes.
    let saved=null;try{saved=sessionStorage.getItem('sftl-upload-attempt');}catch{}
    if(saved){try{const m=JSON.parse(saved);const recover=document.createElement('button');recover.className='chip';recover.textContent='Recover interrupted upload';section.append(recover);recover.onclick=async()=>{try{const b=await api('begin',{manifest:m});clearAttempt();recover.remove();await open(getAlbums().find(g=>g.id===m.gallery_id),b);}catch(error){section.querySelector('#upload-pending').textContent=error.message;}};}catch{clearAttempt();}}
    loadPending();
    return {loadPending};
  }
  root.SFTLOwnerUpload={install,prepare};
})(window);
