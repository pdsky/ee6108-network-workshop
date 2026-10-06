import { CAMPUS_LESSONS } from './campus-lessons.js?v=guest-20261006';
import { evaluateAccess, buildJourney, getPolicyRows, createGrants } from './campus-model.js?v=guest-20261006';

const $ = (id) => document.getElementById(id);
const escapeHTML = (value) => String(value).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const state = { lesson: 0, view: 'demo', actor: 'G1', target: 'public', protocol: 'http', grants: createGrants(), grantActor: 'SA', grantWebsite: 'course', fault: 'none', step: 0, speed: 1, playing: false, presentation: false };
const answers = new Map();
let journey = [];
let timer;
let animationFrame;
let animationGeneration = 0;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const TARGET_NAMES = {public:'公开网站',course:'课程网站',lab:'实验网站',teacher:'教师电脑',management:'管理区 AUTH-PC'};
const ACTOR_NAMES = {SA:'学生 A · Student-A',SB:'学生 B · Student-B',TA:'教师 · Teacher-A',G1:'访客 · Guest-1'};
const PROTOCOL_NAMES = {http:'HTTP',icmp:'ping / ICMP',ssh:'SSH'};
const NODES = {
  SA:{x:120,y:125,name:'Student-A',kind:'pc',ip:'192.168.10.11',mask:'255.255.255.192',gateway:'192.168.10.1',vlan:10,role:'学生电脑；课程与实验网站分别授权，按固定源 IP 匹配。'},
  SB:{x:120,y:250,name:'Student-B',kind:'pc',ip:'192.168.10.12',mask:'255.255.255.192',gateway:'192.168.10.1',vlan:10,role:'第二名学生；验证给 A 授权不会自动开放给 B。也可以为 B 设置独立许可。'},
  SS:{x:290,y:187,name:'STU-SW',kind:'switch',ip:'192.168.10.116',mask:'255.255.255.240',gateway:'192.168.10.113',vlan:99,role:'学生接入交换机。Fa0/1、Fa0/2 属于 VLAN 10；G0/1 为 trunk。此地址是管理 SVI，不是学生网关。'},
  G1:{x:120,y:495,name:'Guest-1',kind:'pc',ip:'192.168.10.130',mask:'255.255.255.224',gateway:'192.168.10.129',vlan:40,role:'访客电脑；默认只开放公开网站，教师可分别开放课程或实验 HTTP 服务。'},
  GS:{x:290,y:420,name:'GUEST-SW',kind:'switch',ip:'192.168.10.118',mask:'255.255.255.240',gateway:'192.168.10.113',vlan:99,role:'访客接入交换机。Fa0/1 为 VLAN 40；G0/1 trunk 接 CORE Fa0/5。管理 SVI 属于 VLAN 99。'},
  CORE:{x:520,y:320,name:'CORE-SW',kind:'switch',ip:'192.168.10.115',mask:'255.255.255.240',gateway:'192.168.10.113',vlan:99,role:'核心二层交换机。Fa0/1 到 R1，G0/1、G0/2、Fa0/5 到三个接入交换机，均为 trunk。Fa0/2、Fa0/3、Fa0/6 接三个服务器 VLAN 30；Fa0/4 接 AUTH-PC VLAN 99。'},
  R1:{x:700,y:185,name:'R1',kind:'router',role:'五个 VLAN 的网关；学生 .10、访客 .40、教师 .20 入方向分别使用各自 ACL。AUTH-PC 通过 .113 SSH 管理。跨 VLAN 从 CORE 到 R1 后，再返回 CORE。'},
  TS:{x:945,y:160,name:'TCH-SW',kind:'switch',ip:'192.168.10.117',mask:'255.255.255.240',gateway:'192.168.10.113',vlan:99,role:'教师接入交换机。Fa0/1、Fa0/2 属于 VLAN 20，G0/1 为 trunk；管理 SVI 属于 VLAN 99。'},
  TA:{x:1140,y:105,name:'Teacher-A',kind:'pc',ip:'192.168.10.66',mask:'255.255.255.224',gateway:'192.168.10.65',vlan:20,role:'教师默认能访问公开、课程、实验三个 HTTP 网站。修改设备配置时需使用专用 AUTH-PC，不由这台普通教师电脑 SSH 登录。'},
  TB:{x:1140,y:230,name:'Teacher-B',kind:'pc',ip:'192.168.10.67',mask:'255.255.255.224',gateway:'192.168.10.65',vlan:20,role:'与 Teacher-A 使用相同的三网站政策。教师全网站许可不等于设备管理或学生远程控制权限。'},
  PUB:{x:1100,y:400,name:'PUBLIC-SRV',kind:'server',ip:'192.168.10.100',mask:'255.255.255.240',gateway:'192.168.10.97',vlan:30,label:'公开网站',role:'学校介绍与公开教学资源。学生、教师和访客都能使用 HTTP / TCP 80。'},
  COURSE:{x:1100,y:490,name:'COURSE-SRV',kind:'server',ip:'192.168.10.102',mask:'255.255.255.240',gateway:'192.168.10.97',vlan:30,label:'课程网站',role:'课程讲义和课堂资料。教师默认开放，学生及访客需获得该网站的独立 HTTP 许可。'},
  LAB:{x:1100,y:580,name:'LAB-SRV',kind:'server',ip:'192.168.10.101',mask:'255.255.255.240',gateway:'192.168.10.97',vlan:30,label:'实验网站',role:'受限实验资源。教师默认开放，学生及访客单独申请；课程许可不会同时开放这里。'},
  AUTH:{x:760,y:707,name:'AUTH-PC',kind:'pc',ip:'192.168.10.114',mask:'255.255.255.240',gateway:'192.168.10.113',vlan:99,role:'授权教师使用的专用管理终端。向 R1 .113 发起 SSH 并修改指定学生或访客的指定网站许可；不是 SSH 服务端。'}
};
const PLAN = [
  ['学生区',10,'192.168.10.0/26','255.255.255.192','.1','.11 / .12','62'],
  ['教师区',20,'192.168.10.64/27','255.255.255.224','.65','.66 / .67','30'],
  ['服务器区',30,'192.168.10.96/28','255.255.255.240','.97','.100 / .101 / .102','14'],
  ['管理区',99,'192.168.10.112/28','255.255.255.240','.113','.114–.118','14'],
  ['访客区',40,'192.168.10.128/27','255.255.255.224','.129','.130','30']
];
const nodeElements = new Map();
const LINKS = [['SA','SS'],['SB','SS'],['SS','CORE'],['G1','GS'],['GS','CORE'],['CORE','R1'],['CORE','TS'],['TS','TA'],['TS','TB'],['CORE','PUB'],['CORE','COURSE'],['CORE','LAB'],['CORE','AUTH']];

