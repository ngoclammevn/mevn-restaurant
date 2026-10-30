(() => {
  'use strict';
  const baseRender=render, baseFeedback=feedbackRender;
  let scenario='normal', signedIn=true, returnAfterSignIn='today', selfPaid=false;
  const pages=new Set(['today','menu','history','restaurants','taste','post','profile','manage','dashboard','my-menus','signin','changelog']);
  const privatePages=new Set(['profile','history','taste','signin']);
  const scenarios=new Set(['normal','loading','error','empty','guest','closed','soldout','ai-fallback']);
  const css=document.createElement('style');
  css.textContent=`:root{--ui-primary:#1f6e45;--ui-ink:#203529;--ui-muted:#566657;--ui-line:#cbd7c8;--ui-soft:#e7f1e5;--ui-bg:#f7f8f4}body{font-family:'Be Vietnam Pro',system-ui,sans-serif}h1{font-size:30px;line-height:1.2}h2{font-size:21px;line-height:1.35}h3{font-size:17px;line-height:1.4}.card{border-radius:16px}.nav{align-items:center;flex-wrap:wrap}.nav button{font-size:14px;white-space:nowrap}.nav .ui-account{width:44px;padding:8px;border-radius:50%;font-weight:700;background:var(--ui-soft);color:var(--ui-primary)}header{padding:14px 24px}.ui-muted{color:var(--ui-muted);font-size:14px}.ui-notice{padding:14px 16px;border:1px solid #b5c9b2;border-radius:12px;background:var(--ui-soft);margin:18px 0;color:var(--ui-ink);font-size:14px}.ui-error{border-color:#bb654f;background:#fff1eb;color:#80351f}.ui-blank{padding:36px 24px;text-align:center}.ui-blank h2{margin:12px 0}.ui-blank button{margin:12px 4px 0}.ui-links{display:flex;flex-wrap:wrap;gap:8px;margin:20px 0}.ui-signin{max-width:460px;margin:40px auto;padding:32px}.ui-skeleton{background:#e6ebe3;border-radius:10px;min-height:20px;margin:14px 0}.ui-skeleton.big{height:130px}.ui-success{border:1px solid #9fbd99;background:var(--ui-soft);border-radius:12px;padding:16px}.ui-two{display:grid;grid-template-columns:1fr 1fr;gap:16px}.ui-qr{border:1px dashed #829e80;border-radius:12px;min-height:176px;display:grid;place-items:center;background:#f3f6f0;text-align:center;padding:20px}.ui-qr svg{width:64px;height:64px}.ui-pay-row{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:14px 0;border-bottom:1px solid var(--ui-line)}.ui-status-line{min-height:24px;font-size:14px;color:var(--ui-primary)}.ui-label{display:block;font-size:14px;font-weight:650;margin-bottom:8px}.taste-surface .tags{display:flex;gap:8px;flex-wrap:wrap;margin:18px 0}.taste-surface .tag{background:var(--ui-soft);padding:8px 12px;border-radius:20px;font-size:14px}.taste-surface .bar b{display:block;background:var(--ui-primary);height:100%}.taste-surface .rule{border-top:1px solid var(--ui-line);padding-top:20px;margin-top:20px}.taste-surface .tabs button{flex:1;font-size:14px}.taste-surface button[aria-pressed=true]{background:var(--ui-primary);color:white;border-color:var(--ui-primary)}button:disabled{opacity:.5;cursor:not-allowed}input[type=checkbox],input[type=radio]{width:20px;min-height:20px;accent-color:var(--ui-primary)}.panel{margin:0;left:auto;top:auto}.notice{font-size:12px}.ui-mark{width:24px;height:24px}.brand{display:flex;align-items:center;gap:8px}.bottom button{min-height:48px}.card:has(.calendar){padding:16px}.calendar button span{font-size:12px}.calendar .weekday{font-size:13px}@media(max-width:800px){header{padding:12px 16px}.nav{gap:5px}.nav button{padding:9px;font-size:13px}}@media(max-width:640px){h1{font-size:27px}.ui-two{grid-template-columns:1fr}.ui-signin{margin:20px 0;padding:24px}.ui-blank{padding:28px 18px}.nav button:not(.green):not(.ui-account){display:none}.nav .ui-account{display:inline-flex}.bottom button{font-size:12px}.panel{left:0;right:0}.card:has(.calendar){padding:10px}.calendar{gap:2px}.calendar button span{display:none}.ui-pay-row{flex-wrap:wrap}.ui-pay-row button{margin-left:auto}.ui-links>*{flex:1}.ui-qr{min-height:140px}}`;
  document.head.append(css);
  css.textContent+=`.extra-card{border-radius:16px}.extra-eyebrow{font-size:13px}.taste-surface .summary{margin:24px 0;background:var(--ui-soft)}.taste-surface .summary strong{font-size:21px}.taste-surface .grid{margin-top:20px}.taste-surface a{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:44px;padding:10px 16px;border-radius:12px;border:1px solid #c0cbbf;color:var(--ui-ink);text-decoration:none}.taste-surface a.primary{background:var(--ui-primary);color:white;border-color:var(--ui-primary)}.taste-surface details summary{min-height:44px;padding:10px 0;cursor:pointer}.taste-surface .bar{height:9px;overflow:hidden;border-radius:10px;background:#edf1e8;margin:10px 0 24px}.taste-surface .row{flex-wrap:wrap}.taste-surface .tabs{margin:18px 0 24px}.ui-account svg{width:20px;height:20px}a:focus-visible,summary:focus-visible,select:focus-visible{outline:3px solid var(--ui-primary);outline-offset:3px}`;
  const accountIcon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="8" r="3"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/></svg>';
  document.querySelector('.brand').innerHTML='<svg class="ui-mark" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M3 11h18a9 9 0 0 1-18 0Z"/><path d="M8 4v3m4-4v4m4-3v3M7 21h10"/></svg>Cơm Trưa<span style="color:#1f6e45">.</span>';
  const bind=(root,key,fn)=>root.querySelectorAll('[data-'+key+']').forEach(b=>b.addEventListener('click',e=>{e.preventDefault();fn(b)}));
  const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  window.navRender=()=>{
    const desktop=[['today','Hôm nay'],['history','Lịch cơm'],['manage','Quản lý']];
    const mobile=[...desktop,['profile','Cá nhân']];
    const active=id=>id===current||(id==='manage'&&['my-menus','dashboard'].includes(current))||(id==='profile'&&current==='taste');
    const iconPaths={today:'<path d="m3 10 9-7 9 7v10H3Z"/><path d="M9 20v-7h6v7"/>',history:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 11h18m-12 4h2m4 0h2"/>',manage:'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 9v12m4-8h4m-4 4h4"/>',profile:'<circle cx="12" cy="8" r="3"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/>'};
    const link=([id,label],icons=false)=>'<a href="#'+id+'" data-route="'+id+'" class="ui-nav-link '+(active(id)?'active':'')+'" '+(active(id)?'aria-current="page"':'')+'>'+(icons?'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">'+iconPaths[id]+'</svg>':'')+'<span>'+label+'</span></a>';
    document.querySelector('.nav').innerHTML='<div class="ui-nav-pages">'+desktop.map(item=>link(item)).join('')+'</div><div class="ui-nav-tools"><button class="ui-post" data-route="post"><span aria-hidden="true">+</span><span class="ui-post-label"> Đăng menu</span></button>'+(signedIn?'<button class="ui-account" data-route="profile" aria-label="Mở trang cá nhân">MN</button>':'<button class="ui-account" data-route="signin" aria-label="Đăng nhập">'+accountIcon+'</button>')+'</div>';
    document.querySelector('.bottom').innerHTML=mobile.map(item=>link(item,true)).join('');document.querySelector('.ui-post').setAttribute('aria-label','Đăng menu');document.querySelector('.ui-post').title='Đăng menu';
    const updates=document.createElement('button');updates.className='ui-updates';updates.setAttribute('aria-label','Xem changelog và cập nhật');updates.title='Cập nhật';updates.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M5 5h14v14H5zM8 9h8M8 13h8M8 17h5"/></svg>'+(!window.previewChangelogRead?.()?'<span class="ui-unread" aria-hidden="true"></span>':'');updates.onclick=()=>window.openChangelogPreview?.();document.querySelector('.nav .ui-account').before(updates);
    for(const root of [document.querySelector('.nav'),document.querySelector('.bottom')])bind(root,'route',b=>go(b.dataset.route));
  };
  const signal=()=>{history.replaceState(null,'','#'+current);window.parent.postMessage({type:'preview-page',page:current,scenario},location.origin)};
  const navigate=go;
  const baseFood=food.map(x=>[...x]), perRestaurantChoices=new Map();
  const restaurantFood={ 'Cơm nhà An':baseFood, 'Bếp cô Tư':[['Cá kho tộ','Cá kho thấm vị, dùng cùng cơm và rau.',35000],['Đậu hũ sốt nấm','Đậu mềm, sốt nấm vừa vị.',30000],['Rau luộc & trứng','Rau theo ngày, trứng và cơm trắng.',30000]] };
  window.go=(page,restaurant)=>{
    if(!pages.has(page)){current=page;navRender();main.innerHTML=pageHeader('Không tìm thấy','Màn hình này chưa có','Trở về trang Hôm nay để chọn bữa trưa.')+'<button data-home>Về Hôm nay</button>';bind(main,'home',()=>go('today'));return;}
    for(const d of document.querySelectorAll('dialog[open]'))d.close();
    if(restaurant&&restaurant!==selectedRestaurant){perRestaurantChoices.set(selectedRestaurant,new Set(picked));picked=perRestaurantChoices.get(restaurant)||new Set();food.splice(0,food.length,...(restaurantFood[restaurant]||baseFood).map(x=>[...x]));}
    if(['profile','manage','dashboard','my-menus','post','history','taste'].includes(page)&&!signedIn){returnAfterSignIn=page;page='signin';}
    navigate(page,restaurant);signal();
  };
  function signin(){
    main.innerHTML='<section class="card ui-signin"><span class="eyebrow">Cơm Trưa</span><h1>Đăng nhập</h1><p>Đặt món và xem đơn của bạn.</p><button class="green" data-signin style="width:100%">Tiếp tục với Google</button><p class="ui-muted" style="margin-top:16px">Đăng nhập mẫu, không dùng tài khoản thật.</p><button data-guest style="width:100%">Xem menu được chia sẻ</button><p class="tiny" style="margin-top:16px">Bản xem trước không đăng nhập tài khoản thật.</p></section>';
    bind(main,'signin',()=>{signedIn=true;scenario='normal';go(returnAfterSignIn)});bind(main,'guest',()=>{signedIn=false;go('menu')});
  }
  function stateScreen(){
    if(['normal','guest','closed','soldout','ai-fallback'].includes(scenario))return false;
    const name={today:'menu hôm nay',menu:'menu',history:'lịch cơm',taste:'khẩu vị',manage:'menu bạn đăng',dashboard:'tổng hợp đơn',profile:'hồ sơ',restaurants:'quán ăn'}[current]||'dữ liệu';
    if(scenario==='loading')main.innerHTML=pageHeader('Đang tải','Đang tải '+name,'')+'<section class="card"><p role="status">Đang tải '+name+'…</p><div aria-hidden="true"><div class="ui-skeleton"></div><div class="ui-skeleton big"></div><div class="ui-skeleton"></div></div><button data-retry>Quay lại dữ liệu mẫu</button></section>';
    if(scenario==='error')main.innerHTML=pageHeader('Kết nối','Chưa tải được '+name,'Các lựa chọn đang có trong mẫu được giữ lại.')+'<section class="card ui-blank"><p class="ui-error ui-notice" role="alert">Kết nối đang gián đoạn. Thử lại để tiếp tục.</p><button class="green" data-retry>Thử lại</button><button data-home>Về Hôm nay</button></section>';
    if(scenario==='empty'){
      if(['profile','post'].includes(current))return false;
      const title=current==='taste'?'Chưa đủ phản hồi để hiểu khẩu vị':current==='history'?'Chưa có bữa ăn':current==='restaurants'?'Chưa có quán ăn':'Chưa có '+name;
      main.innerHTML=pageHeader('',title,'')+'<section class="card ui-blank"><h2>'+title+'</h2><p>'+(current==='taste'?'Đánh giá vài bữa để xem món bạn thích.':'')+'</p><button class="green" data-next>'+(current==='taste'?'Đánh giá bữa gần đây':current==='history'?'Xem menu hôm nay':'Đăng menu đầu tiên')+'</button><button data-retry>Xem dữ liệu mẫu</button></section>';
      bind(main,'next',()=>{scenario='normal';go(current==='taste'?'history':current==='history'?'today':'post')});
    }
    bind(main,'retry',()=>{scenario='normal';render();signal()});bind(main,'home',()=>{scenario='normal';go('today')});return true;
  }
  const payment=document.createElement('dialog');payment.className='modal';payment.id='preview-payment';payment.setAttribute('aria-labelledby','payment-title');document.body.append(payment);
  function pay(order=null){
    const orderItems=order?.items?.join(' · ')||'Gà nướng mật ong', orderRestaurant=order?.shop||'Cơm nhà An', amount=order?.amount??40000;
    const profile=window.previewProfile?.()||{bank:'VCB',account:'0000000123',holder:'MINH NGOC'};
    payment.innerHTML='<header><div><span class="eyebrow">Đơn của bạn · 05/10/2026</span><h2 id="payment-title">Chuyển khoản cho Minh</h2><p class="tiny">'+escape(orderItems)+' · '+escape(orderRestaurant)+'</p></div><button class="close" data-close aria-label="Đóng thông tin chuyển khoản">×</button></header><div class="ui-two"><section class="ui-qr"><div><svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><path d="M5 24V5h19M40 5h19v19M59 40v19H40M24 59H5V40"/></svg><strong style="display:block">Vị trí mã QR</strong><p class="tiny">Mẫu minh họa, không dùng để quét hay chuyển tiền.</p></div></section><section><span class="ui-muted">Số tiền của đơn</span><h1 style="margin:8px 0">'+vn(amount)+'</h1><div class="ui-pay-row"><div><span class="ui-muted">Ngân hàng</span><p>'+escape(profile.bank||'Chưa cấu hình')+'</p></div></div><div class="ui-pay-row"><div><span class="ui-muted">Số tài khoản mẫu</span><p>'+escape(profile.account||'Chưa cấu hình')+'</p></div><button data-copy>Sao chép</button></div><div class="ui-pay-row"><div><span class="ui-muted">Chủ tài khoản</span><p>'+escape(profile.holder||'Chưa cấu hình')+'</p></div></div><div class="ui-pay-row"><div><span class="ui-muted">Nội dung chuyển khoản</span><p>MINH NGOC COM 05/10</p></div></div></section></div><p class="ui-notice">Bạn tự xác nhận sau khi chuyển tiền. Người thu tiền chỉ xem trạng thái, không đánh dấu hộ.</p><button class="green" data-paid style="width:100%">Tôi đã chuyển tiền</button><p class="ui-status-line" role="status"></p>';
    bind(payment,'close',()=>payment.close());bind(payment,'copy',()=>{payment.querySelector('[role=status]').textContent='Đã mô phỏng sao chép số tài khoản mẫu.'});bind(payment,'paid',()=>{selfPaid=true;payment.close();render();notify('Đã tự xác nhận thanh toán trong bản mẫu')});payment.showModal();
  }
  window.render=()=>{
    navRender();
    if(current==='signin'){signin();document.querySelector('#online').hidden=true;signal();return;}
    if(!stateScreen()){
      if(current==='changelog')window.renderChangelogPreview(main);
      else if(current==='post'&&window.renderPostPreview)window.renderPostPreview(main);
      else if(window.renderManageWorkspace?.(current,main)){}
      else if(!window.renderPreviewExtra?.(current,main))baseRender();
      if(current==='taste')window.bindTastePreview?.(main);
      if(current==='profile'){const b=document.createElement('button');b.textContent='Các cập nhật của app';b.onclick=()=>go('changelog');main.append(b)}
      if(current==='history'){
        const payBtn=Array.from(main.querySelectorAll('button')).find(b=>b.textContent==='Tôi đã trả');
        if(payBtn){const open=document.createElement('button');open.textContent='Thông tin chuyển khoản';open.onclick=()=>pay();payBtn.before(open);payBtn.onclick=()=>{selfPaid=true;render();notify('Đã tự đánh dấu trong mẫu')}}
        if(selfPaid){if(payBtn){payBtn.textContent='Đã trả';payBtn.disabled=true}if(day===5){const badge=main.querySelector('.detail .badge');if(badge)badge.textContent='Đã thanh toán'}}
      }
      if(current==='today'&&demoOrder){const c=main.querySelector('.personal');if(c&&demoOrder.recipient.startsWith('Cho tôi')){const b=document.createElement('button');b.textContent=selfPaid?'Đã thanh toán':'Chuyển khoản';b.disabled=selfPaid;b.onclick=()=>pay(demoOrder);c.append(b)}}
      if(current==='menu'){
        window.bindDishReviewsPreview?.(main,selectedRestaurant);
        if(scenario==='closed'){main.insertAdjacentHTML('afterbegin','<p class="ui-notice">Menu đã chốt lúc 10:30. Bạn vẫn xem được đơn và thanh toán; người đăng có thể mở lại trong Quản lý.</p>');main.querySelectorAll('.dish button[aria-pressed]').forEach(b=>b.disabled=true);main.querySelector('.cart button').disabled=true;main.querySelector('.cart button').textContent='Đã chốt đơn'}
        if(scenario==='soldout'){const d=main.querySelectorAll('.dish')[1];d.insertAdjacentHTML('beforeend','<span class="badge">Hết món</span>');const b=d.querySelector('button[aria-pressed]');b.disabled=!picked.has(1);if(picked.has(1)){b.textContent='−';main.querySelector('.cart button').disabled=true;main.insertAdjacentHTML('afterbegin','<p class="ui-notice">'+escape(food[1][0])+' vừa hết. Bỏ món này khỏi lựa chọn để tiếp tục.</p>')}}
        if(!signedIn){const b=main.querySelector('.cart button');b.textContent='Đăng nhập để đặt món';b.onclick=()=>{returnAfterSignIn='menu';go('signin')}}
      }
    }
    document.title='Cơm Trưa · '+({today:'Hôm nay',profile:'Cá nhân',post:'Đăng menu',history:'Lịch cơm',manage:'Quản lý',dashboard:'Đơn & thu tiền',taste:'Khẩu vị',changelog:'Cập nhật',restaurants:'Quán ăn',menu:selectedRestaurant}[current]||'Bản xem trước');
    const float=document.querySelector('#online');float.hidden=!signedIn||current==='signin';float.setAttribute('aria-label','4 người đang online');
    float.title=privatePages.has(current)?'Trang cá nhân chỉ chia sẻ trạng thái online':'Trang chung và món đang chọn';
    signal();
  };
  window.feedbackRender=()=>{baseFeedback();if(scenario==='ai-fallback')document.querySelector('#feedback').insertAdjacentHTML('afterbegin','<p class="ui-notice" role="status">Chưa tải được gợi ý. Bạn vẫn có thể chọn cảm nhận hoặc viết ghi chú.</p>')};
  window.toggle=()=>{const p=document.querySelector('#presence');if(p.open)p.close();else matchMedia('(max-width:640px)').matches?p.showModal():p.show();document.querySelector('#online').setAttribute('aria-expanded',String(p.open))};
  document.addEventListener('pointerdown',e=>{const p=document.querySelector('#presence');if(p.open&&!matchMedia('(max-width:640px)').matches&&!p.contains(e.target)&&!document.querySelector('#online').contains(e.target))p.close()});
  document.addEventListener('focusin',e=>{const p=document.querySelector('#presence');if(p.open&&!matchMedia('(max-width:640px)').matches&&!p.contains(e.target)&&e.target!==document.querySelector('#online'))p.close()});
  matchMedia('(max-width:640px)').addEventListener('change',()=>{const p=document.querySelector('#presence');if(p.open){p.close();toggle()}});
  window.addEventListener('message',e=>{if(e.source!==window.parent||e.origin!==location.origin)return;const m=e.data;if(m?.type==='preview-navigate'){scenario='normal';signedIn=true;go(m.page)}if(m?.type==='preview-scenario'&&scenarios.has(m.scenario)){scenario=m.scenario;signedIn=scenario!=='guest';go(current);signal()}});
  window.previewSelfPaid=()=>selfPaid;
  const previousRemember=rememberDemoOrder;window.rememberDemoOrder=()=>{previousRemember();demoOrder.amount=[...picked].reduce((n,i)=>n+food[i][2],0);selfPaid=false};
  window.previewLogout=()=>{signedIn=false;scenario='guest';returnAfterSignIn='today';go('signin')};
  go(pages.has(location.hash.slice(1))?location.hash.slice(1):'today');
})();
