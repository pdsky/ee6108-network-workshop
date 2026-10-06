/**
 * Bounded classroom model of source-VLAN inbound ACLs and HTTP website access.
 * An actor denotes a fixed source IP, not an authenticated person. This module
 * does not configure devices or simulate a complete ARP/TCP/IP stack.
 *
 * `networkAllowed` is only the first matching ACL decision. Link and service
 * availability are separate facts; an ACL denial always stops the journey at R1.
 * ARP caches are assumed ready, and one HTTP request/reply represents a whole
 * website visit. CORE appears twice because this is router-on-a-stick routing.
 */

const BASE = '192.168.10.';
const ACTORS = Object.freeze({
  SA: Object.freeze({ name: 'Student-A', ip: `${BASE}11`, vlan: 10, prefix: 26, gateway: `${BASE}1`, subnet: `${BASE}0`, wildcard: '0.0.0.63', accessSwitch: 'SS', policyName: 'STUDENT_POLICY' }),
  SB: Object.freeze({ name: 'Student-B', ip: `${BASE}12`, vlan: 10, prefix: 26, gateway: `${BASE}1`, subnet: `${BASE}0`, wildcard: '0.0.0.63', accessSwitch: 'SS', policyName: 'STUDENT_POLICY' }),
  TA: Object.freeze({ name: '教师 TA', ip: `${BASE}66`, vlan: 20, prefix: 27, gateway: `${BASE}65`, subnet: `${BASE}64`, wildcard: '0.0.0.31', accessSwitch: 'TS', policyName: 'TEACHER_POLICY' }),
  G1: Object.freeze({ name: '访客 G1', ip: `${BASE}130`, vlan: 40, prefix: 27, gateway: `${BASE}129`, subnet: `${BASE}128`, wildcard: '0.0.0.31', accessSwitch: 'GS', policyName: 'GUEST_POLICY' }),
});
const TARGETS = Object.freeze({
  public: Object.freeze({ node: 'PUB', name: '公共教学网站', ip: `${BASE}100`, vlan: 30, gateway: `${BASE}97`, website: true }),
  course: Object.freeze({ node: 'COURSE', name: '课程网站', ip: `${BASE}102`, vlan: 30, gateway: `${BASE}97`, website: true }),
  lab: Object.freeze({ node: 'LAB', name: '受限实验网站', ip: `${BASE}101`, vlan: 30, gateway: `${BASE}97`, website: true }),
  teacher: Object.freeze({ node: 'TA', name: '教师电脑 TA', ip: `${BASE}66`, vlan: 20, gateway: `${BASE}65`, website: false }),
  management: Object.freeze({ node: 'AUTH', name: '管理区 AUTH-PC', ip: `${BASE}114`, vlan: 99, gateway: `${BASE}113`, website: false }),
});
const PROTOCOLS = Object.freeze({ http: 'HTTP / TCP 80', icmp: 'ICMP Echo（ping）', ssh: 'SSH / TCP 22' });
const FAULTS = Object.freeze(['none', 'order', 'http_off', 'trunk']);
const GRANT_ACTORS = Object.freeze(['SA', 'SB', 'G1']);
const GRANT_TARGETS = Object.freeze(['course', 'lab']);

/** Each call returns independent, mutable per-actor and per-website state. */
export function createGrants() {
  return { SA: { course: false, lab: false }, SB: { course: false, lab: false }, G1: { course: false, lab: false } };
}

function normalizePolicy(options = {}) {
  if (options === null || typeof options !== 'object' || Array.isArray(options)) throw new TypeError('options 必须是对象。');
  const actor = options.actor ?? 'SA';
  const fault = options.fault ?? 'none';
  const grants = options.grants ?? createGrants();
  if (typeof actor !== 'string' || !Object.hasOwn(ACTORS, actor)) throw new TypeError('actor 必须是 SA、SB、TA 或 G1。');
  if (!FAULTS.includes(fault)) throw new TypeError('fault 必须是 none、order、http_off 或 trunk。');
  if (grants === null || typeof grants !== 'object' || Array.isArray(grants)) throw new TypeError('grants 必须是 createGrants() 所定义的授权对象。');
  for (const key of GRANT_ACTORS) {
    if (!Object.hasOwn(grants, key) || grants[key] === null || typeof grants[key] !== 'object' || Array.isArray(grants[key])) {
      throw new TypeError(`grants.${key} 必须包含 course 和 lab 布尔值。`);
    }
    for (const target of GRANT_TARGETS) {
      if (!Object.hasOwn(grants[key], target) || typeof grants[key][target] !== 'boolean') {
        throw new TypeError(`grants.${key}.${target} 必须是布尔值。`);
      }
    }
  }
  return { actor, fault, grants };
}

