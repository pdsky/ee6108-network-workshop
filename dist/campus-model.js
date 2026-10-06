/**
 * Bounded classroom model for the campus access-control lesson.
 * It does not configure a device or implement a real network stack.
 * Student identity here is a fixed source IP, not an authenticated person.
 *
 * `networkAllowed` means the first matching inbound ACL rule permits a packet.
 * A permitted packet can still fail because a trunk or HTTP service is broken.
 * Paths intentionally show CORE twice for router-on-a-stick inter-VLAN traffic.
 */

const BASE = '192.168.10.';
const SOURCES = Object.freeze({ A: 'SA', B: 'SB' });
const TARGETS = Object.freeze({ public: 'PUB', lab: 'LAB', teacher: 'TA', management: 'AUTH' });
const IPS = Object.freeze({ SA: `${BASE}11`, SB: `${BASE}12`, PUB: `${BASE}100`, LAB: `${BASE}101`, TA: `${BASE}66`, AUTH: `${BASE}114` });
const VLAN = Object.freeze({ public: 30, lab: 30, teacher: 20, management: 99 });
const NAMES = Object.freeze({ public: '公共教学网站', lab: '受限实验网站', teacher: '教师电脑', management: '管理区 AUTH-PC' });
const PROTOCOLS = Object.freeze({ http: 'HTTP / TCP 80', icmp: 'ICMP Echo（ping）', ssh: 'SSH / TCP 22' });
const VALID_FAULTS = Object.freeze(['none', 'order', 'http_off', 'trunk']);

function row(seq, text, action, explanation, match) {
  return Object.freeze({ seq, text, action, explanation, match: Object.freeze(match) });
}

/** Baseline: no student is authorized for the lab website. */
export const POLICY_ROWS = Object.freeze([
  row(10, 'permit tcp 192.168.10.0 0.0.0.63 host 192.168.10.100 eq 80', 'permit', '学生可访问公共教学网站的 HTTP 服务。', { target: 'public', protocol: 'http' }),
  row(20, 'permit icmp 192.168.10.0 0.0.0.63 host 192.168.10.1 echo', 'permit', '学生可 ping 自己的网关；此规则不会放行到服务器的 ping。', { target: 'gateway', protocol: 'icmp' }),
  row(70, 'deny ip any 192.168.10.64 0.0.0.31', 'deny', '学生不能访问教师 VLAN 20。', { target: 'teacher' }),
  row(80, 'deny ip any 192.168.10.112 0.0.0.15', 'deny', '学生不能访问管理 VLAN 99。设备 VTY 仍应另设来源限制。', { target: 'management' }),
  row(90, 'deny ip any any', 'deny', '拒绝其他未明确放行的学生跨 VLAN 流量。', {}),
]);

/** UI may use this to display the precise list that evaluateAccess evaluates. */
export function getPolicyRows({ authorized = false, fault = 'none' } = {}) {
  const rules = [...POLICY_ROWS];
  if (authorized) {
    rules.push(row(fault === 'order' ? 95 : 30,
      'permit tcp host 192.168.10.11 host 192.168.10.101 eq 80',
      'permit', '只允许 Student-A 访问实验网站 TCP 80；不放行 ping、SSH 或 Student-B。',
      { student: 'A', target: 'lab', protocol: 'http' }));
  }
  return rules.sort((a, b) => a.seq - b.seq);
}

export const activePolicyRows = getPolicyRows;

function normalize(options = {}) {
  const normalized = {
    student: options.student ?? 'A',
    target: options.target ?? 'lab',
    protocol: options.protocol ?? 'http',
    authorized: options.authorized ?? false,
    fault: options.fault ?? 'none',
  };
  if (!Object.hasOwn(SOURCES, normalized.student)) throw new TypeError('student 必须是 A 或 B。');
  if (!Object.hasOwn(TARGETS, normalized.target)) throw new TypeError('target 必须是 public、lab、teacher 或 management。');
  if (!Object.hasOwn(PROTOCOLS, normalized.protocol)) throw new TypeError('protocol 必须是 http、icmp 或 ssh。');
  if (typeof normalized.authorized !== 'boolean') throw new TypeError('authorized 必须是布尔值。');
  if (!VALID_FAULTS.includes(normalized.fault)) throw new TypeError('fault 必须是 none、order、http_off 或 trunk。');
  return normalized;
}

