/* Presentation only: the same engine runs instantly in the tests. */
'use strict';
const G=BeanGame, $=id=>document.getElementById(id);
let state=G.createState(), history=[], generation=0;
const pits=[];
for (const player of ['B','A']) {
  const indices=player==='A' ? [0,1,2,3,4,5] : [11,10,9,8,7,6];
  for (const index of indices) {
    const button=document.createElement('button');
    button.className='pit'; button.type='button'; button.dataset.index=index;
    button.innerHTML='<span class="beans" aria-hidden="true"></span><span class="count"></span><span class="pit-label" aria-hidden="true"></span>';
    button.addEventListener('click',()=>move(index));
    $( 'row-'+player).append(button); pits[index]=button;
  }
}
function render(events=[]) {
  const legal=G.legalMoves(state), running=['sowing','relay'].includes(state.phase);
  pits.forEach((button,i)=>{
    const count=state.pits[i];
    button.disabled=!legal.includes(i);
    button.classList.toggle('playable',legal.includes(i));
    button.classList.toggle('selected',state.selected===i && running);
    button.classList.toggle('current',state.cursor===i && running);
    button.classList.remove('capture','drop');
    button.querySelector('.count').textContent=count;
    button.querySelector('.pit-label').textContent=G.owner(i)+(i<6 ? i+1 : 12-i);
    button.setAttribute('aria-label',`Spieler ${G.owner(i)}, Mulde ${i<6 ? i+1 : 12-i}: ${count} Bohnen`);
    const beans=button.querySelector('.beans'); beans.replaceChildren();
    for(let n=0;n<Math.min(count,48);n++) {
      const bean=document.createElement('i');
      const angle=n*2.39996, radius= Math.sqrt((n+.5)/Math.max(count,5))*34;
      bean.style.left=(50+Math.cos(angle)*radius)+'%'; bean.style.top=(48+Math.sin(angle)*radius)+'%';
      bean.style.transform=`translate(-50%,-50%) rotate(${n*137%180}deg)`;
      beans.append(bean);
    }
  });
  for(const e of events) if(e.index!==undefined && ['capture','drop'].includes(e.type)) {
    void pits[e.index].offsetWidth; pits[e.index].classList.add(e.type);
  }
  for(const p of ['A','B']) {
    $('score-'+p).textContent=state.scores[p];
    const reserve=$('reserve-'+p);
    // A larger bowl with 48 stable positions; every collected bean remains visible.
    if(reserve.dataset.count!==String(state.scores[p])) {
      reserve.dataset.count=String(state.scores[p]);
      reserve.replaceChildren();
      if(state.scores[p]===0) {
        const empty=document.createElement('span');
        empty.className='reserve-empty'; empty.textContent='Noch keine Bohnen';
        reserve.append(empty);
      }
      const beans=document.createElement('span'); beans.className='reserve-inner';
      for(let n=0;n<state.scores[p];n++) {
        const bean=document.createElement('i');
        const angle=n*2.39996, radius=Math.sqrt((n+.5)/48)*40;
        bean.style.left=(50+Math.cos(angle)*radius)+'%';
        bean.style.top=(50+Math.sin(angle)*radius)+'%';
        bean.style.transform=`translate(-50%,-50%) rotate(${n*137%180}deg)`;
        beans.append(bean);
      }
      reserve.append(beans);
    }
    reserve.classList.remove('reserve-gain');
    if(events.some(e=>['capture','remainder'].includes(e.type) && e.player===p)) {
      void reserve.offsetWidth; reserve.classList.add('reserve-gain');
    }
    $('player-'+p).classList.toggle('active',state.active===p && !['finished','stalled'].includes(state.phase));
  }
  $('turn').textContent=state.phase==='finished' ? 'Spiel beendet' : state.phase==='stalled' ? 'Spiel angehalten' : `Spieler ${state.active} ${running ? 'verteilt' : 'ist am Zug'}`;
  $('turn').dataset.player=state.active;
  $('move-count').textContent=`Zug ${state.moves+1}`;
  $('hand').textContent=`${state.hand} in der Hand`;
  $('undo').disabled=history.length===0;
  $('status').textContent=state.message;
  $('integrity').textContent=`${G.total(state)} von 48 Bohnen · ${state.pits.reduce((a,b)=>a+b,0)} auf dem Brett · ${state.hand} in der Hand · ${state.scores.A+state.scores.B} eingesammelt`;
}
const delays=[700,420,220,70,0];
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function move(index) {
  if(!G.legalMoves(state).includes(index)) return;
  history.push(structuredClone(state)); const token=++generation;
  let result=G.begin(state,index); state=result.state; render(result.events);
  try {
    let batch=0;
    while(['sowing','relay'].includes(state.phase)) {
      const delay=delays[Number($('speed').value)];
      // Yield even at instant speed so undo/reset remain responsive in long chains.
      if(delay || batch++%100===0) await wait(delay);
      if(token!==generation) return;
      result=G.advance(state); state=result.state;
      if(delay || !['sowing','relay'].includes(state.phase)) render(result.events);
    }
  } catch(error) {
    state.phase='stalled'; state.message=error.message; render();
  }
}
$('new').addEventListener('click',()=>{generation++; history=[]; state=G.createState(); render();});
$('undo').addEventListener('click',()=>{if(history.length){generation++; state=history.pop(); render();}});
$('speed').addEventListener('input',()=>{$('speed-label').value=['Sehr ruhig','Ruhig','Normal','Schnell','Sofort'][$('speed').value];});
render();
