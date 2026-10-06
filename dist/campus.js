import { CAMPUS_LESSONS } from './campus-lessons.js';
import { evaluateAccess, buildJourney, getPolicyRows } from './campus-model.js';

const $ = (id) => document.getElementById(id);
const escapeHTML = (value) => String(value).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const state = { lesson: 0, view: 'demo', student: 'A', target: 'lab', protocol: 'http', authorized: false, fault: 'none', step: 0, speed: 1, playing: false, presentation: false };
const answers = new Map();
let journey = [];
let timer;
let animationFrame;
let animationGeneration = 0;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const TARGET_NAMES = {public:'公共网站',lab:'实验网站',teacher:'教师电脑',management:'管理区 AUTH-PC'};
const PROTOCOL_NAMES = {http:'HTTP',icmp:'ping / ICMP',ssh:'SSH'};
const NODES = {
  SA:{x:100,y:165,name:'Student-A',ip:'192.168.10.11',mask:'255.255.255.192',gateway:'192.168.10.1',vlan:10,role:'学生电脑；授权按这个固定源 IP 匹配。'},
  SB:{x:100,y:365,name:'Student-B',ip:'192.168.10.12',mask:'255.255.255.192',gateway:'192.168.10.1',vlan:10,role:'未授权学生；用来验证是否意外开放了所有学生。'},
  SS:{x:225,y:265,name:'STU-SW',ip:'192.168.10.116',mask:'255.255.255.240',gateway:'192.168.10.113',vlan:99,role:'学生接入交换机。Fa0/1、Fa0/2 属于 VLAN 10；G0/1 为 trunk。这里的 IP 是管理 SVI，不是学生网关。'},
  CORE:{x:435,y:265,name:'CORE-SW',ip:'192.168.10.115',mask:'255.255.255.240',gateway:'192.168.10.113',vlan:99,role:'核心二层交换机。Fa0/1 到 R1，G0/1、G0/2 到接入交换机，均为 trunk。Fa0/2、Fa0/3 接服务器 VLAN 30，Fa0/4 接 AUTH-PC VLAN 99。'},
  R1:{x:600,y:265,name:'R1',role:'四个 VLAN 的网关。G0/0.10 入方向应用学生 ACL；跨 VLAN 先检查规则，再查询直连路由。AUTH-PC 通过 .113 进行 SSH 管理。'},
  TS:{x:800,y:110,name:'TCH-SW',ip:'192.168.10.117',mask:'255.255.255.240',gateway:'192.168.10.113',vlan:99,role:'教师接入交换机。Fa0/1、Fa0/2 属于 VLAN 20；G0/1 为 trunk。管理 SVI 属于 VLAN 99。'},
  TA:{x:945,y:88,name:'Teacher-A',ip:'192.168.10.66',mask:'255.255.255.224',gateway:'192.168.10.65',vlan:20,role:'普通教师电脑；可访问两个网站。设备管理入口只接受 AUTH-PC，教师身份本身不会自动获得管理权限。'},
  TB:{x:945,y:160,name:'Teacher-B',ip:'192.168.10.67',mask:'255.255.255.224',gateway:'192.168.10.65',vlan:20,role:'普通教师电脑；与 Teacher-A 使用相同的网站访问政策。'},
  PUB:{x:935,y:300,name:'PUBLIC-SRV',ip:'192.168.10.100',mask:'255.255.255.240',gateway:'192.168.10.97',vlan:30,role:'公共课程资料 HTTP 网站。学生基线许可允许 TCP 80，不代表允许对它 ping 或 SSH。'},
  LAB:{x:935,y:397,name:'LAB-SRV',ip:'192.168.10.101',mask:'255.255.255.240',gateway:'192.168.10.97',vlan:30,role:'受限实验资源 HTTP 网站；只有获许可的 Student-A 可以访问 TCP 80。服务器放在独立 VLAN，使访问经过路由器 ACL。'},
  AUTH:{x:935,y:545,name:'AUTH-PC',ip:'192.168.10.114',mask:'255.255.255.240',gateway:'192.168.10.113',vlan:99,role:'授权教师使用的专用管理终端。向 R1 .113 发起 SSH 并修改 ACL；它本身不是本实验的 SSH 服务端。'}
};
const PLAN = [
  ['学生区',10,'192.168.10.0/26','255.255.255.192','.1','.11 / .12','62'],
  ['教师区',20,'192.168.10.64/27','255.255.255.224','.65','.66 / .67','30'],
  ['服务器区',30,'192.168.10.96/28','255.255.255.240','.97','.100 / .101','14'],
  ['管理区',99,'192.168.10.112/28','255.255.255.240','.113','.114–.117','14']
];
const nodeElements = new Map();
const LINKS = [['SA','SS'],['SB','SS'],['SS','CORE'],['CORE','R1'],['CORE','TS'],['TS','TA'],['TS','TB'],['CORE','PUB'],['CORE','LAB'],['CORE','AUTH']];

