/**
 * Representative packet exchanges for the workshop animation.
 * This is a teaching sequence, not a network simulator. Switches forward
 * Ethernet frames; routers remove/rebuild frames and decrease an IP packet's
 * TTL. We show the first ARP exchange explicitly and assume later required
 * neighbour entries are already cached, except in the deliberate mask fault.
 */

export const SCENARIO_META = {
  same: {
    name: '实验 2 · 同一子网',
    source: 'A1',
    target: 'A2',
    goal: 'A1 与 A2 通过交换机 S1 通信，观察 ARP 和 MAC 地址学习。',
  },
  direct: {
    name: '实验 3 · 两个子网',
    source: 'A1',
    target: 'B1',
    goal: 'A1 经默认网关 R1 到达 B1，理解直连路由与逐跳更换的以太网帧。',
  },
  remote: {
    name: '实验 4 · 跨路由器',
    source: 'A1',
    target: 'C1',
    goal: 'A1 经 R1、R2 到达 C1，检查去程与回程静态路由。',
  },
};

export const FAULT_META = {
  none: {
    label: '正常通信',
    description: '地址、网关和路由配置正确，观察请求与回复的完整往返。',
    fix: '无需修复。先预测路径，再点击播放验证。',
    applicableScenarios: ['same', 'direct', 'remote'],
  },
  gateway: {
    label: 'A1 网关错误',
    description: 'A1 的网关被改成 192.168.10.62。这个地址在 A 区子网内，但没有设备使用它。',
    fix: '把 A1 默认网关改回 192.168.10.1，然后重新 ping。',
    applicableScenarios: ['direct', 'remote'],
  },
  return: {
    label: 'R2 缺少回程路由',
    description: '请求能到达 C1，但 R2 缺少去 A 区 192.168.10.0/26 的路由，回复无法返回。',
    fix: '在 R2 配置：ip route 192.168.10.0 255.255.255.192 192.168.10.113，然后重新 ping。',
    applicableScenarios: ['remote'],
  },
  mask: {
    label: 'C1 掩码错误',
    description: 'C1 的掩码误设为 /24。它会把 A1 的 192.168.10.2 错判为本地地址。',
    fix: '把 C1 掩码改回 255.255.255.240（/28），保留网关 192.168.10.97，再重新 ping。',
    applicableScenarios: ['remote'],
  },
};

const TARGET_IP = {
  same: '192.168.10.3',
  direct: '192.168.10.66',
  remote: '192.168.10.98',
};

const requestIp = (scenario, ttl) =>
  `ICMP 请求：192.168.10.2 → ${TARGET_IP[scenario]} · TTL ${ttl}`;
const replyIp = (scenario, ttl) =>
  `ICMP 回复：${TARGET_IP[scenario]} → 192.168.10.2 · TTL ${ttl}`;

function decisionStep(scenario, unavailableFault = '', fault = 'none') {
  const same = scenario === 'same';
  const badGateway = fault === 'gateway';
  return {
    title: same ? '① 先判断目标是否在本地子网' : badGateway ? '① 目标在另一子网，但 A1 的网关被设错' : '① 目标在另一子网，先找默认网关',
    description: same
      ? 'A1 的地址是 192.168.10.2/26，A2 是 192.168.10.3。两者属于 192.168.10.0/26，A1 直接发送给 A2。'
      : `A1 是 192.168.10.2/26，目标 ${TARGET_IP[scenario]} 不属于 A 区的 192.168.10.0/26。A1 准备将以太网帧交给${badGateway ? '误设的网关 192.168.10.62' : '网关 192.168.10.1'}。`,
    path: ['A1'],
    protocol: '检查',
    phase: 'request',
    layer2: '准备查找下一跳 MAC 地址',
    layer3: `原始目标 IP：${TARGET_IP[scenario]}`,
    focus: 'A1',
    note: `${unavailableFault ? `${unavailableFault} 本次播放正常路径。` : ''}这是教学动画；MAC 用设备标签表示。示例初始 TTL 为 64。首个 ARP 显式演示，后续所需邻居 MAC 假定已缓存。`,
  };
}

