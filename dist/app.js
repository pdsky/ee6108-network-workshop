import { LESSONS, ADDRESS_PLAN, SUBNET_EXPLANATION } from './lessons.js';
import { buildSteps, SCENARIO_META, FAULT_META } from './model.js';
import { STUDY_GUIDES } from './study.js';

const $ = (id) => document.getElementById(id);
const svgNS = 'http://www.w3.org/2000/svg';
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const state = { lesson: 'switch', scenario: 'same', fault: 'none', steps: [], index: 0, progress: 0, playing: false, auto: true, speed: 1, last: 0, study: 'concepts' };
const nodes = {
  A1: { x: 80, y: 105, type: 'pc', ip: '192.168.10.2', prefix: 26, gateway: '192.168.10.1', name: 'A1 · 机房电脑' },
  A2: { x: 80, y: 215, type: 'pc', ip: '192.168.10.3', prefix: 26, gateway: '192.168.10.1', name: 'A2 · 机房电脑' },
  S1: { x: 250, y: 160, type: 'switch', name: 'S1 · 机房交换机' },
  B1: { x: 80, y: 365, type: 'pc', ip: '192.168.10.66', prefix: 27, gateway: '192.168.10.65', name: 'B1 · 办公室电脑' },
  B2: { x: 80, y: 475, type: 'pc', ip: '192.168.10.67', prefix: 27, gateway: '192.168.10.65', name: 'B2 · 办公室电脑' },
  S2: { x: 250, y: 420, type: 'switch', name: 'S2 · 办公室交换机' },
  R1: { x: 450, y: 285, type: 'router', name: 'R1 · 主楼路由器' },
  R2: { x: 655, y: 285, type: 'router', name: 'R2 · 实验楼路由器' },
  S3: { x: 825, y: 285, type: 'switch', name: 'S3 · 实验室交换机' },
  C1: { x: 945, y: 205, type: 'pc', ip: '192.168.10.98', prefix: 28, gateway: '192.168.10.97', name: 'C1 · 实验室电脑' },
  C2: { x: 945, y: 380, type: 'pc', ip: '192.168.10.99', prefix: 28, gateway: '192.168.10.97', name: 'C2 · 实验室电脑' },
};
const edges = [['A1','S1'],['A2','S1'],['S1','R1'],['B1','S2'],['B2','S2'],['S2','R1'],['R1','R2'],['R2','S3'],['S3','C1'],['S3','C2']];
const edgeId = (a, b) => [a,b].sort().join('-');
const colors = { arp: '#d59732', request: '#237a5c', reply: '#428ab0', failure: '#c75c52', success: '#237a5c' };
const safe = (value) => String(value).replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

function svgElement(tag, attrs, parent) {
  const element = document.createElementNS(svgNS, tag);
  Object.entries(attrs).forEach(([key,value]) => element.setAttribute(key, value));
  parent.appendChild(element);
  return element;
}