function requestOptions(extra = {}) { return {student:state.student,target:state.target,protocol:state.protocol,authorized:state.authorized,fault:state.fault,...extra}; }
function statusLabel(result) { return result.allowed ? '允许访问' : result.networkAllowed ? '许可已通过，访问失败' : '被 ACL 拒绝'; }

function setView(view, focus = false) {
  if (!['learn','demo','lab','quiz'].includes(view)) return;
  if (view !== 'demo') pause();
  state.view = view;
  document.querySelectorAll('[data-view]').forEach(button => {
    const selected = button.dataset.view === view;
    button.setAttribute('aria-selected', String(selected));
    button.tabIndex = selected ? 0 : -1;
    $(`panel-${button.dataset.view}`).hidden = !selected;
  });
  if (focus) $(`tab-${view}`).focus();
}

function selectLesson(index) {
  if (index < 0 || index >= CAMPUS_LESSONS.length) return;
  pause();
  state.lesson = index;
  const lesson = CAMPUS_LESSONS[index];
  $('lesson-kicker').textContent = `${lesson.number} / ${lesson.subtitle}`;
  $('lesson-title').textContent = lesson.title;
  $('lesson-lead').textContent = lesson.lead;
  $('takeaway').textContent = lesson.takeaway;
  document.querySelectorAll('[data-lesson]').forEach(button => {
    const selected = Number(button.dataset.lesson) === index;
    button.classList.toggle('selected',selected);
    if (selected) button.setAttribute('aria-current','step'); else button.removeAttribute('aria-current');
  });
  $('previous-lesson').disabled = index === 0;
  $('next-lesson').disabled = index === CAMPUS_LESSONS.length - 1;
  renderLearning(); renderLab(); renderQuiz();
  setView(lesson.id === 'grant' || lesson.id === 'trouble' ? 'demo' : 'learn');
}