function requestOptions(extra = {}) { return {actor:state.actor,target:state.target,protocol:state.protocol,grants:state.grants,fault:state.fault,faultTarget:['public','course','lab'].includes(state.target) ? state.target : 'lab',...extra}; }
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
    extra = `<div class="policy-matrix"><h3>三个网站，三类访问者</h3><div class="table-scroll"><table><caption>正常配置下的 HTTP 网站访问政策</caption><thead><tr><th>访问者</th><th>公开网站 .100</th><th>课程网站 .102</th><th>实验网站 .101</th></tr></thead><tbody><tr><th>学生</th><td>默认允许</td><td>单独授权</td><td>单独授权</td></tr><tr><th>教师</th><td>默认允许</td><td>默认允许</td><td>默认允许</td></tr><tr><th>访客 Guest</th><td>默认允许</td><td>单独授权</td><td>单独授权</td></tr></tbody></table></div><p>给 Guest-1 课程网站许可，只改变这台电脑到 .102 的 TCP 80；实验网站、其他电脑和设备管理权限继续按各自规则判断。</p></div>`;
  }
  if (lesson.id === 'address') {
    extra = `<div class="address-exercise"><div><span class="eyebrow">亲自算一算</span><h3>50 台学生电脑，加一个网关，够吗？</h3><p>改动人数和子网大小，比较需要的地址与可用容量。</p></div><div class="capacity-controls"><label>学生电脑数<input id="host-count" type="number" min="1" max="250" value="50"></label><label>子网前缀<select id="prefix"><option value="24">/24</option><option value="25">/25</option><option value="26" selected>/26</option><option value="27">/27</option><option value="28">/28</option><option value="29">/29</option><option value="30">/30</option></select></label><div id="capacity-result" role="status"></div></div></div>${addressTable()}`;
  }
  if (lesson.id === 'vlan') extra = `<div class="route-explanation"><h3>跨 VLAN 时，同一条线走两次</h3><p>学生 → CORE → <b>R1（VLAN 10）</b> → <b>CORE（VLAN 30）</b> → 服务器。R1 与 CORE 共用一根 trunk；去程带 VLAN 10 标签，R1 路由后用 VLAN 30 返回核心交换机。</p><button data-open-demo>用动画看这条路径</button></div>`;
  if (lesson.id === 'acl' || lesson.id === 'grant' || lesson.id === 'trouble') extra = `<div class="route-explanation"><h3>先预测，再动手</h3><p>${lesson.id === 'trouble' ? '先为学生或访客开放一个网站，再加入故障。检查：ACL 是否许可？路径是否连通？所选网站的 HTTP 是否开启？' : '选择授权对象和网站，先预测结果。只给 A 课程许可，再比较 A 的实验网站、B 和访客的课程访问；授权不会自动扩散。'}</p><button data-open-demo>打开动画与授权实验</button></div>`;
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
  $('panel-lab').innerHTML = `<div class="lab-intro"><span class="eyebrow">第 ${lesson.number} 课 · 在 Packet Tracer 中完成</span><h3>${escapeHTML(lesson.subtitle)}</h3><p>按课程顺序搭建同一份实验。以下为参考配置；设备命令与 .pkt 尚需本机预实验。每段只在指定设备输入，遇到报错先核对型号与端口。</p></div><ol class="lab-steps">${lesson.lab.map((step,i) => `<li class="lab-step"><div class="lab-step-heading"><span class="step-number">${i+1}</span><h3>${escapeHTML(step.title)}</h3>${step.command ? `<button class="copy-command" data-command-index="${i}">复制这段命令</button>` : ''}</div><p>${escapeHTML(step.detail)}</p>${step.command ? `<pre tabindex="0"><code>${escapeHTML(step.command)}</code></pre><p class="copy-feedback" id="copy-feedback-${i}" role="status"></p>` : ''}</li>`).join('')}</ol><div class="lab-boundary"><b>实验文件怎么提交？</b><p>在 Packet Tracer 使用 File → Save As 保存 .pkt。提交正确的默认受限、部分网站授权、撤销三种配置，并附访问测试表和截图；网站动画和截图不能代替可打开的 .pkt。具体命名与交付项按老师要求调整。</p></div>`;
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
  $('network').setAttribute('viewBox','0 0 1280 780');
  $('zones').innerHTML = [
    [20,30,345,270,'#edf8ef','学生区 · VLAN 10'],
    [20,380,345,210,'#e8f7fb','访客区 · VLAN 40'],
    [870,30,385,270,'#eef4ff','教师区 · VLAN 20'],
    [870,330,385,285,'#f5efff','三个网站 · VLAN 30'],
    [440,645,815,120,'#fff5df','管理区 · VLAN 99']
  ].map(([x,y,w,h,color,label]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="18" fill="${color}"/><text x="${x+20}" y="${y+30}" class="zone-label">${label}</text>`).join('');
  $('devices').innerHTML = Object.entries(NODES).map(([id,node]) => {
    const width = node.kind === 'server' ? 220 : node.kind === 'switch' ? 144 : 170;
    const caption = node.kind === 'router' ? '五个网关 + ACL' : node.kind === 'switch' ? '交换机' : `.${node.ip.split('.').at(-1)} /${node.vlan === 10 ? '26' : node.vlan === 20 || node.vlan === 40 ? '27' : '28'}${node.kind === 'server' ? ' · HTTP' : ''}`;
    return `<g class="node ${node.kind}" data-node="${id}" transform="translate(${node.x} ${node.y})" role="button" tabindex="0" aria-label="查看 ${escapeHTML(node.name)} 的地址与角色"><rect x="${-width/2}" y="-31" width="${width}" height="62" rx="10"/><text text-anchor="middle" y="-4">${escapeHTML(node.label || node.name)}</text><text class="node-ip" text-anchor="middle" y="21">${escapeHTML(caption)}</text></g>`;
  }).join('');
  document.querySelectorAll('[data-node]').forEach(element => {
    const id = element.dataset.node; nodeElements.set(id,element);
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
function setAuthorization(authorized) { state.grants[state.grantActor][state.grantWebsite] = authorized; changeScenario(); }
function syncActorTargets() {
  ['teacher','management'].forEach(target => {
    const option = $('target').querySelector(`option[value="${target}"]`);
    option.disabled = state.actor === 'TA';
  });
  if (state.actor === 'TA' && ['teacher','management'].includes(state.target)) state.target = 'public';
  $('target').value = state.target;
}
function refreshScenario() {
  syncActorTargets();
  journey = buildJourney(requestOptions());
  state.step = Math.min(state.step,journey.length-1);
  const authorized = state.grants[state.grantActor][state.grantWebsite];
  const who = ACTOR_NAMES[state.grantActor], website = TARGET_NAMES[state.grantWebsite];
  $('grant-status').textContent = authorized ? (state.fault === 'order' ? `${who}：${website}许可排在拒绝之后，尚不能生效` : `${who}：已开放${website} HTTP`) : `${who}：尚未开放${website}`;
  $('grant').disabled = authorized; $('revoke').disabled = !authorized;
  $('grant').textContent = `开放${website}`; $('revoke').textContent = `撤销${website}许可`;
  $('request-summary').textContent = `${ACTOR_NAMES[state.actor]} · ${TARGET_NAMES[state.target]} · ${PROTOCOL_NAMES[state.protocol]}`;
  $('comparison').innerHTML = `<div class="table-scroll"><table class="access-matrix"><caption>三类访问者对照 · 点击结果可重放这次 HTTP 访问</caption><thead><tr><th>访问者</th><th>公开网站 .100</th><th>课程网站 .102</th><th>实验网站 .101</th></tr></thead><tbody>${['SA','SB','TA','G1'].map(actor => `<tr><th>${escapeHTML(ACTOR_NAMES[actor])}</th>${['public','course','lab'].map(target => {
    const result = evaluateAccess(requestOptions({actor,target,protocol:'http'}));
    const status = result.allowed ? '可访问' : result.networkAllowed ? '故障' : '受限';
    return `<td><button class="matrix-result ${result.allowed ? 'success' : result.networkAllowed ? 'warning' : 'denied'}" data-matrix-actor="${actor}" data-matrix-target="${target}" aria-label="${escapeHTML(ACTOR_NAMES[actor])}访问${TARGET_NAMES[target]}：${status}" title="${escapeHTML(result.reason)}">${status}</button></td>`;
  }).join('')}</tr>`).join('')}</tbody></table></div><p class="matrix-note">教师的三个网站默认开放。公开网站对所有人开放；课程与实验授权相互独立。故障挑战下，获许可的请求也可能失败。</p>`;
  document.querySelectorAll('[data-matrix-actor]').forEach(button => button.addEventListener('click',() => {
    state.actor = button.dataset.matrixActor; state.target = button.dataset.matrixTarget; state.protocol = 'http';
    $('actor').value = state.actor; $('target').value = state.target; $('protocol').value = 'http';
    changeScenario();
  }));
  const result = evaluateAccess(requestOptions());
  $('policy-title').textContent = `${result.policyName} · 第一条匹配决定结果`;
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
  register({name:'configure_campus_demo',title:'设置校园访问教学演示',description:'Configure the selected actor, website, protocol and fault in this educational simulation. Does not change grants or real network permissions.',inputSchema:{type:'object',properties:{actor:{type:'string',enum:['SA','SB','TA','G1']},target:{type:'string',enum:['public','course','lab','teacher','management']},protocol:{type:'string',enum:['http','icmp','ssh']},fault:{type:'string',enum:['none','order','http_off','trunk']}},required:['actor','target','protocol','fault'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute(input){
    if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).sort().join(',') !== 'actor,fault,protocol,target') throw new TypeError('Expected exactly four scenario properties.');
    evaluateAccess({...input,grants:state.grants}); Object.assign(state,input);
    ['actor','target','protocol','fault'].forEach(key => $(key).value = state[key]); changeScenario(); setView('demo');
    return {scenario:requestOptions(),result:evaluateAccess(requestOptions())};
  }});
  register({name:'set_campus_website_grant',title:'授予或撤销教学网站许可',description:'Grant or revoke one HTTP website for one student or guest in the visible local teaching simulation. Public and teacher website access remain automatic. Never configures real devices.',inputSchema:{type:'object',properties:{actor:{type:'string',enum:['SA','SB','G1']},website:{type:'string',enum:['course','lab']},allowed:{type:'boolean'}},required:['actor','website','allowed'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute(input){
    if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).sort().join(',') !== 'actor,allowed,website' || !['SA','SB','G1'].includes(input.actor) || !['course','lab'].includes(input.website) || typeof input.allowed !== 'boolean') throw new TypeError('Invalid website grant.');
    state.grantActor = input.actor; state.grantWebsite = input.website; $('grant-actor').value = input.actor; $('grant-website').value = input.website;
    setAuthorization(input.allowed); setView('demo');
    return {actor:input.actor,website:input.website,allowed:state.grants[input.actor][input.website],result:evaluateAccess(requestOptions({actor:input.actor,target:input.website,protocol:'http'}))};
  }});
}

$('lesson-nav').innerHTML = CAMPUS_LESSONS.map((lesson,index) => `<button class="lesson-button" data-lesson="${index}"><span>${lesson.number}</span><div>${escapeHTML(lesson.id === 'zones' ? '校园分区' : lesson.id === 'address' ? '分配地址' : lesson.id === 'vlan' ? 'VLAN 与路由' : lesson.id === 'acl' ? 'ACL 访问规则' : lesson.id === 'grant' ? '授权与撤销' : '故障排查')}<small>${escapeHTML(lesson.subtitle)}</small></div></button>`).join('');
document.querySelectorAll('[data-lesson]').forEach(button => button.addEventListener('click',() => selectLesson(Number(button.dataset.lesson))));
document.querySelectorAll('[data-view]').forEach(button => { button.addEventListener('click',() => setView(button.dataset.view)); button.addEventListener('keydown',event => { const tabs = ['learn','demo','lab','quiz']; let index = tabs.indexOf(state.view); if (event.key === 'ArrowRight') index = (index+1)%4; else if (event.key === 'ArrowLeft') index = (index+3)%4; else if (event.key === 'Home') index = 0; else if (event.key === 'End') index = 3; else return; event.preventDefault(); setView(tabs[index],true); }); });
['actor','target','protocol','fault'].forEach(key => $(key).addEventListener('change',() => { state[key] = $(key).value; changeScenario(); }));
['grant-actor','grant-website'].forEach(key => $(key).addEventListener('change',() => { state[key === 'grant-actor' ? 'grantActor' : 'grantWebsite'] = $(key).value; refreshScenario(); }));
$('grant').addEventListener('click',() => setAuthorization(true)); $('revoke').addEventListener('click',() => setAuthorization(false));
$('play').addEventListener('click',play); $('previous').addEventListener('click',() => advanceStep(-1)); $('next').addEventListener('click',() => advanceStep(1)); $('reset').addEventListener('click',() => { pause(); state.step = 0; renderStep(); });
$('speed').addEventListener('change',() => { state.speed = Number($('speed').value); renderStep(); if (state.playing) scheduleNext(); });
$('previous-lesson').addEventListener('click',() => selectLesson(state.lesson-1)); $('next-lesson').addEventListener('click',() => selectLesson(state.lesson+1));
$('presentation').addEventListener('click',() => { state.presentation = !state.presentation; document.body.classList.toggle('presentation',state.presentation); $('presentation').setAttribute('aria-pressed',String(state.presentation)); $('presentation').textContent = state.presentation ? '退出演示模式' : '进入演示模式'; });
$('close-device').addEventListener('click',() => $('device-dialog').close());
document.addEventListener('keydown',event => { if (state.view !== 'demo' || $('device-dialog').open || /INPUT|SELECT|TEXTAREA|BUTTON|A|SUMMARY/.test(event.target.tagName)) return; if (event.key === ' ') { event.preventDefault(); play(); } else if (event.key === 'ArrowRight') advanceStep(1); else if (event.key === 'ArrowLeft') advanceStep(-1); });
window.addEventListener('pagehide',() => { pause(); cancelAnimationFrame(animationFrame); });
prepareTopology(); selectLesson(0); setView('demo'); refreshScenario(); registerTeachingTools();