function drawNetwork() {
  const zones = [
    { x: 18, y: 35, width: 300, height: 236, title: 'A 区 · 机房', subtitle: '192.168.10.0/26 · 50 台终端', fill: '#f0f5e9' },
    { x: 18, y: 298, width: 300, height: 236, title: 'B 区 · 办公室', subtitle: '192.168.10.64/27 · 25 台终端', fill: '#f0f4ee' },
    { x: 766, y: 134, width: 219, height: 305, title: 'C 区 · 实验室', subtitle: '192.168.10.96/28 · 10 台终端', fill: '#edf4ef' },
  ];
  for (const z of zones) {
    svgElement('rect', { x:z.x,y:z.y,width:z.width,height:z.height,rx:16,fill:z.fill,stroke:'#dce7d9','stroke-width':1 }, $('zones'));
    svgElement('text',{x:z.x+15,y:z.y+26,class:'zone-title'},$('zones')).textContent=z.title;
    svgElement('text',{x:z.x+15,y:z.y+43,class:'zone-subtitle'},$('zones')).textContent=z.subtitle;
  }
  for (const [a,b] of edges) svgElement('line',{x1:nodes[a].x,y1:nodes[a].y,x2:nodes[b].x,y2:nodes[b].y,id:`edge-${edgeId(a,b)}`,class:'link'},$('links'));
  svgElement('text',{x:550,y:261,'text-anchor':'middle',class:'link-label'},$('links')).textContent='.113/30 ↔ .114/30';
  svgElement('text',{x:552,y:328,'text-anchor':'middle',class:'link-label'},$('links')).textContent='192.168.10.112/30';
  for (const [id,n] of Object.entries(nodes)) {
    const g=svgElement('g',{transform:`translate(${n.x} ${n.y})`,id:`node-${id}`,class:`device ${n.type}`,tabindex:0,role:'button','aria-label':`查看 ${n.name} 配置`},$('devices'));
    svgElement('title',{},g).textContent=n.name;
    if(n.type==='pc') {
      svgElement('rect',{x:-29,y:-22,width:58,height:42,rx:7,class:'device-shell'},g);
      svgElement('path',{d:'M-17-12H17V9H-17Z M0 9V16 M-8 16H8',class:'device-icon'},g);
    } else if(n.type==='switch') {
      svgElement('rect',{x:-32,y:-18,width:64,height:36,rx:7,class:'device-shell'},g);
      for(let i=0;i<5;i++) svgElement('rect',{x:-23+i*10,y:-3,width:6,height:6,rx:1,class:'device-icon'},g);
      svgElement('path',{d:'M-22-9H16',class:'device-icon'},g);
    } else {
      svgElement('circle',{r:29,class:'device-shell'},g);
      svgElement('path',{d:'M-17 0H17 M0-17V17 M11-5L17 0 11 5 M-11-5L-17 0-11 5 M-5-11L0-17 5-11 M-5 11L0 17 5 11',class:'router-icon'},g);
    }
    svgElement('text',{y:n.type==='router'?51:39,'text-anchor':'middle',class:'device-label'},g).textContent=id;
    if(n.ip) svgElement('text',{y:55,'text-anchor':'middle',class:'device-ip'},g).textContent='.'+n.ip.split('.').at(-1)+' /'+n.prefix;
    else if(n.type==='router') svgElement('text',{y:68,'text-anchor':'middle',class:'device-ip'},g).textContent='路由器';
    else svgElement('text',{y:55,'text-anchor':'middle',class:'device-ip'},g).textContent='交换机';
    g.addEventListener('click',()=>openDevice(id));
    g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openDevice(id)}});
  }
}

function openDevice(id) {
  const n=nodes[id];
  $('device-title').textContent=n.name;
  if(n.type==='pc') {
    const prefix = id==='C1'&&state.fault==='mask'?24:n.prefix;
    const mask = {24:'255.255.255.0',26:'255.255.255.192',27:'255.255.255.224',28:'255.255.255.240'}[prefix];
    const gateway=id==='A1'&&state.fault==='gateway'?'192.168.10.62':n.gateway;
    $('device-info').innerHTML=`<dl><dt>IP 地址</dt><dd>${n.ip}</dd><dt>子网掩码</dt><dd>${mask} /${prefix}</dd><dt>默认网关</dt><dd>${gateway}</dd><dt>MAC 标签</dt><dd>${id}-MAC</dd></dl>`;
  } else if(n.type==='switch') {
    $('device-info').innerHTML='<p>二层交换机学习帧的源 MAC，按目标 MAC 选择转发端口。同一 VLAN 内的广播会发送到其他符合条件的端口。</p><pre>show mac address-table</pre><p class="small-note">本实验不需要为交换机配置转发用的 IP 地址。</p>';
  } else {
    const interfaces=id==='R1'?'A 区接口  192.168.10.1/26\nB 区接口  192.168.10.65/27\n连接 R2   192.168.10.113/30':'C 区接口  192.168.10.97/28\n连接 R1   192.168.10.114/30';
    const routes=id==='R1'?'C 区 → 下一跳 192.168.10.114':state.fault==='return'?'A 区 → 缺少路由（故障）\nB 区 → 下一跳 192.168.10.113':'A 区 → 下一跳 192.168.10.113\nB 区 → 下一跳 192.168.10.113';
    $('device-info').innerHTML=`<span class="mini-label">接口地址</span><pre>${safe(interfaces)}</pre><span class="mini-label">远端静态路由</span><pre>${safe(routes)}</pre><p class="small-note">每个以太网接口有自己的 MAC，动画中以 R1-A-MAC 等标签表示。${state.fault==='mask'&&id==='R2'?'本次掩码故障演示中，C 区接口关闭 Proxy ARP。':''}</p>`;
  }
  $('device-dialog').showModal();
}

