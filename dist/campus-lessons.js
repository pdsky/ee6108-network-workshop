// 原创教学讲义。CLI 按新建 Packet Tracer 实验编写，命令与对应 .pkt 均尚未完成预实验。
// 本文件仅提供教学数据；网站动画不能证明真实设备配置已验证。
// 原理参考 Cisco：
// https://www.cisco.com/c/en/us/support/docs/security/ios-firewall/23602-confaccesslists.html
// https://www.cisco.com/c/en/us/support/docs/lan-switching/inter-vlan-routing/14976-50.html

export const CAMPUS_LESSONS = [
  {
    id: 'zones', number: '01', title: '三类访问者，三个网站', subtitle: '从访问需求到五个网络区域',
    lead: '学生、教师和访客都能打开公开网站 PUB。课程网站 COURSE 与实验网站 LAB 默认只有教师能打开；教师可以给某台学生或访客电脑单独开放其中一个网站，也可以分别撤销。先把这张访问表写清楚，再搭建网络。',
    concepts: [
      {title: '访问者类别与网络区域是两件事', body: '三类访问者分别是学生、教师、访客。网络划成五个 VLAN：学生 10、教师 20、服务器 30、访客 40、管理 99。AUTH 是教师在本实验中使用的专用管理终端，不是给普通教师电脑额外放行的理由。', example: 'Teacher-A 在 VLAN 20 使用三个网站；教师要修改许可时，转到 VLAN 99 的 AUTH 终端登录 R1。'},
      {title: '把“能访问”具体到一个网站', body: 'PUB .100 提供公开资料，COURSE .102 提供课程资源，LAB .101 提供实验资源。这里所有网站都用 HTTP TCP 80。学生和访客默认只能使用 PUB；教师子网默认能使用三个网站。课程许可和实验许可彼此独立。', example: '只批准 Student-A 访问 COURSE：A 能打开 PUB 与 COURSE，仍不能打开 LAB；Student-B 和 Guest-1 仍只能打开 PUB。'},
      {title: '教师授权在这里是固定 IP 许可', body: '教师在实验中兼任网络管理员，从 AUTH 登录 R1 修改 ACL。规则识别电脑的源 IP，不识别学生姓名或网页账号。没有网页审批、账号登录或自动到期；冒用被授权 IP 的风险也未由本实验解决。', example: '允许源 192.168.10.11 访问课程 HTTP，表示给这台固定 IP 电脑放行，并不等于认证了真实学生。'},
      {title: '网络设备各司其职', body: '四台 2960 交换机连接终端并承载 VLAN；2911 路由器 R1 连接五个子网，并在学生、教师、访客入口分别检查访问清单。三个 Server 分别承载三个网站。普通教师的网站许可不会赋予控制学生电脑或任意 SSH 设备的能力。', example: 'Guest-1 → GUEST-SW → CORE-SW → R1 → CORE-SW → PUB。去 COURSE 的路径相同，但授权前会被访客入口 ACL 拒绝。'}
    ],
    teach: [
      '先请同学扮演学生 A、学生 B、教师与访客 G1，为三个网站填出默认成功或失败。',
      '再加入一个申请：只给 A 开课程网站。请同学检查 A 的实验网站和 G1 的课程网站是否仍被拒绝。',
      '区分三类使用者与五个网络区域，说明服务器和管理区域各自的作用。',
      '明确普通教师电脑只获得三个网站 HTTP 许可；设备管理由 AUTH 终端承担。'
    ],
    lab: [
      {title: '放置并命名 14 台设备', detail: '新建 Packet Tracer 文件，放 1 台 2911 R1、4 台 2960 CORE-SW / STU-SW / TCH-SW / GUEST-SW、6 台 PC 和 3 台 Server。PC 命名 Student-A、Student-B、Teacher-A、Teacher-B、AUTH、Guest-1；Server 命名 PUB、LAB、COURSE。命令和 .pkt 尚未完成预实验，请在所选 Packet Tracer 版本中逐项验证。'},
      {title: '连接四条骨干链路', detail: 'R1 G0/0 ↔ CORE-SW Fa0/1；CORE-SW G0/1 ↔ STU-SW G0/1；CORE-SW G0/2 ↔ TCH-SW G0/1；CORE-SW Fa0/5 ↔ GUEST-SW G0/1。它们全部配置为 trunk。可用自动选线；若设备接口编号不同，先修正端口表再替换命令。'},
      {title: '连接终端与服务器', detail: 'STU-SW Fa0/1 接 Student-A、Fa0/2 接 Student-B；TCH-SW Fa0/1 接 Teacher-A、Fa0/2 接 Teacher-B；GUEST-SW Fa0/1 接 Guest-1。CORE-SW Fa0/2 接 PUB、Fa0/3 接 LAB、Fa0/6 接 COURSE、Fa0/4 接 AUTH。终端使用 FastEthernet0。'},
      {title: '绘制默认与部分授权访问表', detail: '默认：SA / SB / G1 的 PUB 成功，COURSE / LAB 失败；TA / TB 的三个网站全部成功。再记录“只授权 SA 的 COURSE”：只有 SA 的 COURSE 从失败变成功。给五个 VLAN 加标签，保存 00_topology.pkt；链路绿灯不表示 HTTP 许可已正确。'}
    ],
    questions: [
      {question: '教师只批准 Student-A 访问 COURSE，哪项符合设计？', options: ['A 的 COURSE 成功，A 的 LAB 与 G1 的 COURSE 仍失败', 'A 与所有访客都能打开三个网站', 'A 可以 SSH 登录 R1'], correctIndex: 0, explanation: '许可同时限定源电脑、目的服务器与 TCP 80。课程授权不开放实验网站，也不会传递给其他电脑。'},
      {question: '普通 Teacher-A 默认能打开三个网站，是否表示它可以管理所有设备？', options: ['是，教师角色拥有任意网络服务权限', '否，三个 HTTP 许可与 AUTH 的 SSH 管理入口分开', '是，教师可以远程控制学生电脑'], correctIndex: 1, explanation: '教师入口 ACL 只开放三个网站 TCP 80 和本网关 ping。R1 的 SSH 来源另限制为 AUTH .114。'}
    ],
    takeaway: '先写清楚谁能访问哪个网站；三类访问者、五个 VLAN、每台电脑的每个网站许可各自有边界。'
  },
  {
    id: 'address', number: '02', title: '五个区域，五组地址', subtitle: '子网、掩码与默认网关',
    lead: '把 192.168.10.0/24 切成互不重叠的学生、教师、服务器、管理和访客子网。电脑先根据 IP 与掩码判断目的地是否本地；跨子网时，把帧交给自己的默认网关。',
    concepts: [
      {title: '容量计算要包含网关', body: '学生区预计 50 台终端，还需要 1 个网关，至少需要 51 个可用地址。/26 有 62 个通常可分配的地址；/27 只有 30 个，不能容纳该学生区。', example: 'VLAN 10：192.168.10.0/26，掩码 255.255.255.192，可用 .1–.62，广播 .63，网关 .1。'},
      {title: '教师、服务器与管理地址', body: 'VLAN 20 用 .64/27，可用 .65–.94，广播 .95，网关 .65；VLAN 30 用 .96/28，可用 .97–.110，广播 .111，网关 .97；VLAN 99 用 .112/28，可用 .113–.126，广播 .127，网关 .113。所有简写都以 192.168.10 开头。', example: 'TA .66、TB .67；PUB .100、LAB .101、COURSE .102；AUTH .114、CORE .115、STU .116、TCH .117、GUEST-SW .118。'},
      {title: '访客使用独立子网', body: 'VLAN 40 用 192.168.10.128/27，掩码 255.255.255.224。网络地址 .128，通常可分配 .129–.158，广播 .159；网关占用 .129，Guest-1 使用 .130。剩余 .160–.255 留作后续规划，不属于本实验五个子网。', example: 'Guest-1：192.168.10.130 / 255.255.255.224，默认网关 192.168.10.129。'},
      {title: '默认网关必须属于本网', body: '学生访问 Student-B .12 时通常直接走本地交换；访问 COURSE .102 或访客 .130 时，先找 .1 的 MAC。目的 IP 仍是目标电脑或服务器；路由器随后决定转发或拒绝。', example: 'Guest-1 去 PUB .100，第一跳帧交给 .129 的 MAC，不是直接寻找远端 PUB 的 MAC。'}
    ],
    teach: [
      '把 IP 讲成门牌，掩码定义本区范围，默认网关是离开本区的入口。',
      '先计算学生 50 台终端加 1 个网关，再选 /26；不要只数 PC 而忘记网关。',
      '请同学检查 .128 与 .159 为什么不能分给访客 PC，并说明 .129 已留给网关。',
      '对比 SA 到 SB、SA 到 COURSE、G1 到 PUB 三条路径，找出何时需要 R1。'
    ],
    lab: [
      {title: '填写学生和教师 IP', detail: 'PC → Desktop → IP Configuration → Static。Student-A .11、Student-B .12，掩码 255.255.255.192，网关 .1；Teacher-A .66、Teacher-B .67，掩码 255.255.255.224，网关 .65。每个地址都填写完整的 192.168.10.x。'},
      {title: '填写三个服务器 IP', detail: 'PUB：192.168.10.100；LAB：192.168.10.101；COURSE：192.168.10.102。三台均用掩码 255.255.255.240、默认网关 192.168.10.97。DNS 暂不填写，后续用完整 IP URL 打开网站。'},
      {title: '填写管理与访客 IP', detail: 'AUTH：192.168.10.114，掩码 255.255.255.240，网关 192.168.10.113。Guest-1：192.168.10.130，掩码 255.255.255.224，网关 192.168.10.129。交换机管理 SVI 在下一课配置为 CORE .115、STU .116、TCH .117、GUEST-SW .118。'},
      {title: '检查地址表与本地通信', detail: '网络地址 .0 / .64 / .96 / .112 / .128 和广播地址 .63 / .95 / .111 / .127 / .159 不分给终端，五个网关不重复使用。Student-A 执行下面命令检查地址与同网通信；各本网关的测试留到下一课配置 R1 后。首次 ARP 解析可能导致首次 ping 丢包，需复测。', command: `ipconfig
ping 192.168.10.12`}
    ],
    questions: [
      {question: 'Guest-1 使用 .130/27，正确的默认网关与广播地址是？', options: ['网关 .1，广播 .63', '网关 .129，广播 .159', '网关 .128，广播 .158'], correctIndex: 1, explanation: '访客子网是 .128/27，.128 是网络地址，.159 是广播地址，规划的本网关为 .129。'},
      {question: 'Student-A 访问 COURSE .102，第一跳帧应交给谁？', options: ['Student-B 的 MAC', '远端 COURSE 的 MAC', '默认网关 .1 的 MAC'], correctIndex: 2, explanation: '.102 不在 .11 所在的 .0/26 子网内。SA 把帧交给本网关；数据包的目的 IP 仍然是 .102。'}
    ],
    takeaway: '五个子网互不重叠；每台终端的 IP、掩码、网关必须配套，网关也占用可用地址。'
  },
  {
    id: 'vlan', number: '03', title: '把五个区域落到设备上', subtitle: '四台交换机与五个路由子接口',
    lead: 'PC 与服务器端口用 access，多 VLAN 共用的骨干链路用 trunk。四台交换机都创建 VLAN 10、20、30、40、99；R1 用五个子接口提供五个网关。先验证无 ACL 的基础通信，再加访问政策。',
    concepts: [
      {title: 'Access 端口确定终端区域', body: '学生接入口属于 VLAN 10，教师属于 VLAN 20，三个服务器属于 VLAN 30，访客属于 VLAN 40，AUTH 属于 VLAN 99。普通终端不需要自己加 VLAN 标签。', example: 'GUEST-SW Fa0/1：switchport mode access，然后 switchport access vlan 40。'},
      {title: 'Trunk 要允许所有需要的 VLAN', body: 'R1 到 CORE 及 CORE 到三台接入交换机的四条骨干都用 trunk，允许列表都是 10,20,30,40,99。既要创建 VLAN，也要允许其经过相关 trunk。2960 直接配置 switchport mode trunk。', example: 'CORE-SW Fa0/5 到 GUEST-SW G0/1 也必须允许 VLAN 40 与管理 VLAN 99。'},
      {title: '五个网关使用单臂路由', body: 'G0/0.10 / .20 / .30 / .40 / .99 分别用 encapsulation dot1Q 对应各 VLAN。跨 VLAN 流量进出 R1；同 VLAN 终端之间通常由交换机直接转发，不会经过 R1 的入口 ACL。', example: 'G1 去 PUB：VLAN 40 进入 R1，再通过 VLAN 30 返回 CORE-SW。'},
      {title: '直连路由与交换机管理地址', body: '五个子接口配置且链路正常后，R1 自动形成五个直连网络，不需要添加静态路由。2960 的 VLAN 99 SVI 用于管理交换机；它不承担 VLAN 间路由。这里没有互联网出口。', example: 'show ip route 应显示五个直连子网；交换机 ip default-gateway 都指向 .113。'}
    ],
    teach: [
      '沿端口表走一次：先确认 access 归属，再检查四条 trunk，最后检查 R1 子接口。',
      '在一条 trunk 上画五种 VLAN 标签，说明共享链路仍能保持不同广播域。',
      '提醒学生：创建 VLAN 不会自动产生跨 VLAN 路由；五个网关由 R1 提供。',
      '此课的无 ACL 测试用于证明路径可用，下一课的访问失败要对照政策判断。'
    ],
    lab: [
      {title: '完整配置 CORE-SW', detail: 'Fa0/1 到 R1，G0/1 与 G0/2 到学生和教师交换机，Fa0/5 到访客交换机；Fa0/2、Fa0/3、Fa0/6 接三个服务器，Fa0/4 接 AUTH。管理 SVI 是 .115。以下从用户模式开始。', command: `enable
configure terminal
hostname CORE-SW
vlan 10
 name STUDENTS
vlan 20
 name TEACHERS
vlan 30
 name SERVERS
vlan 40
 name GUESTS
vlan 99
 name MANAGEMENT
exit
interface fa0/1
 switchport mode trunk
 switchport trunk allowed vlan 10,20,30,40,99
exit
interface range g0/1 - 2
 switchport mode trunk
 switchport trunk allowed vlan 10,20,30,40,99
exit
interface fa0/5
 switchport mode trunk
 switchport trunk allowed vlan 10,20,30,40,99
exit
interface range fa0/2 - 3
 switchport mode access
 switchport access vlan 30
exit
interface fa0/6
 switchport mode access
 switchport access vlan 30
exit
interface fa0/4
 switchport mode access
 switchport access vlan 99
exit
interface vlan 99
 ip address 192.168.10.115 255.255.255.240
 no shutdown
exit
ip default-gateway 192.168.10.113
end
copy running-config startup-config`},
      {title: '完整配置 STU-SW', detail: 'Fa0/1、Fa0/2 接学生 PC；G0/1 上联 CORE。管理 SVI 是 .116。', command: `enable
configure terminal
hostname STU-SW
vlan 10
 name STUDENTS
vlan 20
 name TEACHERS
vlan 30
 name SERVERS
vlan 40
 name GUESTS
vlan 99
 name MANAGEMENT
exit
interface range fa0/1 - 2
 switchport mode access
 switchport access vlan 10
exit
interface g0/1
 switchport mode trunk
 switchport trunk allowed vlan 10,20,30,40,99
exit
interface vlan 99
 ip address 192.168.10.116 255.255.255.240
 no shutdown
exit
ip default-gateway 192.168.10.113
end
copy running-config startup-config`},
      {title: '完整配置 TCH-SW', detail: 'Fa0/1、Fa0/2 接教师 PC；G0/1 上联 CORE。管理 SVI 是 .117。', command: `enable
configure terminal
hostname TCH-SW
vlan 10
 name STUDENTS
vlan 20
 name TEACHERS
vlan 30
 name SERVERS
vlan 40
 name GUESTS
vlan 99
 name MANAGEMENT
exit
interface range fa0/1 - 2
 switchport mode access
 switchport access vlan 20
exit
interface g0/1
 switchport mode trunk
 switchport trunk allowed vlan 10,20,30,40,99
exit
interface vlan 99
 ip address 192.168.10.117 255.255.255.240
 no shutdown
exit
ip default-gateway 192.168.10.113
end
copy running-config startup-config`},
      {title: '完整配置 GUEST-SW', detail: 'Fa0/1 接 Guest-1；G0/1 上联 CORE-SW Fa0/5。管理 SVI 是 .118。', command: `enable
configure terminal
hostname GUEST-SW
vlan 10
 name STUDENTS
vlan 20
 name TEACHERS
vlan 30
 name SERVERS
vlan 40
 name GUESTS
vlan 99
 name MANAGEMENT
exit
interface fa0/1
 switchport mode access
 switchport access vlan 40
exit
interface g0/1
 switchport mode trunk
 switchport trunk allowed vlan 10,20,30,40,99
exit
interface vlan 99
 ip address 192.168.10.118 255.255.255.240
 no shutdown
exit
ip default-gateway 192.168.10.113
end
copy running-config startup-config`},
      {title: '完整配置 R1 五个网关', detail: '2911 使用 G0/0；物理接口必须 no shutdown。子接口的 dot1Q VLAN 与交换机的标签对应。五个网段直接连接，不输入静态路由。', command: `enable
configure terminal
hostname R1
interface g0/0
 no ip address
 no shutdown
exit
interface g0/0.10
 encapsulation dot1Q 10
 ip address 192.168.10.1 255.255.255.192
exit
interface g0/0.20
 encapsulation dot1Q 20
 ip address 192.168.10.65 255.255.255.224
exit
interface g0/0.30
 encapsulation dot1Q 30
 ip address 192.168.10.97 255.255.255.240
exit
interface g0/0.40
 encapsulation dot1Q 40
 ip address 192.168.10.129 255.255.255.224
exit
interface g0/0.99
 encapsulation dot1Q 99
 ip address 192.168.10.113 255.255.255.240
end
show ip interface brief
show ip route
copy running-config startup-config`},
      {title: '验证无 ACL 的基线并保存', detail: '各 PC 先 ping 本网关；SA、TA、G1 再 ping .100 / .101 / .102。此阶段还没有入口 ACL，基础路径应可达。四台交换机分别执行 show vlan brief 与 show interfaces trunk；失败先修 IP、access VLAN、trunk 和接口状态。保存 00_baseline.pkt。后续 HTTP 许可不会自动开放服务器 ping。', command: `show vlan brief
show interfaces trunk`}
    ],
    questions: [
      {question: 'CORE 到 GUEST-SW 的骨干应该怎样配置？', options: ['只属于 VLAN 40 的 access', '允许 10,20,30,40,99 的 trunk', '只允许 VLAN 10 的 trunk'], correctIndex: 1, explanation: '设计中四条骨干都传五个 VLAN，其中 VLAN 40 承载访客，VLAN 99 承载管理 SVI。'},
      {question: '五个 R1 子接口正常后，还必须给这五个本地子网添加静态路由吗？', options: ['不需要，它们是直连网络', '需要为每台 PC 添加一条', '只需要给访客网添加'], correctIndex: 0, explanation: '正确配置并正常工作的接口形成直连路由。此实验的五个本地网段无需静态路由。'}
    ],
    takeaway: '四台交换机配置五个 VLAN，四条骨干允许五个 VLAN，R1 五个子接口提供直连路由。'
  },
  {
    id: 'acl', number: '04', title: '公开可达，受限有界', subtitle: '三份入口 ACL 与三个 HTTP 网站',
    lead: '默认只向学生和访客开放 PUB；教师可以使用 PUB、COURSE、LAB。三个入口各绑定自己的 ACL，网站许可仅开放 TCP 80，各区域到本网关的 ping 单独许可，其余跨区流量拒绝。',
    concepts: [
      {title: '来源、目的和服务一起匹配', body: '扩展 ACL 按源 IP、目的 IP、协议与端口筛选。host 只匹配一个 IP，eq 80 指 HTTP。学生 /26 的通配符是 0.0.0.63，教师与访客 /27 是 0.0.0.31，管理 /28 是 0.0.0.15；通配符不要当成接口掩码输入。', example: 'permit tcp 192.168.10.128 0.0.0.31 host 192.168.10.100 eq 80：只给访客子网开放 PUB 的 HTTP。'},
      {title: '第一条匹配决定结果', body: 'ACL 从上往下检查，第一条匹配就结束。公共许可与本网关 ping 在前，单机授权预留在 30 / 31 / 40 / 41，再列跨区拒绝，最终 90 deny ip any any。把授权放在 90 之后没有作用。', example: 'SA 的 COURSE 授权放 STUDENT_POLICY 30；G1 的 COURSE 授权放 GUEST_POLICY 30，两者是不同清单。'},
      {title: '三个子接口分别检查入方向', body: 'STUDENT_POLICY 绑定 G0/0.10 in；TEACHER_POLICY 绑定 G0/0.20 in；GUEST_POLICY 绑定 G0/0.40 in。只创建清单但不绑定，流量不会按该清单过滤。服务器回复从对应终端接口离开，不再匹配该接口的入方向清单。', example: '访客访问 COURSE 必须检查 G0/0.40 的 GUEST_POLICY，不是修改学生清单。'},
      {title: '教师的全网站权限也很具体', body: '教师全网站权限是分别访问 .100 / .102 / .101 的 TCP 80。教师不能据此访问学生或访客电脑、管理区或任意 SSH 服务。学生和访客授权后的权限也只增加选定网站的 HTTP。', example: 'Teacher-A 打开三个网页成功，ping 学生 .11 或 SSH 到 R1 .113 仍应失败。'},
      {title: 'HTTP 与 ping 需要不同证据', body: '浏览器使用 http://IP 测试 TCP 80；ping 使用 ICMP。入口清单只允许向本网关发送 ICMP echo，所以三个角色 ping 服务器失败可以与网页成功同时成立。', example: 'G1 可打开 http://192.168.10.100，却不能 ping .100；ping .129 应成功。'}
    ],
    teach: [
      '逐行念出请求：哪台电脑，哪个网站，哪种协议，找到第一条匹配就停止。',
      '先预测默认访问表，再分别从学生、教师、访客入口检查真实结果。',
      '让同学解释“教师能访问所有教学网站”为何不能简写成 permit ip any any。',
      '比较公共 HTTP 成功与服务器 ping 失败，强调测试协议必须对应许可。'
    ],
    lab: [
      {title: '启动并区分三个 HTTP 网站', detail: 'PUB / COURSE / LAB → Services → HTTP → On。首页分别写“公开资料”“受限课程资源”“受限实验资源”。在无 ACL 基线中，从 SA、TA、G1 分别访问 http://192.168.10.100、http://192.168.10.102、http://192.168.10.101，先证明三个服务可用。'},
      {title: '创建学生默认清单并绑定', detail: '下面没有单机 COURSE / LAB 授权。序号 30、31 留给 SA，40、41 留给 SB。命令尚未预实验，先确认所选 Packet Tracer 设备支持命名 ACL 序号；遇到 Invalid input 需查验，不能视为成功。第 05 课说明无序号备选。', command: `enable
configure terminal
ip access-list extended STUDENT_POLICY
 10 permit tcp 192.168.10.0 0.0.0.63 host 192.168.10.100 eq 80
 20 permit icmp 192.168.10.0 0.0.0.63 host 192.168.10.1 echo
 70 deny ip any 192.168.10.64 0.0.0.31
 75 deny ip any 192.168.10.128 0.0.0.31
 80 deny ip any 192.168.10.112 0.0.0.15
 90 deny ip any any
exit
interface g0/0.10
 ip access-group STUDENT_POLICY in
end
show access-lists
show ip interface g0/0.10`},
      {title: '创建访客默认清单并绑定', detail: '访客默认只开放 PUB 与本网关 .129 的 ping。序号 30、31 分别留给 G1 的 COURSE、LAB；拒绝教师、学生、管理区域及其他流量。', command: `configure terminal
ip access-list extended GUEST_POLICY
 10 permit tcp 192.168.10.128 0.0.0.31 host 192.168.10.100 eq 80
 20 permit icmp 192.168.10.128 0.0.0.31 host 192.168.10.129 echo
 70 deny ip any 192.168.10.64 0.0.0.31
 75 deny ip any 192.168.10.0 0.0.0.63
 80 deny ip any 192.168.10.112 0.0.0.15
 90 deny ip any any
exit
interface g0/0.40
 ip access-group GUEST_POLICY in
end
show access-lists
show ip interface g0/0.40`},
      {title: '创建教师默认清单并绑定', detail: '教师子网分别许可 PUB、COURSE、LAB 的 TCP 80；仅额外许可本网关 .65 的 ping。它不赋予访问学生、访客、管理网或其他服务的能力。', command: `configure terminal
ip access-list extended TEACHER_POLICY
 10 permit tcp 192.168.10.64 0.0.0.31 host 192.168.10.100 eq 80
 11 permit tcp 192.168.10.64 0.0.0.31 host 192.168.10.102 eq 80
 12 permit tcp 192.168.10.64 0.0.0.31 host 192.168.10.101 eq 80
 20 permit icmp 192.168.10.64 0.0.0.31 host 192.168.10.65 echo
 70 deny ip any 192.168.10.0 0.0.0.63
 75 deny ip any 192.168.10.128 0.0.0.31
 80 deny ip any 192.168.10.112 0.0.0.15
 90 deny ip any any
exit
interface g0/0.20
 ip access-group TEACHER_POLICY in
end
show access-lists
show ip interface g0/0.20
copy running-config startup-config`},
      {title: '验证完整默认访问表', detail: 'SA、SB、G1：PUB 成功，COURSE / LAB 失败；TA、TB：三个网站全部成功。学生、教师、访客 PC ping 各自网关成功，ping 三服务器失败符合各自入口清单。AUTH 管理终端测试单列，不套用普通访问者策略：VLAN 99 未绑定这些入口 ACL，AUTH ping 服务器可以成功。学生不能跨区到教师、访客、管理；访客不能到教师、学生、管理；教师不能到学生、访客、管理。记录发起电脑、目标、协议、预期和实际，保存 01_restricted.pkt。Simulation 和命中计数可辅助定位，显示能力需本机验证。'}
    ],
    questions: [
      {question: 'Guest-1 可以打开 PUB，却 ping 不通 PUB，最合理的解释是？', options: ['HTTP 许可仅开放 TCP 80，服务器 ICMP 没有放行', 'GUEST_POLICY 一定未绑定', '应立即加入 permit ip any any'], correctIndex: 0, explanation: 'HTTP 与 ICMP 是不同协议。访客只允许 ping 自己的 .129 网关，不能用服务器 ping 代替网站测试。'},
      {question: '学生清单正确，但 G1 仍能访问所有网站，先检查什么？', options: ['STU-SW 的名称', 'G0/0.40 是否入方向绑定 GUEST_POLICY', '删除教师清单'], correctIndex: 1, explanation: '访客流量进入 G0/0.40，必须由访客清单过滤。学生接口的 ACL 不会自动覆盖访客入口。'}
    ],
    takeaway: '三个入口分别绑定三份清单；所有人的 PUB、教师的全网站、学生与访客的默认限制都要实测。'
  },
  {
    id: 'grant', number: '05', title: '按电脑、按网站授权', subtitle: '固定序号新增，独立撤销',
    lead: '教师从 AUTH .114 通过 SSH 登录 R1 管理地址 .113。先核对申请电脑与网站，再增加对应序号的精确 HTTP 许可。SA、SB、G1 的 COURSE 和 LAB 各有独立规则，撤销其中一条不会撤掉另一条。',
    concepts: [
      {title: '专用管理入口单独保护', body: '普通教师 PC 的网站权限不等于设备管理权限。R1 的 VTY 仅接受 AUTH .114 的来源，使用本地账号认证并只允许 SSH；课堂管理登录目标固定为 R1 .113。教师在本实验中使用管理员权限，实际职责与审批系统需另行设计。', example: 'AUTH 执行 ssh -l labteacher 192.168.10.113；Student-A、Guest-1、Teacher-A 均不能用该入口登录。'},
      {title: '六种许可有固定位置', body: 'STUDENT_POLICY：30 = SA COURSE，31 = SA LAB，40 = SB COURSE，41 = SB LAB。GUEST_POLICY：30 = G1 COURSE，31 = G1 LAB。相同序号可以出现在不同清单，但操作前必须确认清单名称。', example: 'STUDENT_POLICY 的 no 30 撤销 SA 课程；GUEST_POLICY 的 no 30 撤销 G1 课程，两者不相互影响。'},
      {title: '只新增申请的那条许可', body: '每条规则使用 host 来源、host 目的与 eq 80。给 SA 的 COURSE 许可不会开放 SA 的 LAB，不会开放 SB 或 G1，也不会开放 SSH 或服务器其他端口。给同一电脑两个网站权限需要两条许可。', example: '30 permit tcp host 192.168.10.11 host 192.168.10.102 eq 80：只授权 SA 的课程 HTTP。'},
      {title: '撤销只删除指定序号', body: '删除被撤销的序号，保留该电脑的其他许可、其他电脑许可和完整拒绝项。用新的 HTTP 请求验证，旧网页、缓存和已经下载的内容不会自动收回。', example: 'SA 同时获 COURSE / LAB 后，在 STUDENT_POLICY 执行 no 30：新 COURSE 请求失败，新 LAB 请求仍成功。'},
      {title: 'IP 许可有明确边界', body: '这里没有用户账号或网页审批；被授权 IP 被冒用时，ACL 不会辨认真实身份。受限服务器必须留在 VLAN 30，放进学生或访客同一 VLAN 会让本地交换绕过路由入口 ACL。', example: '修改浏览器姓名或页面按钮不会改变真实 R1 规则；移动 LAB 到 VLAN 10 也不是授权方法。'}
    ],
    teach: [
      '让申请者说清电脑与目标：SA、SB 或 G1；COURSE 或 LAB。教师逐段核对一条许可。',
      '先只给 SA COURSE，测 SA LAB、SB COURSE、G1 COURSE 都仍失败，证明部分授权有效。',
      '再给 G1 LAB，测 G1 COURSE 仍失败，同时 SA COURSE 保持成功。',
      '给 SA 增加 LAB 后只撤销 COURSE，让学生观察两项权限可独立变动。',
      '每次都检查 PUB 与普通教师三个网站仍可用，以及管理入口继续受保护。'
    ],
    lab: [
      {title: '在 R1 配置 SSH 与 AUTH 来源限制', detail: '先在本地 CLI 操作。替换 <YOUR_LAB_PASSWORD> 为实验专用口令，不能原样输入。crypto key generate rsa 出现位数提示后输入 1024；若设备提示不同，以本机语法为准。以下保护 vty 0–4；若 show running-config 还有 vty 5–15，也施加 login local、transport input ssh、access-class 三项。此实验只配置 R1 SSH，不给普通教师电脑或其他设备扩展管理权限。', command: `enable
configure terminal
ip domain-name campus.lab
username labteacher privilege 15 secret <YOUR_LAB_PASSWORD>
crypto key generate rsa
1024
ip ssh version 2
ip access-list standard MGMT_ONLY
 permit host 192.168.10.114
 deny any
exit
line vty 0 4
 login local
 transport input ssh
 access-class MGMT_ONLY in
end
show ip ssh
show running-config
copy running-config startup-config`},
      {title: '从 AUTH 登录 R1', detail: 'AUTH → Desktop → Command Prompt 输入下面命令，再输入实验口令。AUTH 应成功；SA、SB、G1、TA、TB 尝试同一目标应失败。后续授权命令在 R1 特权模式执行。SSH 和 ACL 序号均未完成预实验，必须先核实支持情况。', command: `ssh -l labteacher 192.168.10.113`},
      {title: '只批准 SA 的 COURSE', detail: '这是“只开课程”的完整新增操作。SA 新请求 COURSE 应成功，SA LAB 仍失败，SB / G1 的两个受限网站仍失败。检查 30 位于最终拒绝之前。', command: `configure terminal
ip access-list extended STUDENT_POLICY
 30 permit tcp host 192.168.10.11 host 192.168.10.102 eq 80
end
show access-lists
copy running-config startup-config`},
      {title: '独立批准 SA 的 LAB', detail: '仅在申请 SA 实验权限时新增 31；它不代替或修改 30。若上一项课程许可仍存在，SA 两个受限网站都成功；否则只 LAB 成功。', command: `configure terminal
ip access-list extended STUDENT_POLICY
 31 permit tcp host 192.168.10.11 host 192.168.10.101 eq 80
end
show access-lists
copy running-config startup-config`},
      {title: '只批准 SB 的 COURSE', detail: '仅在申请 SB 课程权限时新增 40。它不会开放 SB LAB，也不改变 SA 与 G1 的许可。若需要实验权限，另执行下一项。', command: `configure terminal
ip access-list extended STUDENT_POLICY
 40 permit tcp host 192.168.10.12 host 192.168.10.102 eq 80
end
show access-lists
copy running-config startup-config`},
      {title: '独立批准 SB 的 LAB', detail: '仅在申请 SB 实验权限时新增 41。它不会新增 SB COURSE；已有课程许可则保持不变。', command: `configure terminal
ip access-list extended STUDENT_POLICY
 41 permit tcp host 192.168.10.12 host 192.168.10.101 eq 80
end
show access-lists
copy running-config startup-config`},
      {title: '只批准 G1 的 COURSE', detail: '仅在申请 G1 课程权限时新增 GUEST_POLICY 30，来源固定 .130。G1 LAB 仍按原状态；学生许可不变。', command: `configure terminal
ip access-list extended GUEST_POLICY
 30 permit tcp host 192.168.10.130 host 192.168.10.102 eq 80
end
show access-lists
copy running-config startup-config`},
      {title: '独立批准 G1 的 LAB', detail: '仅在申请 G1 实验权限时新增 GUEST_POLICY 31。若 G1 没有课程许可，授权后仍只能打开 PUB 与 LAB，COURSE 仍失败；SA / SB 的许可不变。', command: `configure terminal
ip access-list extended GUEST_POLICY
 31 permit tcp host 192.168.10.130 host 192.168.10.101 eq 80
end
show access-lists
copy running-config startup-config`},
      {title: '只撤销选定电脑的选定网站', detail: '下面示例仅撤销 SA COURSE，保留 SA LAB。其他撤销在正确清单中只执行一个指定删除：STUDENT_POLICY 的 no 31 / no 40 / no 41 分别撤 SA LAB / SB COURSE / SB LAB；GUEST_POLICY 的 no 30 / no 31 分别撤 G1 COURSE / G1 LAB。不要删除整份 ACL。复测新的请求，保存 02_partial_authorized.pkt 与 03_partial_revoked.pkt。', command: `configure terminal
ip access-list extended STUDENT_POLICY
 no 30
end
show access-lists
show ip interface g0/0.10
copy running-config startup-config`},
      {title: '无序号备选：先创建两份完整访客清单', detail: '只在设备无法使用命名 ACL 序号时采用此备选，由教师在控制台操作。示例仅提供 G1 基线与“只开 COURSE”两份完整清单，均先创建并核对，下一项才切换绑定。它们按输入顺序匹配，不把新许可追加在 deny any any 后，不删除正在绑定的清单。其他电脑或权限组合必须先按当前完整授权状态生成完整清单、核对全部许可和拒绝项，再绑定；不要直接照搬此示例。', command: `enable
configure terminal
ip access-list extended GUEST_POLICY_BASE
 permit tcp 192.168.10.128 0.0.0.31 host 192.168.10.100 eq 80
 permit icmp 192.168.10.128 0.0.0.31 host 192.168.10.129 echo
 deny ip any 192.168.10.64 0.0.0.31
 deny ip any 192.168.10.0 0.0.0.63
 deny ip any 192.168.10.112 0.0.0.15
 deny ip any any
exit
ip access-list extended GUEST_POLICY_G1_COURSE
 permit tcp 192.168.10.128 0.0.0.31 host 192.168.10.100 eq 80
 permit icmp 192.168.10.128 0.0.0.31 host 192.168.10.129 echo
 permit tcp host 192.168.10.130 host 192.168.10.102 eq 80
 deny ip any 192.168.10.64 0.0.0.31
 deny ip any 192.168.10.0 0.0.0.63
 deny ip any 192.168.10.112 0.0.0.15
 deny ip any any
end
show access-lists`},
      {title: '无序号备选：先绑定基线', detail: '仅在上一项两份完整清单已创建并核对后，将 G0/0.40 绑定 BASE。验证 G1 只有 PUB。两份示例均不包含 G1 LAB：若当前有需要保留的 LAB 许可，先生成包含 LAB 的完整清单，不能直接切 BASE 导致额外撤销。学生与教师清单若也不支持序号，同样先建立完整默认清单后绑定对应入口。', command: `configure terminal
interface g0/0.40
 ip access-group GUEST_POLICY_BASE in
end
show ip interface g0/0.40
copy running-config startup-config`},
      {title: '无序号备选：只批准 G1 COURSE', detail: '切换到已创建并核对的完整 G1_COURSE 清单。G1 COURSE 成功，LAB 仍失败，PUB 保持成功。此示例只适用于没有需要保留的 G1 LAB 许可的状态；其他组合先生成完整清单再绑定。', command: `configure terminal
interface g0/0.40
 ip access-group GUEST_POLICY_G1_COURSE in
end
show ip interface g0/0.40
copy running-config startup-config`},
      {title: '无序号备选：撤销示例中的 G1 COURSE', detail: '此示例原来只有 G1 COURSE，因此改回完整 BASE 就只撤销该项课程许可。发起新请求，COURSE 失败、PUB 成功。若另有 LAB 权限要保留，则不能直接切 BASE，必须先生成保留 LAB 的完整清单再绑定。', command: `configure terminal
interface g0/0.40
 ip access-group GUEST_POLICY_BASE in
end
show ip interface g0/0.40
copy running-config startup-config`}
    ],
    questions: [
      {question: 'SA 同时拥有 COURSE 和 LAB，现在只撤销 COURSE，应怎样操作？', options: ['删除整个 STUDENT_POLICY', '在 STUDENT_POLICY 只删除序号 30', '删除 GUEST_POLICY 的序号 30 与 31'], correctIndex: 1, explanation: 'STUDENT_POLICY 30 是 SA COURSE，31 是 SA LAB。只删 30 才能独立撤销课程，同时保留实验和其他电脑许可。'},
      {question: '只批准 G1 的 LAB 后，哪组结果正确？', options: ['G1 COURSE 也成功，SB LAB 也成功', 'G1 可以 SSH 管理 R1', 'G1 PUB 和 LAB 成功，COURSE 仍失败；学生许可不变'], correctIndex: 2, explanation: 'GUEST_POLICY 31 只匹配源 .130、目的 .101、TCP 80。它不开放课程、其他电脑或设备管理。'}
    ],
    takeaway: '六项许可分别新增、分别撤销；固定 IP 授权只作用于选定电脑的选定 HTTP 网站。'
  },
  {
    id: 'trouble', number: '06', title: '用证据恢复正确访问', subtitle: '规则顺序、HTTP 服务与服务器 trunk',
    lead: '打不开可能是正确拒绝，也可能是故障。先说出当前授权状态下的预期，再按“现象 → 证据 → 原因 → 修复 → 复测”定位。每次只引入一个错误，最后检查所有角色和三个网站。',
    concepts: [
      {title: '失败先对照当前政策', body: '默认 SA / SB / G1 不能打开 COURSE 或 LAB；只授权 SA COURSE 后，SA LAB、SB COURSE、G1 COURSE 仍失败。这些都是正确结果，不应通过放开所有流量来消除。', example: 'G1 只获 LAB 许可：COURSE 失败是通过对照测试，不是需要修复的错误。'},
      {title: '先检查基础路径再检查许可', body: '本网关不通，先看 IP、掩码、网关、access VLAN 与链路；三个网站都失败，检查服务器 VLAN 30 路径与服务；只有已授权的选定网站失败，检查对应入口 ACL 的来源、目的、端口与顺序。', example: 'SA 已获 COURSE 而 TA 的 COURSE 正常：优先核对 STUDENT_POLICY 30 是否排在 90 之前。'},
      {title: '网络放行不代表应用已运行', body: 'HTTP 关闭会让已授权访问者与教师都无法打开该网站，即使 VLAN、路由、ACL 完全正确。选定服务器的 Services → HTTP 是直接证据；服务器 ping 在本实验入口清单下不是网站检查。', example: '只关闭 COURSE HTTP：TA 和已授权 SA 的 COURSE 失败，PUB 与 LAB 仍按原政策工作。'},
      {title: '共同路径故障会影响多个网站', body: 'CORE 到 R1 的 trunk 若遗漏 VLAN 30，三个网站的跨 VLAN 通信都受影响。各 PC 仍可能 ping 通自己的网关，因为它们所属 VLAN 还被允许通过；不要因此断定服务器路径正常。', example: 'TA 三个网站全失败、SA 和 G1 的 PUB 也失败：核对 CORE Fa0/1 是否允许 VLAN 30。'},
      {title: '修复后也要证明没有多开放', body: '恢复成功的同时保留应拒绝的请求。检查三个网站、SA / SB / G1 的独立授权、教师全网站、各本网关、跨区限制与 AUTH SSH。旧网页显示和已下载文件不能证明撤销失败。', example: '加入 permit ip any any 让网页成功，却开放教师、学生、访客或管理区域，不能算正确修复。'}
    ],
    teach: [
      '每次先明确当前申请记录，再让同学预测哪些请求成功、哪些失败。',
      '一次只注入一种故障，使用未授权电脑和普通教师作为对照。',
      '要求定位证据：清单顺序、HTTP 开关或 trunk 允许列表，而不是只说“现在好了”。',
      '修复后重测整个访问表，包括只有一个受限网站开放的情况。',
      '让同学说明固定 IP 许可、同 VLAN 绕过与已下载内容这些实验边界。'
    ],
    lab: [
      {title: '故障 1：把许可放到最终拒绝之后', detail: '仅在正确文件的备份副本中、已确认序号语法可用后操作。先删除有效的 SA COURSE 序号 30，再把同一许可故意放到 95，位于 90 deny ip any any 之后。预测 SA COURSE 失败、TA COURSE 正常；PUB 与其他许可仍按原政策。检查第一条匹配并记录证据，完成观察后才执行下一项修复。', command: `configure terminal
ip access-list extended STUDENT_POLICY
 no 30
 95 permit tcp host 192.168.10.11 host 192.168.10.102 eq 80
end
show access-lists
show ip interface g0/0.10`},
      {title: '恢复故障 1：删除错误规则并前置许可', detail: '只删本次注入的错误序号 95，将 SA COURSE 恢复为固定序号 30。新的课程请求应成功，SA LAB 仍按已有独立许可，SB 与 G1 状态不变。无序号方案在备份中构造相同顺序错误后，切回核对过的完整课程清单。', command: `configure terminal
ip access-list extended STUDENT_POLICY
 no 95
 30 permit tcp host 192.168.10.11 host 192.168.10.102 eq 80
end
show access-lists`},
      {title: '故障 2：只关闭选定网站 HTTP', detail: '选 COURSE .102 做本次故障：确保 SA 已获 COURSE 许可，再把 COURSE → Services → HTTP 改为 Off。SA 和 TA 的新 COURSE 请求均失败；PUB 与 LAB 应继续遵守原许可。直接检查 COURSE HTTP 状态后改回 On，发起新请求复测。若改选 LAB，只改 LAB 并用已获 LAB 许可的电脑对照；不要同时关闭三个服务。'},
      {title: '故障 3：R1 trunk 遗漏 VLAN 30', detail: '备份正确文件，在 CORE-SW Fa0/1 将 allowed 列表暂改成 10,20,40,99。TA 的三个网站，以及 SA / SB / G1 的 PUB 都应失败；本网关仍可能可达。检查 trunk 允许项，恢复 10,20,30,40,99。不要移动服务器到学生或访客 VLAN 来绕开故障。', command: `show interfaces trunk
! 修复，在 CORE-SW 执行：
configure terminal
interface fa0/1
 switchport trunk allowed vlan 10,20,30,40,99
end
show interfaces trunk
copy running-config startup-config`},
      {title: '恢复并验证默认与部分授权', detail: '至少保存三种正确状态：默认 SA / SB / G1 只有 PUB；部分授权示例 SA 只有 COURSE、G1 只有 LAB、SB 只有 PUB；再撤销 SA COURSE 时，G1 LAB 保持成功。每种状态都验证 TA / TB 三个网站与 PUB 的普遍可达。SSH 只从 AUTH 发起到 R1 .113；其他终端尝试该入口应失败。'},
      {title: '提交故障与测试记录', detail: '每个故障记录预期、现象、证据、原因、修复与复测。附 14 设备拓扑、五个子网表、四台交换机 VLAN / trunk 输出、R1 三份入口 ACL 与部分授权 HTTP 结果。命令和 .pkt 尚未完成预实验；网站动画用于教学，真正的 Packet Tracer 文件和测试证据要在本机完成。', command: `show ip interface brief
show ip route
show access-lists
show ip interface g0/0.10
show ip interface g0/0.20
show ip interface g0/0.40
! 以下在四台交换机分别执行：
show vlan brief
show interfaces trunk`}
    ],
    questions: [
      {question: 'G1 只获 LAB 许可，PUB 与 LAB 成功、COURSE 失败，应如何处理？', options: ['加入 permit ip any any', '删除访客 ACL', '结果符合部分授权，继续复测其他限制'], correctIndex: 2, explanation: '实验和课程许可独立。没有课程许可时 COURSE 应失败，不能把正确拒绝改成全开放。'},
      {question: 'TA 的三个网站全失败，G1 的 PUB 也失败，但各自网关 ping 成功，优先检查哪项？', options: ['先给 G1 两个受限网站授权', 'CORE 到 R1 的 trunk 是否遗漏 VLAN 30', '把所有服务器搬到 VLAN 40'], correctIndex: 1, explanation: '不同入口的网站请求共同经过服务器 VLAN 30。本网关可达只证明各自 VLAN 路径部分正常，不能证明服务器 VLAN 能通过 trunk。'}
    ],
    takeaway: '排错要恢复应成功的访问，并保留应拒绝的访问；每个判断都对应当前授权状态与可检查的证据。'
  }
];