function normalize(options = {}) {
  const normalized = normalizePolicy(options);
  const target = options.target ?? 'course';
  const protocol = options.protocol ?? 'http';
  if (typeof target !== 'string' || !Object.hasOwn(TARGETS, target)) throw new TypeError('target 必须是 public、course、lab、teacher 或 management。');
  if (typeof protocol !== 'string' || !Object.hasOwn(PROTOCOLS, protocol)) throw new TypeError('protocol 必须是 http、icmp 或 ssh。');
  const faultTarget = options.faultTarget ?? (TARGETS[target].website ? target : 'lab');
  if (!['public', 'course', 'lab'].includes(faultTarget)) throw new TypeError('faultTarget 必须是 public、course 或 lab。');
  if (normalized.actor === 'TA' && !TARGETS[target].website) {
    throw new TypeError('教师 TA 仅演示三个 HTTP 网站；teacher 和 management 诊断目标不适用，不假设同 VLAN 流量经过 R1。');
  }
  return { ...normalized, target, protocol, faultTarget };
}

function row(seq, text, action, explanation, match = {}) {
  return Object.freeze({ seq, text, action, explanation, match: Object.freeze(match) });
}

function websitePermit(seq, source, target, explanation) {
  return row(seq, `permit tcp ${source.subnet} ${source.wildcard} host ${TARGETS[target].ip} eq 80`, 'permit', explanation, { target, protocol: 'http' });
}

function grantPermit(actor, target, seq) {
  return row(seq, `permit tcp host ${ACTORS[actor].ip} host ${TARGETS[target].ip} eq 80`, 'permit',
    `只允许 ${ACTORS[actor].name} 的源 IP ${ACTORS[actor].ip} 访问${TARGETS[target].name}的 TCP 80；不授权其他来源、网站、ping 或 SSH。`,
    { actor, target, protocol: 'http' });
}

/** Return exactly the source policy evaluated for this actor, in ACL order. */
export function getPolicyRows(options = {}) {
  const input = normalizePolicy(options);
  const source = ACTORS[input.actor];
  const teacher = input.actor === 'TA';
  const guest = input.actor === 'G1';
  const rules = [websitePermit(10, source, 'public', `${teacher ? '教师' : guest ? '访客' : '学生'}子网可访问公共教学网站的 HTTP 服务。`)];
  if (teacher) {
    rules.push(websitePermit(11, source, 'course', '教师子网默认可访问课程网站的 HTTP 服务，无需学生或访客授权。'));
    rules.push(websitePermit(12, source, 'lab', '教师子网默认可访问实验网站的 HTTP 服务，无需学生或访客授权。'));
  }
  rules.push(row(20, `permit icmp ${source.subnet} ${source.wildcard} host ${source.gateway} echo`, 'permit',
    `只放行本子网到自身网关 ${source.gateway} 的 ICMP Echo；不会放行服务器的 ping。`, { target: 'gateway', protocol: 'icmp' }));

  if (!teacher) {
    const assignments = guest
      ? [['G1', 'course', 30, 95], ['G1', 'lab', 31, 96]]
      : [['SA', 'course', 30, 95], ['SA', 'lab', 31, 96], ['SB', 'course', 40, 97], ['SB', 'lab', 41, 98]];
    for (const [actor, target, seq, faultySeq] of assignments) {
      if (input.grants[actor][target]) rules.push(grantPermit(actor, target, input.fault === 'order' ? faultySeq : seq));
    }
  }

  rules.push(row(70, teacher ? `deny ip any ${BASE}0 0.0.0.63` : `deny ip any ${BASE}64 0.0.0.31`, 'deny',
    teacher ? '教师不能访问学生 VLAN 10。' : '学生和访客不能访问教师 VLAN 20。', { target: teacher ? 'student' : 'teacher' }));
  rules.push(row(75, guest ? `deny ip any ${BASE}0 0.0.0.63` : `deny ip any ${BASE}128 0.0.0.31`, 'deny',
    guest ? '访客不能访问学生 VLAN 10。' : '学生和教师不能访问访客 VLAN 40。', { target: guest ? 'student' : 'guest' }));
  rules.push(row(80, `deny ip any ${BASE}112 0.0.0.15`, 'deny', '禁止访问管理 VLAN 99；设备 VTY 还应单独限制管理来源。', { target: 'management' }));
  rules.push(row(90, 'deny ip any any', 'deny', '拒绝其他没有明确许可的跨 VLAN 流量。'));
  return rules.sort((a, b) => a.seq - b.seq);
}