function renderLesson() {
  const lesson=LESSONS.find(x=>x.id===state.lesson);
  $('lesson-kicker').textContent=`实验 ${lesson.number} / ${lesson.subtitle}`;
  $('lesson-title').textContent=lesson.title;
  $('lesson-lead').textContent=lesson.lead;
  document.querySelectorAll('.lesson-button').forEach(button=>{const active=button.dataset.lesson===lesson.id;button.classList.toggle('active',active);button.setAttribute('aria-current',active?'step':'false')});
  $('lesson-goals').innerHTML=lesson.goals.map(goal=>`<li>${safe(goal)}</li>`).join('');
  $('lesson-tasks').innerHTML=lesson.tasks.map(task=>`<li>${safe(task)}</li>`).join('');
  $('lesson-command').textContent=lesson.command;
  $('challenge-question').textContent=lesson.challenge.question;
  $('challenge-options').replaceChildren();
  $('challenge-feedback').hidden=true;
  lesson.challenge.options.forEach((option,i)=>{
    const button=document.createElement('button');
    button.innerHTML=`<span>${String.fromCharCode(65+i)}</span>${safe(option)}`;
    button.addEventListener('click',()=>{
      [...$('challenge-options').children].forEach((child,index)=>{child.classList.toggle('correct',index===lesson.challenge.correctIndex);child.classList.toggle('wrong',index===i&&i!==lesson.challenge.correctIndex)});
      $('challenge-feedback').hidden=false;
      $('challenge-feedback').textContent=(i===lesson.challenge.correctIndex?'✓ 预测正确。':'再想一步。')+lesson.challenge.explanation;
    });
    $('challenge-options').appendChild(button);
  });
  const address=state.lesson==='address';
  $('address-workbench').hidden=!address;
  $('simulation-workbench').hidden=address;
  $('copy-command').textContent='复制参考步骤';
  renderStudy();
}

function renderStudy() {
  const guide=STUDY_GUIDES[state.lesson];
  document.querySelectorAll('[data-study]').forEach(button=>{
    const selected=button.dataset.study===state.study;
    button.setAttribute('aria-selected',selected);
    button.tabIndex=selected?0:-1;
  });
  $('study-content').setAttribute('aria-labelledby','tab-'+state.study);
  if(state.study==='concepts') {
    $('study-content').innerHTML=`<p class="study-intro">${safe(guide.intro)}</p><div class="concept-grid">${guide.concepts.map((concept,i)=>`<article class="concept-card"><span class="concept-number">0${i+1}</span><h4>${safe(concept.title)}</h4><p>${safe(concept.body)}</p><div class="concept-example"><b>放到本案例中</b><p>${safe(concept.example)}</p></div></article>`).join('')}</div><div class="pitfall"><b>容易混淆</b><p>${safe(guide.pitfall)}</p></div>`;
  } else if(state.study==='teach') {
    $('study-content').innerHTML=`<p class="study-intro">按这个顺序讲。每讲完一个要点，就在动画中停下来，让同学预测下一步。</p><ol class="teaching-sequence">${guide.teach.map(text=>`<li><p>${safe(text)}</p></li>`).join('')}</ol><div class="pitfall"><b>讲解时提醒</b><p>${safe(guide.pitfall)}</p></div>`;
  } else {
    $('study-content').innerHTML=`<p class="study-intro">在 Packet Tracer 中完成以下操作。配置与检查命令按设备分段执行。</p><ol class="lab-sequence">${guide.lab.map(step=>`<li><h4>${safe(step.title)}</h4><p>${safe(step.detail)}</p>${step.command?`<pre>${safe(step.command)}</pre>`:''}</li>`).join('')}</ol><div class="lab-evidence"><h4>怎样判断实验做对了？</h4><ul>${guide.evidence.map(text=>`<li>${safe(text)}</li>`).join('')}</ul></div>`;
  }
}

function chooseLesson(id) {
  state.lesson=id;
  const lesson=LESSONS.find(x=>x.id===id);
  state.scenario=lesson.scenario;
  state.fault=id==='trouble'?'return':'none';
  $('notice').hidden=true;
  renderLesson();
  resetSimulation();
}