function arpSteps(scenario, gatewayFault = false) {
  const local = scenario === 'same';
  const neighbour = local ? 'A2' : 'R1';
  const neighbourIp = local ? '192.168.10.3' : gatewayFault ? '192.168.10.62' : '192.168.10.1';
  const request = {
    title: local ? '② ARP 广播：谁拥有 A2 的 IP？' : gatewayFault ? '② ARP 广播：寻找错误网关 .62' : '② ARP 广播：先找到网关的 MAC',
    description: `A1 询问“谁是 ${neighbourIp}？”S1 学习源 MAC 属于 A1 的端口，并把广播发送到同一广播域的其他端口。`,
    path: gatewayFault ? ['A1', 'S1'] : ['A1', 'S1', neighbour],
    protocol: 'ARP',
    phase: 'arp',
    layer2: 'A1-MAC → FF:FF:FF:FF:FF:FF（广播）',
    layer3: `ARP 查询：${neighbourIp} 的 MAC；ARP 本身不是 IP 数据包`,
    focus: 'S1',
    note: '动画画出与当前通信有关的一条广播分支；实际交换机会在同一 VLAN 中泛洪到其他符合条件的端口。ARP 广播不会由路由器转发到其他子网。',
  };
  if (gatewayFault) return [request];
  return [request, {
    title: local ? '③ A2 返回 MAC 地址' : '③ R1 返回 A 区接口的 MAC',
    description: `${neighbour} 单播回复 A1。S1 学习回复帧的源 MAC，并利用已经学到的 A1 端口转发；A1 缓存 IP 与 MAC 的对应关系。`,
    path: [neighbour, 'S1', 'A1'],
    protocol: 'ARP',
    phase: 'arp',
    layer2: `${local ? 'A2-MAC' : 'R1-A-MAC'} → A1-MAC（单播）`,
    layer3: `ARP 回答：${neighbourIp} 对应 ${local ? 'A2-MAC' : 'R1-A-MAC'}`,
    focus: 'A1',
    note: local
      ? '同一子网解析目标主机 MAC；电脑之间的通信不经过默认网关。'
      : `A1 解析的是网关 MAC，IP 包的最终目标仍是 ${TARGET_IP[scenario]}。`,
  }];
}

function resultStep(scenario) {
  return {
    title: '通信成功 · 请求与回复都走通了',
    description: `${SCENARIO_META[scenario].source} 收到 ${SCENARIO_META[scenario].target} 的 Echo Reply。请说明经过了哪些设备，以及哪些地址发生了变化。`,
    path: ['A1'],
    protocol: '结果',
    phase: 'success',
    layer2: scenario === 'same' ? '帧在交换机转发时不改变源 / 目标 MAC' : '路由器在每个出接口重新封装帧，MAC 随链路改变',
    layer3: scenario === 'same' ? '同区通信不经过路由器，TTL 不因交换机转发而减少' : '每个请求包的端到端 IP 保持不变，经过路由器时 TTL 递减；回复包方向相反',
    focus: 'A1',
    command: `ping ${TARGET_IP[scenario]}`,
    note: '本案例没有 NAT。真实首次 ping 可能因 ARP 解析而暂时丢失一个探测包，可以等待缓存建立后再测试。',
  };
}

function gatewayFailure(scenario) {
  return {
    title: '通信失败 · 没有设备回答错误网关的 ARP',
    description: `没有设备使用 192.168.10.62，A1 得不到下一跳 MAC。因此本次 ICMP 请求无法被封装并交给网关，尚未到达 ${SCENARIO_META[scenario].target}。`,
    path: ['A1'],
    protocol: '结果',
    phase: 'failure',
    layer2: '网关 192.168.10.62 的 MAC 未解析',
    layer3: `目标 ${TARGET_IP[scenario]} 的请求未离开 A 区`,
    focus: 'A1',
    note: `${FAULT_META.gateway.fix} 同区通信不依赖默认网关，所以 A1 → A2 仍可能成功。`,
    command: '检查 A1：IP Configuration → Default Gateway',
  };
}

function sameExchange() {
  return [{
    title: '④ ICMP 请求：A1 → A2',
    description: 'A1 发出 Echo Request。S1 读取目标 MAC，把帧转发到 A2 所在端口；源 / 目标 MAC 和 IP 都保持不变。',
    path: ['A1', 'S1', 'A2'],
    protocol: 'ICMP',
    phase: 'request',
    layer2: 'A1-MAC → A2-MAC',
    layer3: requestIp('same', 64),
    focus: 'S1',
    command: 'show mac address-table',
    note: '交换机依靠 MAC 地址表转发以太网帧；本例不需要路由。',
  }, {
    title: '⑤ ICMP 回复：A2 → A1',
    description: 'A2 生成新的 Echo Reply，S1 将回复转发给 A1。请求与回复是两个不同的 IP 数据包。',
    path: ['A2', 'S1', 'A1'],
    protocol: 'ICMP',
    phase: 'reply',
    layer2: 'A2-MAC → A1-MAC',
    layer3: replyIp('same', 64),
    focus: 'A2',
  }];
}

