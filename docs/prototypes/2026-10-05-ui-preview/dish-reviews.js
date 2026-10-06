(() => {
  'use strict';
  const summaries={
    'Cơm nhà An':{
      'Thịt kho trứng':{count:9,people:5,bins:[0,0,1,1,7],tags:[['Thịt mềm',7],['Nước kho vừa vị',6],['Hơi mặn',2]],notes:['Thịt mềm, trứng thấm vị.','Nước kho hơi mặn khi ăn ít cơm.']},
      'Gà nướng mật ong':{count:12,people:7,bins:[0,1,1,3,7],tags:[['Thịt gà mềm',8],['Hơi ngọt',5],['Da nướng thơm',4]],notes:['Thịt mềm, nước sốt hơi ngọt.','Phần thịt vừa đủ, da thơm.']},
      'Canh chua cá':{count:8,people:5,bins:[0,1,2,3,2],tags:[['Chua thanh',5],['Cá hơi tanh',3],['Canh còn nóng',3]],notes:['Vị chua vừa, rau còn giòn.','Cá hơi tanh, nước canh ổn.']}
    },
    'Bếp cô Tư':{
      'Cá kho tộ':{count:14,people:7,bins:[0,0,1,4,9],tags:[['Cá thấm vị',9],['Ít xương',5],['Hơi mặn',3]],notes:['Cá mềm và thấm vị.','Nước kho hơi mặn, ăn cùng cơm vừa.']},
      'Đậu hũ sốt nấm':{count:5,people:3,bins:[0,0,1,3,1],tags:[['Đậu mềm',4],['Sốt vừa vị',3],['Phần ăn hơi ít',2]],notes:['Đậu mềm, nấm thơm.','Sốt vừa vị nhưng phần ăn hơi ít.']}
    }
  };
  const esc=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const average=s=>(s.bins.reduce((n,v,i)=>n+v*(i+1),0)/s.count).toFixed(1).replace('.',',');
  const css=document.createElement('style');css.textContent=`.dish-review-summary{margin-top:12px}.dish .dish-review-open{display:inline-flex;align-items:center;gap:8px;min-height:44px;width:auto;max-width:100%;font-size:13px;padding:6px 0;border:0;border-radius:4px;background:transparent;color:#505b46;text-align:left;flex-wrap:wrap}.dish-review-open strong{color:#303a29}.dish-review-tags{font-size:12px;line-height:1.6;color:#69715f;margin:0!important}.dish-review-empty{margin-top:12px!important;color:#747a6a!important;font-size:12px!important}.review-distribution{display:grid;grid-template-columns:45px 1fr 28px;gap:12px;align-items:center;margin:12px 0;font-size:13px}.review-track{height:7px;background:#eeefe9;border-radius:10px;overflow:hidden}.review-track i{height:100%;display:block;background:#89977a}.review-stat{font-size:30px;font-weight:700;color:#30382a}.review-comments{padding:0;list-style:none}.review-comments li{padding:14px 0;border-top:1px solid #e1e3da;font-size:14px;color:#505b46}.review-count-tags{display:flex;flex-wrap:wrap;gap:8px}.review-count-tags span{background:#f1f3ec;color:#4f5c42;border-radius:8px;padding:8px 10px;font-size:13px}`;document.head.append(css);
  const dialog=document.createElement('dialog');dialog.className='modal';dialog.setAttribute('aria-labelledby','dish-review-title');document.body.append(dialog);
  function open(shop,name,summary){
    dialog.innerHTML='<header><div><span class="eyebrow">'+esc(shop)+'</span><h2 id="dish-review-title">'+esc(name)+'</h2></div><button class="close" aria-label="Đóng đánh giá món">×</button></header><div class="row"><span class="review-stat">'+average(summary)+'<span class="tiny"> / 5</span></span><span class="tiny">'+summary.count+' lượt · '+summary.people+' người</span></div><p class="tiny">Đánh giá tại '+esc(shop)+'.</p>'+[5,4,3,2,1].map(star=>'<div class="review-distribution"><span>'+star+' sao</span><div class="review-track" aria-hidden="true"><i style="width:'+Math.round(summary.bins[star-1]/summary.count*100)+'%"></i></div><span>'+summary.bins[star-1]+'</span></div>').join('')+'<h3>Phản hồi gần đây</h3><div class="review-count-tags">'+summary.tags.map(([label,count])=>'<span>'+esc(label)+' · '+count+'</span>').join('')+'<h3 style="margin-top:24px">Ghi chú gần đây</h3><ul class="review-comments">'+summary.notes.map(note=>'<li>'+esc(note)+'</li>').join('')+'</ul><p class="tiny">Phản hồi mẫu để xem cách hiển thị.</p><button data-own-review style="width:100%">Xem bữa ăn của bạn</button>';
    dialog.querySelector('.close').onclick=()=>dialog.close();dialog.querySelector('[data-own-review]').onclick=()=>{dialog.close();go('history')};dialog.showModal();
  }
  window.bindDishReviewsPreview=(root,shop)=>{
    root.querySelectorAll('.dish').forEach(card=>{
      const name=card.querySelector('h3').textContent,summary=summaries[shop]?.[name],content=card.querySelector(':scope > div');
      if(!summary){const empty=document.createElement('p');empty.className='dish-review-empty';empty.textContent='Chưa có đánh giá';content.append(empty);return;}
      const block=document.createElement('div');block.className='dish-review-summary';block.innerHTML='<button class="dish-review-open" aria-label="Xem '+summary.count+' đánh giá '+esc(name)+' tại '+esc(shop)+'"><strong>★ '+average(summary)+' / 5</strong><span>'+summary.count+' lượt</span><span aria-hidden="true">›</span></button><p class="dish-review-tags" title="Phản hồi gần đây">'+summary.tags.slice(0,2).map(([label])=>esc(label)).join(' · ')+'</p>';block.querySelector('button').onclick=()=>open(shop,name,summary);content.append(block);
    });
  };
})();