function matchingRule(options) {
  return getPolicyRows(options).find((rule) =>
    Object.entries(rule.match).every(([field, value]) => options[field] === value));
}

function requestPath(source, target) {
  const start = [source, 'SS', 'CORE', 'R1', 'CORE'];
  return target === 'teacher' ? [...start, 'TS', 'TA'] : [...start, TARGETS[target]];
}

/**
 * Evaluate one new request. This is stateless ACL matching, not session auth.
 * `authorized` grants only A -> LAB HTTP, independent of selected student.
 * The HTTP-off challenge disables the website selected as the target.
 */
export function evaluateAccess(options = {}) {
  const input = normalize(options);
  const source = SOURCES[input.student];
  const matched = matchingRule(input);
  const networkAllowed = matched.action === 'permit';
  const websiteTarget = input.target === 'public' || input.target === 'lab';
  const connectivityAvailable = !(input.fault === 'trunk' && websiteTarget);
  const serviceAvailable = !(input.fault === 'http_off' && websiteTarget && input.protocol === 'http');
  const rule = Object.freeze({ seq: matched.seq, text: matched.text });
  const start = [source, 'SS', 'CORE', 'R1'];
  const common = { networkAllowed, connectivityAvailable, serviceAvailable, rule };

  if (!networkAllowed) {
    let reason = `R1 学生 VLAN 子接口的入方向 ACL 首先匹配第 ${rule.seq} 条 deny，请求在 R1 被丢弃。`;
    if (input.target === 'lab' && input.student === 'A' && input.authorized && input.fault === 'order' && input.protocol === 'http') {
      reason += '授权许可放在第 95 条；第 90 条已先拒绝，因此第 95 条不会被执行。';
    } else if (input.target === 'lab' && input.protocol !== 'http' && input.authorized) {
      reason += '授权只针对 HTTP / TCP 80，不包含 ping 或 SSH。';
    } else if (input.target === 'lab' && input.student === 'B' && input.authorized) {
      reason += '授权只针对源 IP 192.168.10.11；Student-B 的 .12 不匹配。';
    }
    return { ...common, allowed: false, reason, path: start, phase: 'acl_denied' };
  }

  if (!connectivityAvailable) {
    return { ...common, allowed: false,
      reason: `第 ${rule.seq} 条 ACL 已允许请求，但 R1 到 CORE 的 trunk 未允许 VLAN 30；报文无法送到服务器 VLAN。这是路径故障，不能解释成 ACL 拒绝。`,
      path: [...start, 'CORE'], phase: 'link_failure' };
  }

  if (!serviceAvailable) {
    return { ...common, allowed: false,
      reason: `第 ${rule.seq} 条 ACL 允许 HTTP，路径也可达；${NAMES[input.target]}的 HTTP 服务关闭，因此不能得到网页响应。`,
      path: requestPath(source, input.target), phase: 'service_failure' };
  }

  return { ...common, allowed: true,
    reason: `第 ${rule.seq} 条 ACL 允许 ${PROTOCOLS[input.protocol]}；服务器 HTTP 服务开启，请求与响应可完成。`,
    path: requestPath(source, input.target), phase: 'success' };
}

/**
 * Teaching storyboard, not a full ARP/TCP/IP simulation.
 * ARP/neighbour caches are assumed ready after the first explanation.
 * MAC headers change at R1 while normal end-to-end source/destination IPs stay.
 */
