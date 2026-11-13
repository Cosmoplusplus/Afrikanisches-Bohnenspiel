/* DOM-free rules engine. Indices 0..5: A left→right; 6..11: B right→left.
   Thus +1 follows a counterclockwise circuit in screen coordinates. */
(function (root) {
  'use strict';
  const clone = s => JSON.parse(JSON.stringify(s));
  const owner = i => i < 6 ? 'A' : 'B';
  const other = p => p === 'A' ? 'B' : 'A';
  const total = s => s.pits.reduce((a,b) => a+b, 0) + s.scores.A + s.scores.B + s.hand;
  function validate(s) {
    if (s.pits.length !== 12 || [...s.pits, s.scores.A, s.scores.B, s.hand].some(n => !Number.isInteger(n) || n < 0) || total(s) !== 48)
      throw new Error('Ungültiger Spielstand: Es müssen genau 48 Bohnen vorhanden sein.');
    return s;
  }
  function createState() {
    return {pits: Array(12).fill(4), scores:{A:0,B:0}, active:'A', hand:0, cursor:null,
      selected:null, lastCollector:null, phase:'ready', seen:[], moves:0, message:'Spieler A beginnt. Wähle eine deiner Mulden.'};
  }
  function legalMoves(s) {
    return s.phase === 'ready' ? s.pits.flatMap((n,i) => n > 0 && owner(i) === s.active ? [i] : []) : [];
  }
  // Isolated policy: a repeated relay position halts play, without awarding beans.
  function repeatPolicy(s) {
    const key = JSON.stringify([s.pits,s.scores,s.active,s.cursor]);
    if (s.seen.includes(key)) {
      s.phase='stalled'; s.message='Wiederholte Stellung innerhalb des Zuges. Die Verteilung wurde angehalten. Bitte Zug rückgängig machen oder neu starten.';
      return true;
    }
    s.seen.push(key); return false;
  }
  function finish(s, events) {
    s.hand=0; s.seen=[]; s.moves++;
    if (s.scores.A+s.scores.B === 48) {
      s.phase='finished';
      s.message=s.scores.A === s.scores.B ? 'Unentschieden! Beide haben 24 Bohnen.' : `Spieler ${s.scores.A > s.scores.B ? 'A' : 'B'} gewinnt! Alle 48 Bohnen sind eingesammelt.`;
      events.push({type:'finish'}); return;
    }
    s.active=other(s.active); s.phase='ready';
    if (!legalMoves(s).length) {
      events.push({type:'skip',player:s.active}); const skipped=s.active;
      s.active=other(s.active);
      if (!legalMoves(s).length) {
        s.phase='stalled'; s.message='Keine legalen Züge trotz verbleibender Bohnen. Bitte Spielstand prüfen oder neu starten.';
      } else s.message=`Spieler ${skipped} hat keine Bohnen und setzt aus. Spieler ${s.active} ist erneut am Zug.`;
    } else s.message=`Spieler ${s.active} ist am Zug. Wähle eine eigene Mulde.`;
    events.push({type:'turn',player:s.active});
  }
  // End policy: the latest actual collector receives the final eight immediately,
  // including beans still in hand. No further drop or relay may happen afterwards.
  function collectFinalEight(s, events) {
    if (48-s.scores.A-s.scores.B !== 8) return false;
    const recipient=s.lastCollector;
    s.scores[recipient]+=8;
    s.pits.fill(0); s.hand=0;
    events.push({type:'remainder',player:recipient,count:8});
    finish(s,events);
    s.message=`Die letzten acht Bohnen gehen an Spieler ${recipient}, der zuletzt Bohnen eingesammelt hat. ${s.message}`;
    return true;
  }
  function begin(state,index) {
    validate(state);
    if (!legalMoves(state).includes(index)) throw new Error('Diese Mulde darf nicht gewählt werden.');
    const s=clone(state); s.hand=s.pits[index]; s.pits[index]=0; s.cursor=index; s.selected=index;
    s.phase='sowing'; s.seen=[]; s.message=`Spieler ${s.active} verteilt …`;
    return {state:validate(s),events:[{type:'pickup',index,count:s.hand}]};
  }
  function advance(state) {
    const s=clone(validate(state)), events=[];
    if (s.phase === 'relay') {
      if (repeatPolicy(s)) return {state:validate(s),events:[{type:'stalled'}]};
      s.hand=s.pits[s.cursor]; s.pits[s.cursor]=0; s.phase='sowing';
      events.push({type:'pickup',index:s.cursor,count:s.hand});
    } else if (s.phase === 'sowing') {
      s.cursor=(s.cursor+1)%12;
      const index=s.cursor, wasEmpty=s.pits[index]===0;
      s.hand--; s.pits[index]++;
      const last=s.hand===0;
      events.push({type:'drop',index,last});
      if (s.pits[index]===4) {
        const recipient=last && owner(index)!==s.active ? s.active : owner(index);
        s.pits[index]=0; s.scores[recipient]+=4; s.lastCollector=recipient;
        events.push({type:'capture',index,player:recipient,exception:last && owner(index)!==s.active});
        if (!collectFinalEight(s,events) && last) finish(s,events);
      } else if (last) {
        if (wasEmpty) finish(s,events);
        else s.phase='relay';
      }
    } else throw new Error('Es läuft keine Verteilung.');
    return {state:validate(s),events};
  }
  function playMove(state,index,onStep) {
    let result=begin(state,index); if(onStep) onStep(result);
    while (['sowing','relay'].includes(result.state.phase)) {
      result=advance(result.state); if(onStep) onStep(result);
    }
    return result.state;
  }
  const api={createState,legalMoves,begin,advance,playMove,owner,total,validate};
  if (typeof module !== 'undefined' && module.exports) module.exports=api;
  else root.BeanGame=api;
})(globalThis);