function resetSimulation() {
  state.playing=false;
  state.progress=0;
  state.index=0;
  state.auto=true;
  state.steps=buildSteps({scenario:state.scenario,fault:state.fault});
  const scenario=SCENARIO_META[state.scenario];
  $('path-heading').innerHTML=`${safe(scenario.source)} <span>→</span> ${safe(scenario.target)}`;
  document.querySelectorAll('[data-scenario]').forEach(button=>{const active=button.dataset.scenario===state.scenario;button.classList.toggle('active',active);button.setAttribute('aria-pressed',active)});
  $('fault').innerHTML=Object.entries(FAULT_META).map(([id,fault])=>`<option value="${id}" ${id===state.fault?'selected':''} ${fault.applicableScenarios.includes(state.scenario)?'':'disabled'}>${safe(fault.label)}</option>`).join('');
  $('repair-area').hidden=state.fault==='none';
  $('fault-description').textContent=FAULT_META[state.fault].description;
  $('node-C1').querySelector('.device-ip').textContent=state.fault==='mask'?'.98 /24 ⚠':'.98 /28';
  $('node-C1').querySelector('.device-ip').style.fill=state.fault==='mask'?colors.failure:'';
  $('timeline').replaceChildren();
  state.steps.forEach((step,i)=>{
    const button=document.createElement('button');
    button.setAttribute('aria-label',`第 ${i+1} 步：${step.title}`);
    button.title=step.title;
    button.addEventListener('click',()=>selectStep(i));
    $('timeline').appendChild(button);
  });
  renderStep();
}

function renderStep() {
  const step=state.steps[state.index];
  $('step-count').textContent=`${String(state.index+1).padStart(2,'0')} / ${String(state.steps.length).padStart(2,'0')}`;
  $('step-title').textContent=step.title;
  $('step-description').textContent=step.description;
  $('layer3').textContent=step.layer3;
  $('layer2').textContent=step.layer2;
  $('protocol').textContent=step.protocol;
  $('protocol').className=`protocol-tag ${step.protocol} ${step.phase==='failure'?'failure':''}`;
  $('step-note').textContent=step.note||'先预测下一跳，再播放这一步观察结果。';
  if(step.command) $('step-note').textContent+='\n可验证的命令：'+step.command;
  [...$('timeline').children].forEach((button,i)=>{button.className=[i<state.index?'done':'',i===state.index?'current':'',state.steps[i].phase==='failure'&&i===state.index?'failure':''].join(' ');button.setAttribute('aria-current',i===state.index?'step':'false')});
  $('previous').disabled=state.index===0;
  $('next').disabled=state.index===state.steps.length-1;
  document.querySelectorAll('.link').forEach(link=>link.setAttribute('class','link'));
  for(let i=0;i<step.path.length-1;i++) $(`edge-${edgeId(step.path[i],step.path[i+1])}`).setAttribute('class',`link active ${step.phase}`);
  for(const [id,node] of Object.entries(nodes)) {
    $(`node-${id}`).setAttribute('class',`device ${node.type} ${id===SCENARIO_META[state.scenario].source?'source':''} ${id===SCENARIO_META[state.scenario].target?'target':''} ${id===step.focus?'focus':''} ${step.phase==='failure'&&id===step.focus?'failed':''}`);
  }
  const color=colors[step.phase]||colors.request;
  $('packet-halo').setAttribute('fill',color);
  $('packet-circle').setAttribute('fill',color);
  $('packet-symbol').textContent=step.phase==='failure'?'×':step.phase==='success'?'✓':step.protocol==='ARP'?'?':'';
  renderPlayback();
  drawPacket();
}

function renderPlayback() {
  $('play-label').textContent=state.playing?'暂停':state.progress>=1&&state.index===state.steps.length-1?'再播放一次':'播放动画';
  $('play-icon').textContent=state.playing?'Ⅱ':'▶';
  $('play').setAttribute('aria-label',state.playing?'暂停动画':'播放动画');
  const step=state.steps[state.index];
  let status=state.playing?'正在演示':state.progress>0?'已暂停':'已准备 · 点击播放';
  if(state.progress>=1) status=step.phase==='failure'?'通信失败 · 查看原因':step.phase==='success'?'通信成功 · 收到回复':state.playing?'正在演示':'本步完成 · 可继续下一步';
  $('stage-status').innerHTML=`<i></i>${safe(status)}`;
  $('stage-status').style.color=step.phase==='failure'?colors.failure:step.phase==='success'?colors.success:'';
}