export function buildJourney(options = {}) {
  const input = normalize(options);
  const result = evaluateAccess(input);
  const source = SOURCES[input.student];
  const target = TARGETS[input.target];
  const sourceIP = IPS[source];
  const targetIP = IPS[target];
  const steps = [
    {
      title: '先判断：目的地在另一个 VLAN',
      description: `Student-${input.student}（${sourceIP}/26）要访问 ${NAMES[input.target]}（${targetIP}）。目的地址不在学生子网，先交给默认网关 192.168.10.1。`,
      path: [source], phase: 'check',
      detail: '主机先用 ARP 获得网关 MAC。本动画只解释这一点，后续假设 ARP 缓存已就绪；不逐个播放 ARP、TCP 握手或重传。源 IP 只是地址，并不能证明学生的真实身份。',
    },
    {
      title: '交换机把帧送到网关',
      description: '学生接入交换机 SS 把 VLAN 10 的以太网帧送到 CORE，再经 trunk 交给 R1 的 VLAN 10 子接口。交换机按目的 MAC 转发。',
      path: [source, 'SS', 'CORE', 'R1'], phase: 'request',
      detail: `帧的目的 MAC 是网关的 MAC；IP 目的地址仍是 ${targetIP}。单臂路由中 CORE → R1 与 R1 → CORE 使用同一条物理 trunk 的不同 VLAN。`,
    },
    {
      title: '在 R1 检查第一条匹配的 ACL',
      description: `学生流量进入 R1 时，STUDENT_POLICY 按序号从小到大检查。当前首条匹配规则是第 ${result.rule.seq} 条。`,
      path: ['R1'], phase: 'check',
      detail: `${result.rule.seq} ${result.rule.text}${input.authorized && input.fault === 'order' ? '\n授权许可在第 95 条，前面的 deny 可能已结束检查。' : '\n第一条匹配即决定结果，不会继续寻找更后面的 permit。'}`,
    },
  ];

  if (result.phase === 'acl_denied') {
    steps.push({ title: '请求在 R1 被拒绝', description: result.reason, path: ['R1'], phase: 'failure',
      detail: '请求未到达目标设备，因此不会出现服务器的成功响应。检查源地址、目标地址、协议与 ACL 顺序；不要用放行所有流量来修复。' });
    return steps;
  }

  if (result.phase === 'link_failure') {
    steps.push({ title: 'ACL 许可后，路径仍然可能中断', description: result.reason,
      path: ['R1', 'CORE'], phase: 'failure',
      detail: '许可结果保持为 permit；故障位于 R1—CORE trunk 的 VLAN 30 允许列表。检查 show interfaces trunk 与子接口状态，恢复 VLAN 30 后再重测。' });
    return steps;
  }

  steps.push({ title: `R1 转发到 VLAN ${VLAN[input.target]}`,
    description: `ACL 已允许请求。R1 查询直连路由，重新封装目标 VLAN 的帧，经 CORE 送到${NAMES[input.target]}。`,
    path: ['R1', 'CORE', ...(input.target === 'teacher' ? ['TS', 'TA'] : [target])], phase: 'request',
    detail: `IP 源/目的仍为 ${sourceIP} → ${targetIP}；R1 修改链路层 MAC 封装并递减 TTL。这些 VLAN 都直连 R1，核心方案不需要静态路由。` });

  if (result.phase === 'service_failure') {
    steps.push({ title: '到了服务器，却没有 HTTP 服务', description: result.reason, path: [target], phase: 'failure',
      detail: '网络许可不等于应用正在运行。在 Packet Tracer 的 Server → Services → HTTP 中恢复 HTTP，再用 PC 浏览器访问。ping 无法代替网页验证。' });
    return steps;
  }

  steps.push({ title: 'HTTP 服务器处理访问请求',
    description: `${NAMES[input.target]} HTTP 服务开启，生成网页响应。访问许可是指定源 IP 到指定服务的网络规则。`,
    path: [target], phase: 'check',
    detail: '课堂动画用一个请求和一个响应代表网页访问，没有逐项模拟 TCP 握手、ACK、重传与所有分段。' });
  steps.push({ title: '响应按回程路径返回学生电脑',
    description: '服务器把跨 VLAN 响应交给自己的网关；R1 再经学生 VLAN 送回原来的学生电脑。',
    path: [...result.path].reverse(), phase: 'reply',
    detail: `响应 IP 为 ${targetIP} → ${sourceIP}。学生 ACL 只应用于 VLAN 10 子接口入方向；这次响应从服务器 VLAN 进入 R1，不会再次经过该入方向规则。` });
  steps.push({ title: '这次新访问成功', description: result.reason, path: [source], phase: 'success',
    detail: input.target === 'lab'
      ? '再试 Student-B 或切换到 ping，结果仍应被拒绝。撤销授权后发起新的 HTTP 请求验证；已缓存或已下载的网页不会自动消失。'
      : '公共网站是基线许可。即使没有实验网站授权，学生也能访问它；教师区和管理区仍保持隔离。' });
  return steps;
}