function requestPath(actor, target) {
  const start = [actor, ACTORS[actor].accessSwitch, 'CORE', 'R1', 'CORE'];
  return target === 'teacher' ? [...start, 'TS', 'TA'] : [...start, TARGETS[target].node];
}

/**
 * Evaluate a new request; no sessions, identity authentication or persistent
 * browser caches are simulated. TA has website baselines and no grant state.
 * faultTarget fixes which site's HTTP service is down across a comparison table.
 */
export function evaluateAccess(options = {}) {
  const input = normalize(options);
  const source = ACTORS[input.actor];
  const target = TARGETS[input.target];
  const matched = getPolicyRows(input).find(rule => Object.entries(rule.match).every(([field, value]) => input[field] === value));
  const networkAllowed = matched.action === 'permit';
  const connectivityAvailable = !(input.fault === 'trunk' && target.website);
  const serviceAvailable = !(input.fault === 'http_off' && input.target === input.faultTarget && input.protocol === 'http');
  const rule = Object.freeze({ seq: matched.seq, text: matched.text });
  const common = { networkAllowed, connectivityAvailable, serviceAvailable, rule, policyName: source.policyName };
  const start = [input.actor, source.accessSwitch, 'CORE', 'R1'];

  if (!networkAllowed) {
    let reason = `R1 的 VLAN ${source.vlan} 子接口入方向 ${source.policyName} 首先匹配第 ${rule.seq} 条 deny，请求在 R1 被丢弃。`;
    if (GRANT_TARGETS.includes(input.target) && input.actor !== 'TA' && input.grants[input.actor][input.target] && input.protocol === 'http' && input.fault === 'order') {
      const lateRule = getPolicyRows(input).find(candidate => candidate.action === 'permit' && candidate.match.actor === input.actor && candidate.match.target === input.target);
      reason += `本来源、本网站的授权许可位于第 ${lateRule.seq} 条，但第 90 条已经结束检查，后面的 permit 不会执行。`;
    } else if (target.website && input.protocol !== 'http') {
      reason += '网站许可只覆盖 HTTP / TCP 80，不包含服务器的 ping 或 SSH；网站授权不会放行其他协议。';
    } else if (GRANT_TARGETS.includes(input.target) && input.actor !== 'TA') {
      reason += `${source.name} 尚未获得${target.name}的 HTTP 授权；其他来源或另一个网站的授权不适用于这次请求。`;
    }
    return { ...common, allowed: false, reason, path: start, phase: 'acl_denied' };
  }
  if (!connectivityAvailable) {
    return { ...common, allowed: false,
      reason: `第 ${rule.seq} 条 ACL 已许可，但 R1—CORE trunk 遗漏 VLAN 30，无法把请求送到服务器 VLAN；这是链路配置故障。`,
      path: [...start, 'CORE'], phase: 'link_failure' };
  }
  if (!serviceAvailable) {
    return { ...common, allowed: false,
      reason: `第 ${rule.seq} 条 ACL 许可 HTTP，路径也可达；当前选中的${target.name} HTTP 服务关闭，因此没有网页响应。`,
      path: requestPath(input.actor, input.target), phase: 'service_failure' };
  }
  return { ...common, allowed: true,
    reason: `第 ${rule.seq} 条 ${source.policyName} 许可 ${PROTOCOLS[input.protocol]}；${target.name}服务开启，请求和响应可以完成。`,
    path: requestPath(input.actor, input.target), phase: 'success' };
}