function directExchange() {
  return [{
    title: '④ 请求先交给 R1',
    description: 'A1 用 R1 的 A 区接口 MAC 作为帧目标，经 S1 到达 R1；IP 目标仍然是 B1。',
    path: ['A1', 'S1', 'R1'],
    protocol: 'ICMP',
    phase: 'request',
    layer2: 'A1-MAC → R1-A-MAC',
    layer3: requestIp('direct', 64),
    focus: 'R1',
  }, {
    title: '⑤ R1 利用直连路由转发到 B 区',
    description: 'R1 查到 192.168.10.64/27 直接连接自己的 B 区接口，TTL 从 64 减到 63。它换一个新的以太网帧，经 S2 发给 B1。',
    path: ['R1', 'S2', 'B1'],
    protocol: 'ICMP',
    phase: 'request',
    layer2: 'R1-B-MAC → B1-MAC（重新封装）',
    layer3: requestIp('direct', 63),
    focus: 'R1',
    command: 'show ip route',
    note: '接口地址正确且接口启用后，两个 LAN 的直连路由可用；这一步不需要静态路由。',
  }, {
    title: '⑥ B1 把回复交给自己的网关',
    description: 'B1 判断 A1 位于另一子网，因此把 Echo Reply 交给 192.168.10.65，即 R1 的 B 区接口。',
    path: ['B1', 'S2', 'R1'],
    protocol: 'ICMP',
    phase: 'reply',
    layer2: 'B1-MAC → R1-B-MAC',
    layer3: replyIp('direct', 64),
    focus: 'B1',
  }, {
    title: '⑦ R1 将回复转发回 A 区',
    description: 'R1 查到 A 区的直连路由，减少回复包的 TTL，再通过 S1 把新封装的帧送到 A1。',
    path: ['R1', 'S1', 'A1'],
    protocol: 'ICMP',
    phase: 'reply',
    layer2: 'R1-A-MAC → A1-MAC（重新封装）',
    layer3: replyIp('direct', 63),
    focus: 'R1',
  }];
}

function remoteRequest() {
  return [{
    title: '④ 请求先交给 A 区网关 R1',
    description: 'A1 经 S1 将请求交给 R1。帧目标是本地网关，IP 目标是 C1。',
    path: ['A1', 'S1', 'R1'],
    protocol: 'ICMP',
    phase: 'request',
    layer2: 'A1-MAC → R1-A-MAC',
    layer3: requestIp('remote', 64),
    focus: 'R1',
  }, {
    title: '⑤ R1 根据静态路由，把请求交给 R2',
    description: 'R1 的路由表指出：去 192.168.10.96/28，下一跳是 192.168.10.114。R1 减少 TTL，用连接接口的 MAC 重新封装。',
    path: ['R1', 'R2'],
    protocol: 'ICMP',
    phase: 'request',
    layer2: 'R1-Link-MAC → R2-Link-MAC（重新封装）',
    layer3: requestIp('remote', 63),
    focus: 'R1',
    command: 'ip route 192.168.10.96 255.255.255.240 192.168.10.114',
    note: 'R1 的连接地址是 .113/30，R2 是 .114/30；两者属于 192.168.10.112/30。',
  }, {
    title: '⑥ R2 利用直连路由，把请求送到 C1',
    description: 'R2 查到 C 区直接连接自己的 192.168.10.97/28 接口。TTL 再减 1，经 S3 把请求交给 C1。',
    path: ['R2', 'S3', 'C1'],
    protocol: 'ICMP',
    phase: 'request',
    layer2: 'R2-C-MAC → C1-MAC（重新封装）',
    layer3: requestIp('remote', 62),
    focus: 'C1',
    note: '此时请求已经到达。ping 成功还需要回复能够返回 A1。',
  }];
}

function remoteReplyStart() {
  return {
    title: '⑦ C1 把回复交给 C 区网关 R2',
    description: 'C1 是 192.168.10.98/28，判断 A1 不在自己的子网，于是把 Echo Reply 交给默认网关 192.168.10.97。',
    path: ['C1', 'S3', 'R2'],
    protocol: 'ICMP',
    phase: 'reply',
    layer2: 'C1-MAC → R2-C-MAC',
    layer3: replyIp('remote', 64),
    focus: 'R2',
  };
}