function drawPacket() {
  const step=state.steps[state.index];
  const path=step.path.map(id=>nodes[id]);
  let x=path[0].x,y=path[0].y;
  if(path.length>1) {
    const lengths=path.slice(1).map((point,i)=>Math.hypot(point.x-path[i].x,point.y-path[i].y));
    let distance=(reducedMotion&&state.progress>0?1:state.progress)*lengths.reduce((sum,len)=>sum+len,0);
    for(let i=0;i<lengths.length;i++) {
      if(distance<=lengths[i]||i===lengths.length-1) {
        const t=Math.min(1,distance/lengths[i]);
        x=path[i].x+(path[i+1].x-path[i].x)*t;
        y=path[i].y+(path[i+1].y-path[i].y)*t;
        break;
      }
      distance-=lengths[i];
    }
  }
  $('packet').setAttribute('transform',`translate(${x} ${y})`);
  $('packet').style.opacity=state.progress===0&&!state.playing&&step.protocol!=='结果'?'.55':'1';
}

function selectStep(index) {
  state.index=Math.max(0,Math.min(state.steps.length-1,index));
  state.progress=reducedMotion?1:0;
  state.playing=!reducedMotion;
  state.auto=false;
  state.last=0;
  renderStep();
}

function togglePlay() {
  if(state.playing){state.playing=false;renderPlayback();return}
  if(state.progress>=1) {
    state.index=state.index===state.steps.length-1?0:state.index+1;
    state.progress=0;
  }
  state.playing=true;
  state.auto=true;
  state.last=0;
  renderStep();
}

function frame(now) {
  if(state.playing&&state.steps.length) {
    if(!state.last) state.last=now;
    const delta=Math.min(now-state.last,100);
    state.last=now;
    const step=state.steps[state.index];
    const duration=(reducedMotion?2300:3600+Math.max(0,step.path.length-1)*400)/state.speed;
    state.progress=Math.min(1,state.progress+delta/duration);
    drawPacket();
    if(state.progress>=1) {
      if(state.auto&&state.index<state.steps.length-1) {state.index++;state.progress=0;renderStep()}
      else {state.playing=false;renderPlayback()}
    }
  }
  requestAnimationFrame(frame);
}

function renderSubnet() {
  const prefix=Number($('prefix').value),total=2**(32-prefix),capacity=total-2;
  const hosts=Math.max(1,Math.min(250,Number($('host-count').value)||1));
  const need=hosts+1;
  $('prefix-label').textContent='/'+prefix;
  $('capacity').textContent=capacity;
  $('capacity-result').textContent=capacity>=need?`✓ 容量足够 · 需要 ${need} 个`:`容量不足 · 还差 ${need-capacity} 个`;
  document.querySelector('.capacity-box').classList.toggle('insufficient',capacity<need);
  $('address-blocks').replaceChildren();
  for(let i=0;i<total;i++) {
    const cell=document.createElement('span');
    cell.className='address-cell '+(i===0?'network-dot':i===total-1?'broadcast-dot':'');
    cell.title=`192.168.10.${i} · ${i===0?'网络地址':i===total-1?'广播地址':'可用主机地址'}`;
    $('address-blocks').appendChild(cell);
  }
  $('address-blocks').setAttribute('aria-label',`/ ${prefix} 子网共 ${total} 个地址，其中 ${capacity} 个可用地址`);
}