/** Explain the evaluated request, stopping at its actual point of failure. */
export function buildJourney(options = {}) {
  const input = normalize(options);
  const result = evaluateAccess(input);
  const source = ACTORS[input.actor];
  const target = TARGETS[input.target];
  const steps = [
    {
      title: '先判断：目的地在另一个 VLAN',
      description: `${source.name}（${source.ip}/${source.prefix}）访问${target.name}（${target.ip}）。目的地址不在本地子网，先交给默认网关 ${source.gateway}。`,
      path: [input.actor], phase: 'check',
      detail: '本教学模型假设 ARP 缓存已就绪：主机已知道网关 MAC，路由器已知道目的设备 MAC。源 IP 是网络地址，不能证明真实身份；动画不会逐个模拟 ARP、TCP 握手或重传。',
    },
    {
      title: '交换机把帧送到网关',
      description: `${source.accessSwitch} 把 VLAN ${source.vlan} 的帧送到 CORE，再经 trunk 送入 R1 的 VLAN ${source.vlan} 子接口。交换机按目的 MAC 转发。`,
      path: [input.actor, source.accessSwitch, 'CORE', 'R1'], phase: 'request',
      detail: `帧的目的 MAC 是本子网网关的 MAC；IP 目的地址仍是 ${target.ip}。CORE → R1 与 R1 → CORE 使用同一条物理 trunk、不同 VLAN 的封装。`,
    },
    {
      title: '在 R1 检查第一条匹配的 ACL',
      description: `${result.policyName} 在来源 VLAN ${source.vlan} 的入方向按序号检查，第一条匹配规则是第 ${result.rule.seq} 条。`,
      path: ['R1'], phase: 'check',
      detail: `${result.rule.seq} ${result.rule.text}\n第一条匹配即结束检查，不会继续寻找后面的 permit。授权行只匹配指定来源、指定网站和 TCP 80。`,
    },
  ];

  if (result.phase === 'acl_denied') {
    steps.push({ title: '请求在 R1 被拒绝', description: result.reason, path: ['R1'], phase: 'failure',
      detail: '请求尚未到达目标设备，因此没有目标设备的成功响应。先核对来源、网站、协议和规则顺序；故障挑战不会改变 ACL 首条匹配的含义。' });
    return steps;
  }
  if (result.phase === 'link_failure') {
    steps.push({ title: 'ACL 许可后，路径中断', description: result.reason, path: ['R1', 'CORE'], phase: 'failure',
      detail: 'ACL 结果仍是 permit。检查 R1—CORE trunk 的 VLAN 30 允许列表和子接口状态；恢复 VLAN 30 后再发起一次新的访问。' });
    return steps;
  }

  steps.push({ title: 'R1 转发到服务器 VLAN 30',
    description: `ACL 已许可，R1 查询直连路由并重新封装 VLAN 30 的以太网帧，经 CORE 送到${target.name}。`,
    path: ['R1', 'CORE', target.node], phase: 'request',
    detail: `IP 源／目的保持 ${source.ip} → ${target.ip}；R1 修改链路层 MAC 封装并递减 TTL。这些 VLAN 都直连 R1，无需静态路由。` });
  if (result.phase === 'service_failure') {
    steps.push({ title: '到了服务器，却没有 HTTP 服务', description: result.reason, path: [target.node], phase: 'failure',
      detail: '网络许可不等于应用正在运行。恢复当前网站的 HTTP 服务后，用浏览器重测；服务器 ping 在本策略中仍会被拒绝，不能用它替代网页验证。' });
    return steps;
  }

  steps.push({ title: 'HTTP 服务器生成网页响应',
    description: `${target.name}的 HTTP 服务开启，处理访问请求并生成响应。`,
    path: [target.node], phase: 'check',
    detail: '一组 HTTP 请求／响应代表这次网站访问；动画不逐项模拟 TCP 握手、ACK、重传或全部分段，也不验证真实身份。' });
  steps.push({ title: `响应沿完整回程返回${source.name}`,
    description: `服务器把跨 VLAN 响应交给网关 ${target.gateway}，经 CORE → R1 → CORE，再从 VLAN ${source.vlan} 和 ${source.accessSwitch} 回到 ${input.actor}。`,
    path: [...result.path].reverse(), phase: 'reply',
    detail: `响应 IP 为 ${target.ip} → ${source.ip}。${source.policyName} 只应用于来源 VLAN ${source.vlan} 子接口的入方向；这次响应从 VLAN 30 进入 R1，不会再次经过该入方向 ACL。` });
  steps.push({ title: '这次新访问成功', description: result.reason, path: [input.actor], phase: 'success',
    detail: input.actor === 'TA'
      ? '教师访问三个 HTTP 网站属于基线许可，无需授予课程或实验网站权限；服务器 ping 和 SSH 仍不会放行。'
      : input.target === 'public'
        ? '公共网站 HTTP 是基线许可。课程与实验网站要分别授权，教师区和管理区仍保持隔离。'
        : `此许可只适用于 ${input.actor} → ${target.node} 的 TCP 80。换来源、换网站或换协议后要重新判断；撤销后验证一次新的请求，已经缓存或下载的网页不会自动消失。` });
  return steps;
}