function remoteReplyFinish() {
  return [{
    title: '⑧ R2 根据回程静态路由，把回复交给 R1',
    description: 'R2 查到去 A 区 192.168.10.0/26 的下一跳是 192.168.10.113。回复 TTL 减少，并在路由器连接上重新封装。',
    path: ['R2', 'R1'],
    protocol: 'ICMP',
    phase: 'reply',
    layer2: 'R2-Link-MAC → R1-Link-MAC（重新封装）',
    layer3: replyIp('remote', 63),
    focus: 'R2',
    command: 'ip route 192.168.10.0 255.255.255.192 192.168.10.113\nip route 192.168.10.64 255.255.255.224 192.168.10.113',
    note: '第一条用于返回 A 区；第二条用于返回 B 区，使完整拓扑中的三个区域都能互通。',
  }, {
    title: '⑨ R1 将回复送回 A1',
    description: 'R1 利用 A 区的直连路由，经 S1 把回复送回 A1；回复 TTL 再减 1。',
    path: ['R1', 'S1', 'A1'],
    protocol: 'ICMP',
    phase: 'reply',
    layer2: 'R1-A-MAC → A1-MAC（重新封装）',
    layer3: replyIp('remote', 62),
    focus: 'A1',
  }];
}

function returnFailure() {
  return {
    title: '通信失败 · 回复在 R2 找不到回 A 区的路由',
    description: '请求到达 C1，回复也到达 R2。但 R2 没有去 192.168.10.0/26 的路由，也没有可用的默认路由，因此不能把回复转发给 R1。',
    path: ['R2'],
    protocol: '结果',
    phase: 'failure',
    layer2: '没有可用下一跳，回复无法转发',
    layer3: 'ICMP 回复的目标仍是 192.168.10.2；缺少匹配路由',
    focus: 'R2',
    command: 'show ip route',
    note: `${FAULT_META.return.fix} 动画省略可能生成的其他 ICMP 错误报文，只展示 Echo 请求与回复的主流程。`,
  };
}

function maskFailureSteps() {
  return [{
    title: '⑦ C1 的 /24 掩码，让它判断错了',
    description: 'C1 被误设为 192.168.10.98/24。它认为 A1 的 192.168.10.2 也属于 192.168.10.0/24，因此直接 ARP 查询 A1，而不是把回复交给网关。',
    path: ['C1', 'S3', 'R2'],
    protocol: 'ARP',
    phase: 'arp',
    layer2: 'C1-MAC → FF:FF:FF:FF:FF:FF（广播）',
    layer3: 'ARP 查询：192.168.10.2 的 MAC；C1 错把 A1 当成本地邻居',
    focus: 'C1',
    note: '本故障场景假定 R2 的 C 区接口关闭 Proxy ARP，且 C1 没有 A1 的缓存条目。这样能直接观察错误掩码造成的邻居解析失败。',
  }, {
    title: '通信失败 · A1 不在 C 区，ARP 无人回答',
    description: 'S3 泛洪 ARP，但 A1 在另一个广播域；路由器不会转发这条广播。关闭 Proxy ARP 的 R2 不代答，所以 C1 得不到 A1 的 MAC，回复无法发出。',
    path: ['C1'],
    protocol: '结果',
    phase: 'failure',
    layer2: '192.168.10.2 的 MAC 未解析',
    layer3: 'Echo Reply 未离开 C 区；请求到达不代表往返成功',
    focus: 'C1',
    command: 'R2 C 区接口：no ip proxy-arp',
    note: `${FAULT_META.mask.fix} 如果设备启用了 Proxy ARP，这种错误有时会被暂时掩盖；设计实际故障实验时应先关闭并清除相关 ARP 缓存。`,
  }];
}

/**
 * @param {{scenario?: 'same'|'direct'|'remote', fault?: 'none'|'gateway'|'return'|'mask'}} options
 * @returns {Array<{title:string,description:string,path:string[],protocol:string,phase:string,layer2:string,layer3:string,focus?:string,command?:string,note?:string}>}
 */
export function buildSteps({ scenario = 'same', fault = 'none' } = {}) {
  if (!Object.hasOwn(SCENARIO_META, scenario)) scenario = 'same';
  if (!Object.hasOwn(FAULT_META, fault)) fault = 'none';
  const supported = FAULT_META[fault].applicableScenarios.includes(scenario);
  const unavailableFault = supported ? '' : `“${FAULT_META[fault].label}”不适用于这个实验。`;
  if (!supported) fault = 'none';

  const steps = [decisionStep(scenario, unavailableFault, fault), ...arpSteps(scenario, fault === 'gateway')];
  if (fault === 'gateway') return [...steps, gatewayFailure(scenario)];
  if (scenario === 'same') return [...steps, ...sameExchange(), resultStep(scenario)];
  if (scenario === 'direct') return [...steps, ...directExchange(), resultStep(scenario)];

  steps.push(...remoteRequest());
  if (fault === 'mask') return [...steps, ...maskFailureSteps()];
  steps.push(remoteReplyStart());
  if (fault === 'return') return [...steps, returnFailure()];
  return [...steps, ...remoteReplyFinish(), resultStep(scenario)];
}