$('lesson-nav').innerHTML=LESSONS.map(lesson=>`<button class="lesson-button" data-lesson="${lesson.id}"><span class="lesson-number">${lesson.number}</span><span><b>${safe(lesson.title)}</b><small>${safe(lesson.subtitle)}</small></span></button>`).join('');
document.querySelectorAll('[data-lesson]').forEach(button=>button.addEventListener('click',()=>chooseLesson(button.dataset.lesson)));
document.querySelectorAll('[data-scenario]').forEach(button=>button.addEventListener('click',()=>{
  const scenario=button.dataset.scenario;
  if(state.lesson==='trouble') {state.scenario=scenario;if(!FAULT_META[state.fault].applicableScenarios.includes(scenario)) state.fault='none';$('notice').hidden=true;resetSimulation()}
  else chooseLesson({same:'switch',direct:'gateway',remote:'route'}[scenario]);
}));
$('fault').addEventListener('change',()=>{
  state.fault=$('fault').value;
  if(state.fault!=='none') {state.lesson='trouble';renderLesson()}
  $('notice').hidden=state.fault!=='mask';
  if(state.fault==='mask') $('notice').textContent='掩码故障的实验条件：R2 的 C 区接口关闭 Proxy ARP，C1 无相关 ARP 缓存。实际设备可能用 Proxy ARP 代答，暂时掩盖错误。';
  resetSimulation();
});
$('play').addEventListener('click',togglePlay);
$('next').addEventListener('click',()=>selectStep(state.index+1));
$('previous').addEventListener('click',()=>selectStep(state.index-1));
$('reset').addEventListener('click',resetSimulation);
$('speed').addEventListener('change',()=>state.speed=Number($('speed').value));
$('repair').addEventListener('click',()=>{
  const fix=FAULT_META[state.fault].fix;
  state.fault='none';
  resetSimulation();
  $('notice').hidden=false;
  $('notice').textContent='✓ 已恢复正确配置。'+fix+' 本次自动重放正常路径。';
  togglePlay();
});
$('teacher-toggle').addEventListener('click',()=>{
  const open=$('teacher-notes').hidden;
  $('teacher-notes').hidden=!open;
  $('teacher-toggle').setAttribute('aria-expanded',open);
  $('teacher-toggle').innerHTML=`讲师提示 <span aria-hidden="true">${open?'－':'＋'}</span>`;
});
$('copy-command').addEventListener('click',async()=>{
  try{await navigator.clipboard.writeText($('lesson-command').textContent);$('copy-command').textContent='✓ 已复制'}catch{$('copy-command').textContent='请选中上方文字复制'}
});
$('presentation').addEventListener('click',()=>{
  const active=document.body.classList.toggle('presentation');
  $('presentation').setAttribute('aria-pressed',active);
  $('presentation').innerHTML=active?'退出演示模式 <span aria-hidden="true">↙</span>':'进入演示模式 <span aria-hidden="true">↗</span>';
});
$('study-open').addEventListener('click',()=>{$('study-guide').scrollIntoView({behavior:reducedMotion?'instant':'smooth',block:'start'});$('study-content').focus({preventScroll:true})});
document.querySelectorAll('[data-study]').forEach(button=>{
  button.addEventListener('click',()=>{state.study=button.dataset.study;renderStudy()});
  button.addEventListener('keydown',event=>{
    if(event.key!=='ArrowLeft'&&event.key!=='ArrowRight')return;
    event.preventDefault();event.stopPropagation();
    const tabs=[...document.querySelectorAll('[data-study]')],index=tabs.indexOf(button),next=tabs[(index+(event.key==='ArrowRight'?1:tabs.length-1))%tabs.length];
    state.study=next.dataset.study;renderStudy();next.focus();
  });
});
$('start-network').addEventListener('click',()=>chooseLesson('switch'));
$('prefix').addEventListener('input',renderSubnet);
$('host-count').addEventListener('input',renderSubnet);
$('host-count').addEventListener('change',()=>{$('host-count').value=Math.max(1,Math.min(250,Number($('host-count').value)||1));renderSubnet()});
$('device-dialog').querySelector('.dialog-close').addEventListener('click',()=>$('device-dialog').close());
$('device-dialog').addEventListener('click',e=>{if(e.target===$('device-dialog')) {const rect=$('device-dialog').getBoundingClientRect();if(e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top||e.clientY>rect.bottom)$('device-dialog').close()}});
document.addEventListener('keydown',e=>{
  if(['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName)||$('device-dialog').open||state.lesson==='address')return;
  if(e.code==='Space'){if(document.activeElement?.tagName==='BUTTON')return;e.preventDefault();togglePlay()}
  else if(e.key==='ArrowRight'){e.preventDefault();selectStep(state.index+1)}
  else if(e.key==='ArrowLeft'){e.preventDefault();selectStep(state.index-1)}
  else if(e.key.toLowerCase()==='r')resetSimulation();
});
$('subnet-explanation').textContent=SUBNET_EXPLANATION;
$('address-plan').innerHTML=ADDRESS_PLAN.map(row=>`<tr><td>${safe(row.name)}<br><span class="mini-label">${row.hosts}${row.id==='link'?' 个接口':' 台终端 + 1 个网关'}</span></td><td>${row.network}/${row.prefix}<br><span class="mini-label">广播 ${row.broadcast}</span></td><td>${row.mask}</td><td>${safe(row.gateway)}</td></tr>`).join('');
drawNetwork();
renderSubnet();
chooseLesson('address');
requestAnimationFrame(frame);