function addressTable() {
  return `<div class="table-scroll"><table><caption>校园地址规划 · 所有 .x 简写均以 192.168.10 开头</caption><thead><tr><th>区域 / VLAN</th><th>子网</th><th>接口掩码</th><th>网关</th><th>示例主机</th><th>可用地址</th></tr></thead><tbody>${PLAN.map(row => `<tr><th>${row[0]} · ${row[1]}</th>${row.slice(2).map(value => `<td>${escapeHTML(value)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

function renderLearning() {
  const lesson = CAMPUS_LESSONS[state.lesson];
  let extra = '';
  if (lesson.id === 'zones') {
    extra = `<div class="policy-matrix"><h3>我们想要的访问结果</h3><div class="table-scroll"><table><caption>正常网络与服务下的新请求</caption><thead><tr><th>发起者</th><th>公共网页</th><th>实验网页</th><th>设备 SSH</th></tr></thead><tbody><tr><th>学生 A · 未授权</th><td>允许</td><td>拒绝</td><td>拒绝</td></tr><tr><th>学生 A · 已授权</th><td>允许</td><td>允许 TCP 80</td><td>拒绝</td></tr><tr><th>学生 B</th><td>允许</td><td>拒绝</td><td>拒绝</td></tr><tr><th>普通教师</th><td>允许</td><td>允许</td><td>拒绝</td></tr><tr><th>AUTH-PC</th><td>允许</td><td>允许</td><td>认证后允许</td></tr></tbody></table></div><p>所有学生对教师区和管理区的跨 VLAN 访问都拒绝。教师访问学生时，学生回包也可能被学生 ACL 拒绝；本方案不保证教师可远程控制学生。</p></div>`;
  }
  if (lesson.id === 'address') {
    extra = `<div class="address-exercise"><div><span class="eyebrow">亲自算一算</span><h3>50 台学生电脑，加一个网关，够吗？</h3><p>改动人数和子网大小，比较需要的地址与可用容量。</p></div><div class="capacity-controls"><label>学生电脑数<input id="host-count" type="number" min="1" max="250" value="50"></label><label>子网前缀<select id="prefix"><option value="24">/24</option><option value="25">/25</option><option value="26" selected>/26</option><option value="27">/27</option><option value="28">/28</option><option value="29">/29</option><option value="30">/30</option></select></label><div id="capacity-result" role="status"></div></div></div>${addressTable()}`;
  }
  if (lesson.id === 'vlan') extra = `<div class="route-explanation"><h3>跨 VLAN 时，同一条线走两次</h3><p>学生 → CORE → <b>R1（VLAN 10）</b> → <b>CORE（VLAN 30）</b> → 服务器。R1 与 CORE 共用一根 trunk；去程带 VLAN 10 标签，R1 路由后用 VLAN 30 返回核心交换机。</p><button data-open-demo>用动画看这条路径</button></div>`;
  if (lesson.id === 'acl' || lesson.id === 'grant' || lesson.id === 'trouble') extra = `<div class="route-explanation"><h3>先预测，再动手</h3><p>${lesson.id === 'trouble' ? '先授权 A，再加入一个故障。检查：ACL 是否许可？路径是否连通？HTTP 是否开启？' : 'A 未授权时请求实验 HTTP 会命中拒绝；授权后精确命中许可。换成 B 或 ping，再看第一条匹配有没有改变。'}</p><button data-open-demo>打开动画与授权实验</button></div>`;
  $('panel-learn').innerHTML = `<div class="concept-grid">${lesson.concepts.map((item,i) => `<article class="concept-card"><span class="concept-number">${String(i+1).padStart(2,'0')}</span><h3>${escapeHTML(item.title)}</h3><p>${escapeHTML(item.body)}</p><div class="example"><b>具体例子</b><p>${escapeHTML(item.example)}</p></div></article>`).join('')}</div>${extra}<details class="teaching-card" open><summary>怎么讲给同学 · 建议话术与提问</summary><ol>${lesson.teach.map(line => `<li>${escapeHTML(line)}</li>`).join('')}</ol><p>讲解顺序：先展示需求，再让同学预测，最后播放动画或在 Packet Tracer 验证。</p></details>`;
  document.querySelectorAll('[data-open-demo]').forEach(button => button.addEventListener('click',() => setView('demo',true)));
  if (lesson.id === 'address') {
    $('host-count').addEventListener('input',updateCapacity);
    $('prefix').addEventListener('change',updateCapacity);
    updateCapacity();
  }
}

function updateCapacity() {
  const count = Number($('host-count').value);
  if (!Number.isInteger(count) || count < 1 || count > 250) { $('capacity-result').textContent = '请输入 1–250 之间的整数。'; return; }
  const prefix = Number($('prefix').value), available = 2 ** (32 - prefix) - 2, needed = count + 1;
  const ok = available >= needed;
  $('capacity-result').className = ok ? 'capacity-result ok' : 'capacity-result insufficient';
  $('capacity-result').innerHTML = `<b>${available} 个可用地址</b><p>${count} 台电脑 + 1 个网关 = ${needed} 个地址。${ok ? `够用，剩余 ${available-needed} 个。` : `不够，还差 ${needed-available} 个。`}</p>`;
}

function renderLab() {
  const lesson = CAMPUS_LESSONS[state.lesson];
  $('panel-lab').innerHTML = `<div class="lab-intro"><span class="eyebrow">第 ${lesson.number} 课 · 在 Packet Tracer 中完成</span><h3>${escapeHTML(lesson.subtitle)}</h3><p>按课程顺序搭建同一份实验。以下为参考配置；设备命令与 .pkt 尚需本机预实验。每段只在指定设备输入，遇到报错先核对型号与端口。</p></div><ol class="lab-steps">${lesson.lab.map((step,i) => `<li class="lab-step"><div class="lab-step-heading"><span class="step-number">${i+1}</span><h3>${escapeHTML(step.title)}</h3>${step.command ? `<button class="copy-command" data-command-index="${i}">复制这段命令</button>` : ''}</div><p>${escapeHTML(step.detail)}</p>${step.command ? `<pre tabindex="0"><code>${escapeHTML(step.command)}</code></pre><p class="copy-feedback" id="copy-feedback-${i}" role="status"></p>` : ''}</li>`).join('')}</ol><div class="lab-boundary"><b>实验文件怎么提交？</b><p>在 Packet Tracer 使用 File → Save As 保存 .pkt。提交正确的未授权、A 授权、撤销三种配置，并附访问测试表和截图；网站动画和截图不能代替可打开的 .pkt。具体命名与交付项按老师要求调整。</p></div>`;
  document.querySelectorAll('[data-command-index]').forEach(button => button.addEventListener('click',async () => {
    const index = Number(button.dataset.commandIndex);
    try { await navigator.clipboard.writeText(lesson.lab[index].command); $(`copy-feedback-${index}`).textContent = '已复制。请核对设备名称后逐段输入。'; }
    catch { $(`copy-feedback-${index}`).textContent = '浏览器未允许复制，请直接选中上方命令复制。'; }
  }));
}

function renderQuiz() {
  const lesson = CAMPUS_LESSONS[state.lesson];
  const saved = answers.get(lesson.id) || [];
  $('panel-quiz').innerHTML = `<div class="quiz-intro"><span class="eyebrow">理解检查 · 每课两题</span><h3>先想一想，再看解释。</h3><p>答错也可以重新选。讲课时可以先请同学投票，再揭晓原因。</p></div><div class="quiz-list">${lesson.questions.map((question,i) => `<article class="quiz-card"><span class="eyebrow">问题 ${i+1} / ${lesson.questions.length}</span><h3>${escapeHTML(question.question)}</h3><div class="quiz-options" role="group" aria-label="问题 ${i+1} 的选项">${question.options.map((option,j) => `<button data-question="${i}" data-answer="${j}" aria-pressed="${saved[i] === j}"><span>${'ABC'[j]}</span>${escapeHTML(option)}</button>`).join('')}</div><p id="quiz-feedback-${i}" class="quiz-feedback" role="status" ${saved[i] === undefined ? 'hidden' : ''}></p></article>`).join('')}</div><p id="quiz-score" class="quiz-score" role="status"></p>`;
  document.querySelectorAll('[data-question]').forEach(button => button.addEventListener('click',() => answerQuestion(Number(button.dataset.question),Number(button.dataset.answer))));
  saved.forEach((choice,i) => paintAnswer(i,choice));
  updateScore();
}
function answerQuestion(index, choice) {
  const id = CAMPUS_LESSONS[state.lesson].id, saved = answers.get(id) || [];
  saved[index] = choice; answers.set(id,saved); paintAnswer(index,choice); updateScore();
}
function paintAnswer(index, choice) {
  const question = CAMPUS_LESSONS[state.lesson].questions[index], correct = choice === question.correctIndex;
  document.querySelectorAll(`[data-question="${index}"]`).forEach(button => {
    const chosen = Number(button.dataset.answer) === choice;
    button.setAttribute('aria-pressed',String(chosen));
    button.classList.toggle('correct',chosen && correct); button.classList.toggle('incorrect',chosen && !correct);
  });
  const feedback = $(`quiz-feedback-${index}`); feedback.hidden = false;
  feedback.className = `quiz-feedback ${correct ? 'correct' : 'incorrect'}`;
  feedback.textContent = `${correct ? '答对了。' : '再想一下。'}${question.explanation}`;
}
function updateScore() {
  const lesson = CAMPUS_LESSONS[state.lesson], saved = answers.get(lesson.id) || [];
  const completed = saved.filter(value => value !== undefined).length;
  const correct = lesson.questions.filter((question,i) => saved[i] === question.correctIndex).length;
  $('quiz-score').textContent = completed ? `已回答 ${completed}/${lesson.questions.length} 题，当前答对 ${correct} 题。` : '先选一个答案，查看原因。';
}

function prepareTopology() {
  const elements = [...$('devices').children];
  Object.entries(NODES).forEach(([id,node],i) => {
    const element = elements[i]; nodeElements.set(id,element);
    element.setAttribute('role','button'); element.setAttribute('tabindex','0'); element.setAttribute('aria-label',`查看 ${node.name} 的地址与角色`); element.dataset.node = id;
    element.addEventListener('click',() => openDevice(id));
    element.addEventListener('keydown',event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openDevice(id); } });
  });
  $('links').innerHTML = LINKS.map(([a,b]) => `<path data-link="${a}-${b}" d="M${NODES[a].x} ${NODES[a].y} L${NODES[b].x} ${NODES[b].y}"/>`).join('');
}
function openDevice(id) {
  const node = NODES[id]; $('device-title').textContent = node.name;
  $('device-info').innerHTML = node.ip ? `<dl class="device-properties"><dt>IP</dt><dd>${node.ip}</dd><dt>掩码</dt><dd>${node.mask}</dd><dt>默认网关</dt><dd>${node.gateway}</dd><dt>地址所属 VLAN</dt><dd>${node.vlan}</dd></dl><p>${escapeHTML(node.role)}</p>` : `<p>${escapeHTML(node.role)}</p><dl class="device-properties">${PLAN.map(row => `<dt>G0/0.${row[1]}</dt><dd>192.168.10${row[4]} · VLAN ${row[1]}</dd>`).join('')}</dl>`;
  $('device-dialog').showModal();
}

function changeScenario() { pause(); state.step = 0; refreshScenario(); }
function setAuthorization(authorized) { state.authorized = authorized; changeScenario(); }
function refreshScenario() {
  journey = buildJourney(requestOptions());
  state.step = Math.min(state.step,journey.length-1);
  $('grant-status').textContent = state.authorized ? (state.fault === 'order' ? 'Student-A 的许可排在拒绝之后，尚不能生效' : 'Student-A 已获得实验网页 TCP 80 许可') : 'Student-A 尚未获得实验网页许可';
  $('grant').disabled = state.authorized; $('revoke').disabled = !state.authorized;
  $('request-summary').textContent = `Student-${state.student} · ${TARGET_NAMES[state.target]} · ${PROTOCOL_NAMES[state.protocol]}`;
  $('comparison').innerHTML = ['A','B'].map(student => {
    const result = evaluateAccess(requestOptions({student,target:'lab',protocol:'http'}));
    return `<article class="comparison-card"><h3>Student-${student} → 实验 HTTP</h3><span class="status-badge ${result.allowed ? 'success' : ''}">${result.allowed ? '成功' : '失败'}</span><p>${escapeHTML(result.reason)}</p></article>`;
  }).join('');
  const result = evaluateAccess(requestOptions());
  $('policy-rows').innerHTML = getPolicyRows(requestOptions()).map(row => `<div class="policy-row ${row.seq === result.rule.seq ? 'match' : ''}"><b>${row.seq}</b><code>${escapeHTML(row.text)}</code><span>${row.seq === result.rule.seq ? '当前首条匹配' : row.action === 'permit' ? '许可' : '拒绝'}</span></div>`).join('');
  $('timeline').innerHTML = journey.map((step,i) => `<button data-step="${i}" aria-label="第 ${i+1} 步：${escapeHTML(step.title)}" title="${escapeHTML(step.title)}"></button>`).join('');
  document.querySelectorAll('[data-step]').forEach(button => button.addEventListener('click',() => { pause(); state.step = Number(button.dataset.step); renderStep(); }));
  $('current-result').className = `current-result ${result.allowed ? 'success' : result.networkAllowed ? 'warning' : ''}`;
  $('current-result').innerHTML = `<b>当前结果：${escapeHTML(statusLabel(result))}</b><p>${escapeHTML(result.reason)}</p>`;
  renderStep();
}

function renderStep() {
  const step = journey[state.step];
  $('step-phase').textContent = `第 ${state.step+1} / ${journey.length} 步 · ${step.phase === 'reply' ? '回程' : step.phase === 'failure' ? '失败定位' : '请求与检查'}`;
  $('step-title').textContent = step.title; $('step-description').textContent = step.description; $('step-detail').textContent = step.detail;
  $('previous').disabled = state.step === 0; $('next').disabled = state.step === journey.length-1;
  document.querySelectorAll('[data-step]').forEach(button => {
    const index = Number(button.dataset.step); button.classList.toggle('current',index === state.step); button.classList.toggle('past',index < state.step);
    if (index === state.step) button.setAttribute('aria-current','step'); else button.removeAttribute('aria-current');
  });
  nodeElements.forEach((element,id) => element.classList.toggle('active',step.path.includes(id)));
  document.querySelectorAll('[data-link]').forEach(link => {
    const [a,b] = link.dataset.link.split('-');
    const active = step.path.some((id,i) => i < step.path.length-1 && ((id === a && step.path[i+1] === b) || (id === b && step.path[i+1] === a)));
    link.style.stroke = active ? (step.phase === 'reply' ? '#347bc4' : '#21895c') : '#b1c2c7'; link.style.strokeWidth = active ? '5' : '3';
  });
  animatePacket(step);
}
function animatePacket(step) {
  cancelAnimationFrame(animationFrame); const generation = ++animationGeneration;
  const packet = $('packet'); packet.hidden = false; packet.removeAttribute('hidden');
  const circle = packet.querySelector('circle'); circle.setAttribute('fill',step.phase === 'failure' ? '#b2443c' : step.phase === 'reply' ? '#347bc4' : '#21895c');
  const points = step.path.map(id => NODES[id]);
  const move = (x,y) => packet.setAttribute('transform',`translate(${x} ${y})`);
  move(points[0].x,points[0].y);
  if (points.length === 1 || reducedMotion.matches) { const end = points[points.length-1]; move(end.x,end.y); return; }
  let start;
  const duration = 720 / state.speed, segments = points.length-1;
  function frame(time) {
    if (generation !== animationGeneration) return;
    start ??= time;
    const progress = Math.min((time-start)/duration,segments), index = Math.min(Math.floor(progress),segments-1), fraction = progress-index;
    move(points[index].x+(points[index+1].x-points[index].x)*fraction,points[index].y+(points[index+1].y-points[index].y)*fraction);
    if (progress < segments) animationFrame = requestAnimationFrame(frame);
  }
  animationFrame = requestAnimationFrame(frame);
}
function pause() { clearTimeout(timer); state.playing = false; $('play').textContent = '播放动画'; }
function scheduleNext() {
  clearTimeout(timer);
  const delay = Math.max(5000,(journey[state.step].path.length-1)*720+2400)/state.speed;
  timer = setTimeout(() => { if (!state.playing) return; if (state.step === journey.length-1) { pause(); return; } state.step++; renderStep(); scheduleNext(); },delay);
}
function play() {
  if (state.playing) { pause(); cancelAnimationFrame(animationFrame); animationGeneration++; return; }
  if (state.step === journey.length-1) state.step = 0;
  state.playing = true; $('play').textContent = '暂停动画'; renderStep(); scheduleNext();
}
function advanceStep(delta) { pause(); state.step = Math.max(0,Math.min(journey.length-1,state.step+delta)); renderStep(); }

function registerTeachingTools() {
  // Optional browser agent access to the same local teaching simulation, never real networking.
  const context = document.modelContext;
  if (!context?.registerTool) return;
  const lifecycle = new AbortController();
  window.addEventListener('pagehide',() => lifecycle.abort(),{once:true});
  const register = tool => {
    try { Promise.resolve(context.registerTool(tool,{signal:lifecycle.signal})).catch(() => {}); } catch { /* UI remains available in unsupported implementations. */ }
  };
  register({name:'read_campus_lesson',title:'读取校园课堂状态',description:'Read the selected lesson and access result of this educational simulation. Does not query Packet Tracer or real devices.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:false},execute(input){ if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length) throw new TypeError('Expected an empty object.'); return {lesson:CAMPUS_LESSONS[state.lesson].id,view:state.view,scenario:requestOptions(),result:evaluateAccess(requestOptions())}; }});
  register({name:'configure_campus_demo',title:'设置校园授权教学演示',description:'Configure the visible, local educational simulation and open its animation tab. Grant/revoke affects only simulated Student-A HTTP access; it never changes real network permissions.',inputSchema:{type:'object',properties:{student:{type:'string',enum:['A','B']},target:{type:'string',enum:['public','lab','teacher','management']},protocol:{type:'string',enum:['http','icmp','ssh']},authorized:{type:'boolean'},fault:{type:'string',enum:['none','order','http_off','trunk']}},required:['student','target','protocol','authorized','fault'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute(input){ if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).sort().join(',') !== 'authorized,fault,protocol,student,target') throw new TypeError('Expected exactly five scenario properties.'); evaluateAccess(input); Object.assign(state,input); ['student','target','protocol','fault'].forEach(key => $(key).value = state[key]); changeScenario(); setView('demo'); return {scenario:requestOptions(),result:evaluateAccess(requestOptions())}; }});
}

$('lesson-nav').innerHTML = CAMPUS_LESSONS.map((lesson,index) => `<button class="lesson-button" data-lesson="${index}"><span>${lesson.number}</span><div>${escapeHTML(lesson.id === 'zones' ? '校园分区' : lesson.id === 'address' ? '分配地址' : lesson.id === 'vlan' ? 'VLAN 与路由' : lesson.id === 'acl' ? 'ACL 访问规则' : lesson.id === 'grant' ? '授权与撤销' : '故障排查')}<small>${escapeHTML(lesson.subtitle)}</small></div></button>`).join('');
document.querySelectorAll('[data-lesson]').forEach(button => button.addEventListener('click',() => selectLesson(Number(button.dataset.lesson))));
document.querySelectorAll('[data-view]').forEach(button => { button.addEventListener('click',() => setView(button.dataset.view)); button.addEventListener('keydown',event => { const tabs = ['learn','demo','lab','quiz']; let index = tabs.indexOf(state.view); if (event.key === 'ArrowRight') index = (index+1)%4; else if (event.key === 'ArrowLeft') index = (index+3)%4; else if (event.key === 'Home') index = 0; else if (event.key === 'End') index = 3; else return; event.preventDefault(); setView(tabs[index],true); }); });
['student','target','protocol','fault'].forEach(key => $(key).addEventListener('change',() => { state[key] = $(key).value; changeScenario(); }));
$('grant').addEventListener('click',() => setAuthorization(true)); $('revoke').addEventListener('click',() => setAuthorization(false));
$('play').addEventListener('click',play); $('previous').addEventListener('click',() => advanceStep(-1)); $('next').addEventListener('click',() => advanceStep(1)); $('reset').addEventListener('click',() => { pause(); state.step = 0; renderStep(); });
$('speed').addEventListener('change',() => { state.speed = Number($('speed').value); renderStep(); if (state.playing) scheduleNext(); });
$('previous-lesson').addEventListener('click',() => selectLesson(state.lesson-1)); $('next-lesson').addEventListener('click',() => selectLesson(state.lesson+1));
$('presentation').addEventListener('click',() => { state.presentation = !state.presentation; document.body.classList.toggle('presentation',state.presentation); $('presentation').setAttribute('aria-pressed',String(state.presentation)); $('presentation').textContent = state.presentation ? '退出演示模式' : '进入演示模式'; });
$('close-device').addEventListener('click',() => $('device-dialog').close());
document.addEventListener('keydown',event => { if (state.view !== 'demo' || $('device-dialog').open || /INPUT|SELECT|TEXTAREA|BUTTON|A|SUMMARY/.test(event.target.tagName)) return; if (event.key === ' ') { event.preventDefault(); play(); } else if (event.key === 'ArrowRight') advanceStep(1); else if (event.key === 'ArrowLeft') advanceStep(-1); });
window.addEventListener('pagehide',() => { pause(); cancelAnimationFrame(animationFrame); });
prepareTopology(); selectLesson(0); setView('demo'); refreshScenario(); registerTeachingTools();
