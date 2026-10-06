// 原创教学讲义。CLI 按新建 Packet Tracer 实验编写，尚未完成对应 .pkt 预实验。
// 原理参考 Cisco：
// https://www.cisco.com/c/en/us/support/docs/security/ios-firewall/23602-confaccesslists.html
// https://www.cisco.com/c/en/us/support/docs/lan-switching/inter-vlan-routing/14976-50.html

export const CAMPUS_LESSONS = [
  {
    id: 'zones', number: '01', title: '先把校园分成四个区', subtitle: '从需求到拓扑',
    lead: '先决定谁能访问什么，再配置设备。我们的学校有学生、教师、教学服务器和专用管理终端四个区域。教师批准的是某台学生电脑访问某个实验网站的权限。',
    concepts: [
      {title: '用一张访问表说明需求', body: '学生都能打开公共网站；实验网站需要授权；教师电脑和设备管理入口继续保护。普通教师可以使用两个教学网站。AUTH-PC 是授权教师专用的管理电脑。', example: '批准 Student-A 后，A 能打开实验网站，Student-B 仍不能打开。'},
      {title: '拓扑中的每台设备做什么', body: '2960 交换机连接电脑并区分 VLAN。R1 为四个 VLAN 转发流量，再检查学生发来的跨区请求。两台服务器分别提供公共 HTTP 网站和受限 HTTP 网站。', example: '学生访问实验服务器：Student-A → STU-SW → CORE-SW → R1 → CORE-SW → 实验服务器。'},
      {title: '理解本实验的“教师授权”', body: '课堂上由教师兼任网络管理员，通过 AUTH-PC 登录 R1 修改访问规则。许可按源 IP 地址识别电脑。网页审批、学生账号登录、自动到期需要另一个应用与身份系统。', example: '给 192.168.10.11 一条访问许可，不等于认证了真实学生姓名。'}
    ],
    teach: [
      '先让学生说出自己属于哪一类，再问：这个角色应该能打开哪个网站？',
      '把交换机讲成区域内的连接设备，把路由器讲成区域之间的入口。',
      '请三位同学扮演学生 A、学生 B 和授权教师。A 提出申请，教师批准，B 是对照组。',
      '强调授权后学生仍不能进入教师区或设备管理入口。'
    ],
    lab: [
      {title: '放置并命名 11 台设备', detail: '新建 Packet Tracer 文件，放 1 台 2911 路由器 R1、3 台 2960 交换机 CORE-SW / STU-SW / TCH-SW、5 台 PC 和 2 台 Server。PC 命名为 Student-A、Student-B、Teacher-A、Teacher-B、AUTH-PC；Server 命名为 PUBLIC-SRV、LAB-SRV。'},
      {title: '按端口表连接骨干', detail: 'R1 G0/0 ↔ CORE-SW Fa0/1；CORE-SW G0/1 ↔ STU-SW G0/1；CORE-SW G0/2 ↔ TCH-SW G0/1。可使用自动选线。若型号接口编号不同，以实际接口替换后续命令，不要照搬编号。'},
      {title: '连接终端', detail: 'STU-SW Fa0/1 接 Student-A，Fa0/2 接 Student-B；TCH-SW Fa0/1 接 Teacher-A，Fa0/2 接 Teacher-B；CORE-SW Fa0/2 接 PUBLIC-SRV，Fa0/3 接 LAB-SRV，Fa0/4 接 AUTH-PC。终端使用 FastEthernet0。'},
      {title: '画出访问路径并保存', detail: '给四个区域加文字标签，记录授权前、授权后、撤销后三种预期。保存为 00_topology.pkt。绿灯表示链路状态，不能据此断定网站许可已经正确。'}
    ],
    questions: [
      {question: '教师批准 Student-A 后，哪一种行为符合设计？', options: ['A 能打开实验网站，B 仍被拒绝', '所有学生都能管理路由器', 'A 能进入教师电脑的任何服务'], correctIndex: 0, explanation: '我们只给 A 开放实验网站 TCP 80。学生区对教师区与管理入口的限制继续生效。'},
      {question: '为什么要留下 Student-B？', options: ['为了增加设备数量', '作为未授权对照，证明许可没有开放给所有人', '让它替教师修改配置'], correctIndex: 1, explanation: '只测 A 成功不能证明规则足够精确。B 继续失败，才说明没有把整个学生区一起放行。'}
    ],
    takeaway: '先把访问政策写清楚：谁、访问什么服务、在什么条件下允许。'
  },
  {
    id: 'address', number: '02', title: '每个区有自己的地址', subtitle: '子网、掩码与默认网关',
    lead: '把 192.168.10.0/24 按区域切开。学生电脑根据自己的 IP 和掩码判断目的地是否本地；目的地在另一个子网时，先交给默认网关。',
    concepts: [
      {title: '地址规划要把网关算进去', body: '学生区预计 50 台终端，还需要 1 个网关地址。/26 有 64 个地址，其中 62 个通常可分配；/27 只有 30 个，容纳不了学生区。', example: '学生 VLAN 10：192.168.10.0/26；可用 .1–.62；广播 .63；网关 .1。'},
      {title: '四个子网互不重叠', body: '教师区用 .64/27，可用 .65–.94，广播 .95；服务器区用 .96/28，可用 .97–.110，广播 .111；管理区用 .112/28，可用 .113–.126，广播 .127。所有简写都以 192.168.10 开头。', example: 'Student-A .11、Teacher-A .66 和 LAB-SRV .101 分属三个子网。'},
      {title: '默认网关是本区的路由入口', body: '电脑和自己的默认网关必须在同一子网。学生去服务器区时，先找 .1 的 MAC，把帧交给 R1；IP 目的地址仍然是服务器 .101。', example: 'A 的配置：IP 192.168.10.11，掩码 255.255.255.192，网关 192.168.10.1。'}
    ],
    teach: [
      '把 IP 比作门牌，掩码决定哪些门牌属于本区，默认网关是离开本区的入口。',
      '先问：50 台学生电脑加 1 个网关，一共需要多少可用地址？答案是 51。',
      '让学生判断 .11 到 .12 是本地通信，.11 到 .101 则需要网关。'
    ],
    lab: [
      {title: '填写学生和教师 IP', detail: 'PC → Desktop → IP Configuration → Static。Student-A：192.168.10.11，Student-B：192.168.10.12；二者掩码 255.255.255.192，网关 192.168.10.1。Teacher-A：192.168.10.66，Teacher-B：192.168.10.67；二者掩码 255.255.255.224，网关 192.168.10.65。'},
      {title: '填写服务器和管理 IP', detail: 'PUBLIC-SRV：192.168.10.100，LAB-SRV：192.168.10.101；二者掩码 255.255.255.240，网关 192.168.10.97。AUTH-PC：192.168.10.114，掩码 255.255.255.240，网关 192.168.10.113。DNS 暂不填写，用完整 IP 打开网站。'},
      {title: '检查地址与主机容量', detail: '网络地址 .0 / .64 / .96 / .112 和广播地址 .63 / .95 / .111 / .127 不能分给普通终端。网关留给 R1 子接口，终端不重复使用。管理交换机地址预留 .115 / .116 / .117。'},
      {title: '先观察本地通信', detail: '在 Student-A 的 Desktop → Command Prompt 执行下面命令。交换机还未分 VLAN 时，两台学生 PC 在默认 VLAN 内可能已经互通。到默认网关的测试要等下一课配置 R1 后再做。首次 ARP 解析可能使第一次 ping 有丢包，复测并观察路径。', command: 'ipconfig\nping 192.168.10.12'}
    ],
    questions: [
      {question: '学生区有 50 台终端，还需要网关。最小的合适子网是？', options: ['/27：30 个可用地址', '/26：62 个可用地址', '/28：14 个可用地址'], correctIndex: 1, explanation: '50 + 1 = 51 个可用地址，/26 的 62 个可用地址够用；另两个不够。'},
      {question: 'Student-A 访问 192.168.10.101，第一跳的帧应交给谁？', options: ['Student-B 的 MAC', '服务器在远端 VLAN 的 MAC', '默认网关 192.168.10.1 的 MAC'], correctIndex: 2, explanation: '.101 不在 A 的 .0/26 子网内，A 先把帧交给本区网关。IP 目的地址保持为 .101。'}
    ],
    takeaway: 'IP、掩码、默认网关三项必须配套；本网通信和跨网通信走的路径不同。'
  },
  {
    id: 'vlan', number: '03', title: '把分区落到交换机上', subtitle: 'Access、Trunk 与单臂路由',
    lead: 'VLAN 把交换网络划成不同的广播域。电脑端口用 access；多 VLAN 共用的交换机间链路和 R1 链路用 trunk。R1 用四个子接口担任四个区域的网关。',
    concepts: [
      {title: 'Access 端口接一种区域', body: '接 Student-A 的端口分到 VLAN 10，接教师电脑的端口分到 VLAN 20。普通 PC 不需要自己加 VLAN 标签，交换机根据接入端口识别区域。', example: 'STU-SW Fa0/1 与 Fa0/2：switchport access vlan 10。'},
      {title: 'Trunk 带着 VLAN 标记传输', body: '一根 trunk 可以传多个 VLAN，802.1Q 标签帮助对端区分它们。需要的 VLAN 既要在交换机存在，也要被 trunk 允许通过。', example: '本方案允许 VLAN 10,20,30,99；2960 直接设置 switchport mode trunk，无需添加 trunk encapsulation 命令。'},
      {title: '单臂路由把多个网关放在一根线', body: 'R1 G0/0.10 对应 VLAN 10，G0/0.20 对应 VLAN 20，依此类推。跨 VLAN 数据经过 R1；学生之间的同 VLAN 通信通常由交换机完成。', example: 'A 去实验网站：带 VLAN 10 标记进入 R1，再以 VLAN 30 从同一物理线返回 CORE-SW。'},
      {title: '这里的网段都是直接连接', body: 'R1 四个子接口配置好且链路正常后，会出现对应的直连路由。核心方案无需配置静态路由，也没有互联网出口。先证明基础路径可用，再加访问限制。', example: '在尚未应用学生 ACL 的基线阶段，A 应能 ping 到 LAB-SRV .101。'}
    ],
    teach: [
      '让学生沿图走一次：先看 access 端口归属，再看 trunk 允许项，最后看 R1 子接口。',
      '画一根 trunk，放上四种颜色的 VLAN 标签，说明共用物理链路不等于同一个广播域。',
      '提醒学生：只创建 VLAN 名字不会产生跨 VLAN 路由，R1 子接口才是四个网关。'
    ],
    lab: [
      {title: '配置 CORE-SW', detail: '以下命令从设备 CLI 的用户模式开始。按第 01 课端口表连接后输入。管理 SVI 地址为 .115；它用于管理交换机，不承担 VLAN 间路由。', command: 'enable\nconfigure terminal\nhostname CORE-SW\nvlan 10\n name STUDENTS\nvlan 20\n name TEACHERS\nvlan 30\n name SERVERS\nvlan 99\n name MANAGEMENT\nexit\ninterface fa0/1\n switchport mode trunk\n switchport trunk allowed vlan 10,20,30,99\nexit\ninterface range g0/1 - 2\n switchport mode trunk\n switchport trunk allowed vlan 10,20,30,99\nexit\ninterface range fa0/2 - 3\n switchport mode access\n switchport access vlan 30\nexit\ninterface fa0/4\n switchport mode access\n switchport access vlan 99\nexit\ninterface vlan 99\n ip address 192.168.10.115 255.255.255.240\n no shutdown\nexit\nip default-gateway 192.168.10.113\nend\ncopy running-config startup-config'},
      {title: '配置 STU-SW', detail: '学生电脑接 Fa0/1、Fa0/2；G0/1 上联 CORE-SW。管理 SVI 地址为 .116。', command: 'enable\nconfigure terminal\nhostname STU-SW\nvlan 10\n name STUDENTS\nvlan 20\n name TEACHERS\nvlan 30\n name SERVERS\nvlan 99\n name MANAGEMENT\nexit\ninterface range fa0/1 - 2\n switchport mode access\n switchport access vlan 10\nexit\ninterface g0/1\n switchport mode trunk\n switchport trunk allowed vlan 10,20,30,99\nexit\ninterface vlan 99\n ip address 192.168.10.116 255.255.255.240\n no shutdown\nexit\nip default-gateway 192.168.10.113\nend\ncopy running-config startup-config'},
      {title: '配置 TCH-SW', detail: '教师电脑接 Fa0/1、Fa0/2；G0/1 上联 CORE-SW。管理 SVI 地址为 .117。', command: 'enable\nconfigure terminal\nhostname TCH-SW\nvlan 10\n name STUDENTS\nvlan 20\n name TEACHERS\nvlan 30\n name SERVERS\nvlan 99\n name MANAGEMENT\nexit\ninterface range fa0/1 - 2\n switchport mode access\n switchport access vlan 20\nexit\ninterface g0/1\n switchport mode trunk\n switchport trunk allowed vlan 10,20,30,99\nexit\ninterface vlan 99\n ip address 192.168.10.117 255.255.255.240\n no shutdown\nexit\nip default-gateway 192.168.10.113\nend\ncopy running-config startup-config'},
      {title: '配置 R1 的四个网关', detail: '使用 2911 的 G0/0；其他型号需替换接口编号。物理接口必须 no shutdown。子接口编号便于阅读，真正的 VLAN 对应由 encapsulation dot1Q 指定。', command: 'enable\nconfigure terminal\nhostname R1\ninterface g0/0\n no ip address\n no shutdown\nexit\ninterface g0/0.10\n encapsulation dot1Q 10\n ip address 192.168.10.1 255.255.255.192\nexit\ninterface g0/0.20\n encapsulation dot1Q 20\n ip address 192.168.10.65 255.255.255.224\nexit\ninterface g0/0.30\n encapsulation dot1Q 30\n ip address 192.168.10.97 255.255.255.240\nexit\ninterface g0/0.99\n encapsulation dot1Q 99\n ip address 192.168.10.113 255.255.255.240\nend\nshow ip interface brief\nshow ip route\ncopy running-config startup-config'},
      {title: '验证无 ACL 的基线', detail: '各 PC 先 ping 自己的网关。Student-A 再 ping .101；此阶段还未应用 ACL，应该可达。交换机执行 show vlan brief、show interfaces trunk。若失败，先修复 IP、端口 VLAN、trunk 与接口状态。保存 00_baseline.pkt；后续受限版中 .101 的 ping 失败是政策预期。', command: 'show vlan brief\nshow interfaces trunk'}
    ],
    questions: [
      {question: 'CORE-SW 到 R1 的一根线需要传四个 VLAN，应使用？', options: ['只属于 VLAN 10 的 access', '允许所需 VLAN 的 802.1Q trunk', '给每台学生 PC 增加静态路由'], correctIndex: 1, explanation: 'trunk 把多 VLAN 流量带给 R1；R1 按标签交给对应子接口。'},
      {question: 'Student-A 与 Student-B 同在 VLAN 10，它们的本地通信会经过学生子接口 ACL 吗？', options: ['通常不会，交换机可以直接转发', '每一个帧都必须进入 R1', '只有获授权后才能本地通信'], correctIndex: 0, explanation: '同 VLAN 内通信通常不经过路由器。路由接口 ACL 不能被当成同 VLAN 内所有流量的保护。'}
    ],
    takeaway: 'Access 定义终端所属区域，trunk 传递多个区域，R1 子接口连接这些区域。'
  },
  {
    id: 'acl', number: '04', title: '先限制，再精确开放', subtitle: '扩展 ACL 与网站服务',
    lead: '基础通信正常后，给学生跨区请求加一份访问清单。我们只允许公共网站 HTTP 和到本网关的 ping，教师区、管理区及其余服务都拒绝。',
    concepts: [
      {title: '规则要同时看来源、目的与服务', body: '扩展 ACL 可以按源 IP、目的 IP、协议和端口筛选。TCP 80 是本实验的 HTTP 服务。host 表示只匹配一个地址；0.0.0.63 是学生 /26 子网的通配符掩码，不是接口掩码。', example: 'permit tcp 192.168.10.0 0.0.0.63 host 192.168.10.100 eq 80'},
      {title: '从上往下，第一条匹配就决定结果', body: '清单先列公共许可和本网关 ICMP，再为授权留出序号 30，随后拒绝教师区、管理区及其他流量。许可如果排在覆盖它的拒绝之后，就没有机会命中。', example: '90 deny ip any any 会拒绝没有被前面规则许可的流量。'},
      {title: '应用在学生入口的入方向', body: '只创建 ACL 不会过滤流量。把 STUDENT_POLICY 绑定到 G0/0.10 的 in 方向，检查从学生 VLAN 进入 R1 的 IP 数据包。服务器回复从学生接口离开，不经过这份入方向 ACL。', example: 'ip access-group STUDENT_POLICY in'},
      {title: 'HTTP 测试与 ping 测试不同', body: '允许网站 TCP 80 不会自动允许 ICMP。受限配置中学生 ping 公共服务器也会失败，但浏览公共网页应该成功。普通教师访问两个网站不受学生接口这份 ACL 的限制。', example: '打开 http://192.168.10.100 才是在测试公共网站许可。'}
    ],
    teach: [
      '把请求念成一句话：来自哪台电脑，要到哪台服务器，使用哪个服务。',
      '带学生逐行读清单，找到第一条匹配，然后停止。不要继续往后找自己喜欢的许可。',
      '让学生预测：公共网页能打开，为什么 ping 公共服务器仍可能失败？'
    ],
    lab: [
      {title: '启动两个 HTTP 网站', detail: 'PUBLIC-SRV 和 LAB-SRV → Services → HTTP → On。公共首页写“公共课程资料”，实验首页写“受限实验资源”。在未应用 ACL 的基线中，从 Student-A 与 Teacher-A 用 Desktop → Web Browser 分别访问 http://192.168.10.100 和 http://192.168.10.101，确认两个服务都已运行。'},
      {title: '创建未授权清单', detail: '以下方案使用命名 ACL 序号。当前 Packet Tracer 设备尚未完成预实验，应先确认可输入并插入这些序号；遇到 Invalid input 不要继续当成成功。第 05 课提供无序号的完整清单切换方法。序号 30 暂时空着。', command: 'enable\nconfigure terminal\nip access-list extended STUDENT_POLICY\n 10 permit tcp 192.168.10.0 0.0.0.63 host 192.168.10.100 eq 80\n 20 permit icmp 192.168.10.0 0.0.0.63 host 192.168.10.1 echo\n 70 deny ip any 192.168.10.64 0.0.0.31\n 80 deny ip any 192.168.10.112 0.0.0.15\n 90 deny ip any any\nexit\ninterface g0/0.10\n ip access-group STUDENT_POLICY in\nend\nshow access-lists\nshow ip interface g0/0.10\ncopy running-config startup-config'},
      {title: '用对照组验证默认隔离', detail: 'A、B 打开公共网站应成功；打开实验网站应失败。学生 ping .1 应成功，ping 教师 .66 应失败。Teacher-A 打开两个网站应成功。不要为了让 ping .100 通过而加入 permit ip any any。'},
      {title: '记录并保存受限版本', detail: '记录“发起电脑、目标、协议、预期、实际”。核对 G0/0.10 的入方向清单和规则顺序；Simulation 可以辅助观察丢弃位置。命中计数与事件显示以本机预实验为准。保存 01_restricted.pkt。', command: 'show access-lists\nshow ip interface g0/0.10'}
    ],
    questions: [
      {question: 'A 可以打开公共网页，但 ping .100 失败，最合理的解释是？', options: ['HTTP 许可只开放 TCP 80，没有开放该目标的 ICMP', '浏览器一定使用了另一台服务器', '所有 ACL 都失效了'], correctIndex: 0, explanation: 'HTTP 和 ping 使用不同协议。当前政策只允许学生对本网关发 ICMP echo。'},
      {question: '创建了 STUDENT_POLICY，但学生仍能访问所有区域。首先检查什么？', options: ['学生电脑是否用了好看的图标', '是否绑定到正确子接口的入方向', '把最后的拒绝删掉'], correctIndex: 1, explanation: 'ACL 必须被应用到流量经过的位置才生效。本方案应在 R1 G0/0.10 绑定 in。'}
    ],
    takeaway: '验证特定服务，按顺序匹配规则，并确认清单已经应用到正确入口。'
  },
  {
    id: 'grant', number: '05', title: '教师批准与撤销', subtitle: '只给 Student-A 打开实验网站',
    lead: '专用 AUTH-PC 通过 SSH 管理 R1。教师先确认申请对象是 .11，再增加一条仅指向实验 HTTP 服务的许可。每次更改都用 A 和 B 对照测试。',
    concepts: [
      {title: '管理入口需要单独保护', body: '只拒绝学生进入管理 VLAN 不足以保护所有设备接口地址。VTY 是远程登录入口，应只接受 AUTH-PC .114，使用本地账号认证并仅允许 SSH。', example: 'access-class MGMT_ONLY in 限制谁可以发起远程登录。'},
      {title: '授权是一条精确许可', body: '序号 30 只匹配源 .11、目的 .101、TCP 80。它不会开放 B、教师电脑、SSH 或服务器的所有服务。ACL 不记学生姓名，改用他人的授权 IP 可能冒用许可。', example: '30 permit tcp host 192.168.10.11 host 192.168.10.101 eq 80'},
      {title: '撤销要用新的请求验证', body: '删除许可后，A 新发出的实验 HTTP 请求应被拒绝。已下载的文件和已经显示或缓存的网页内容不会被 ACL 自动收回。', example: '重新发起网页请求并观察 Simulation 中的新 TCP/HTTP 流量，不能只看旧页面仍在屏幕上。'},
      {title: '同 VLAN 流量绕过路由入口', body: '受限服务器必须留在独立 VLAN 30。如果服务器和学生放在同一个 VLAN、同一个子网，流量可直接由交换机转发，学生入口 ACL 就看不到它。', example: '把 LAB-SRV 改放 VLAN 10 是改变安全边界，不能当作授权方法。'}
    ],
    teach: [
      '请学生 A 提出“我需要打开实验网站”的申请，教师先核对目标电脑和服务。',
      '把授权规则逐段翻译：只允许这台电脑，到这台服务器，使用这个端口。',
      '授权后先测 A，再测 B，再测教师区隔离，三项都正确才算通过。',
      '撤销时让学生重新请求资源，解释旧网页或已下载内容为何不会消失。'
    ],
    lab: [
      {title: '在 R1 配置 SSH 与管理来源限制', detail: '在本地 CLI 先做管理配置。把 <YOUR_LAB_PASSWORD> 替换为只用于本实验的口令，不要原样输入占位符。crypto key generate rsa 后出现位数提示时输入 1024；若设备要求另一种语法，以本机提示为准。以下覆盖 vty 0–4；若 show running-config 还列出 vty 5–15，也对它施加 login local、transport input ssh、access-class 三项。交换机若开启 SSH，同样应用来源限制，使用各自 .115/.116/.117 管理地址。', command: 'enable\nconfigure terminal\nip domain-name campus.lab\nusername labteacher privilege 15 secret <YOUR_LAB_PASSWORD>\ncrypto key generate rsa\n1024\nip ssh version 2\nip access-list standard MGMT_ONLY\n permit host 192.168.10.114\n deny any\nexit\nline vty 0 4\n login local\n transport input ssh\n access-class MGMT_ONLY in\nend\nshow ip ssh\nshow running-config\ncopy running-config startup-config'},
      {title: '从授权终端登录并检查', detail: 'AUTH-PC → Desktop → Command Prompt 执行 SSH，输入刚设置的实验口令。普通教师电脑和学生电脑尝试 SSH 应失败；AUTH-PC 应能登录。教师在本实验中使用管理员权限，真实业务中应另行设计职责与审批权限。', command: 'ssh -l labteacher 192.168.10.113'},
      {title: '批准 A，然后对照验证', detail: '确认第 04 课序号语法在所选设备可用后，从 R1 特权模式输入下面命令。查看 30 排在 70/80/90 前。A 新开实验网站应成功，B 仍失败；学生仍不能 ping 教师或 SSH 登录设备。保存 02_studentA_authorized.pkt。', command: 'configure terminal\nip access-list extended STUDENT_POLICY\n 30 permit tcp host 192.168.10.11 host 192.168.10.101 eq 80\nend\nshow access-lists\ncopy running-config startup-config'},
      {title: '撤销 A 并复测', detail: '支持 ACL 序号时，只删除 30。保留公共网站、本网关检查及拒绝项。A 发起新的实验 HTTP 请求应失败，公共网站仍成功；B 始终失败。保存 03_revoked.pkt。', command: 'configure terminal\nip access-list extended STUDENT_POLICY\n no 30\nend\nshow access-lists\ncopy running-config startup-config'},
      {title: '若设备不支持序号：切换完整清单', detail: '由教师在控制台操作。先建立下面两份独立完整清单，它们以输入顺序匹配；全部核对后才绑定 BASE。授权时把接口绑定改为 STUDENT_POLICY_A，撤销改回 STUDENT_POLICY_BASE。不删除正在使用的清单，也不把新许可追加到最终 deny 后。此备选方法同样需本机预实验。', command: 'enable\nconfigure terminal\nip access-list extended STUDENT_POLICY_BASE\n permit tcp 192.168.10.0 0.0.0.63 host 192.168.10.100 eq 80\n permit icmp 192.168.10.0 0.0.0.63 host 192.168.10.1 echo\n deny ip any 192.168.10.64 0.0.0.31\n deny ip any 192.168.10.112 0.0.0.15\n deny ip any any\nexit\nip access-list extended STUDENT_POLICY_A\n permit tcp 192.168.10.0 0.0.0.63 host 192.168.10.100 eq 80\n permit icmp 192.168.10.0 0.0.0.63 host 192.168.10.1 echo\n permit tcp host 192.168.10.11 host 192.168.10.101 eq 80\n deny ip any 192.168.10.64 0.0.0.31\n deny ip any 192.168.10.112 0.0.0.15\n deny ip any any\nexit\ninterface g0/0.10\n ip access-group STUDENT_POLICY_BASE in\nend\nshow access-lists'}
      ,{title: '无序号备选：批准 A 的完整操作', detail: '只在上一项两份完整清单都已创建并核对后执行。此步骤替换接口当前绑定的清单，保留既有拒绝边界。不要把备用清单的命令与序号方案混在一起。', command: 'configure terminal\ninterface g0/0.10\n ip access-group STUDENT_POLICY_A in\nend\nshow access-lists\nshow ip interface g0/0.10\ncopy running-config startup-config'},
      {title: '无序号备选：撤销 A 的完整操作', detail: '改回完整的基线清单。A 的新实验网页请求应失败，公共网页仍成功；B 仍应失败。', command: 'configure terminal\ninterface g0/0.10\n ip access-group STUDENT_POLICY_BASE in\nend\nshow access-lists\nshow ip interface g0/0.10\ncopy running-config startup-config'}
    ],
    questions: [
      {question: 'A 获授权，B 也能打开实验网站，应优先检查？', options: ['是否误把来源写成整个学生子网或 any', 'A 的桌面颜色', '把教师网关换成 .1'], correctIndex: 0, explanation: '正确许可应是 host 192.168.10.11。来源过宽可能把其他学生一起开放。'},
      {question: '撤销许可后，A 屏幕上仍显示刚打开的实验网页，这能证明撤销失败吗？', options: ['能，旧内容必须立即消失', '不能，应发起新请求并观察结果', '能，ACL 能删除已经下载的文件'], correctIndex: 1, explanation: 'ACL 过滤新的经过路由器的数据包，不会收回已送达的内容。新请求失败才是撤销验证的核心。'}
    ],
    takeaway: '授权要精确，撤销要复测；IP 许可与真实用户身份、网页内容权限是不同层面的设计。'
  },
  {
    id: 'trouble', number: '06', title: '用证据定位故障', subtitle: '从现象到原因，再恢复完整政策',
    lead: '“打不开”只是现象。它可能来自地址、VLAN、trunk、路由、ACL 或 HTTP 服务。每次只加入一个错误，先预测，再收集证据，最后修复并复测整张访问表。',
    concepts: [
      {title: '先分清故障发生在哪一层', body: '本网关不通先查 IP、掩码、接入 VLAN 和链路；公共网页也不通再查服务器区 trunk、网关和 HTTP 服务；只有 A 的实验网站不通时再查授权规则与顺序。', example: 'A 连 .1 都 ping 不通，先查 Fa0/1 是否仍属于 VLAN 10。'},
      {title: '拒绝可能是正确结果', body: '未授权学生访问实验网站失败、学生 ping 教师失败，都符合政策。把每个失败都修成成功，会破坏隔离。判断依据应是预期矩阵。', example: 'B 在 A 获授权后仍打不开实验网站，是对照测试通过。'},
      {title: '网络许可不保证服务运行', body: '路由和 ACL 可以允许请求，但 HTTP 服务关闭时仍无法浏览。教师能否打开网站是一个对照，Server 的 Services → HTTP 是直接证据。', example: 'A 已授权且教师也打不开 .101：检查 LAB-SRV 的 HTTP 状态。'},
      {title: '修复后检查没有多开放', body: '每次修改后测试公共服务、A 授权状态、B 拒绝、教师隔离和管理入口。保存原因和证据，而不只保存“现在成功了”的截图。', example: '加 permit ip any any 让网页成功，却同时开放教师与管理区，不算正确修复。'}
    ],
    teach: [
      '先让学生说出预期：这个请求本来应该成功还是失败？',
      '每次只引入一个故障，避免同时修改三个地方后猜测原因。',
      '要求“现象 → 证据 → 定位 → 修改 → 复测”五步说明。',
      '最后请学生解释 IP 授权的边界：冒用地址、同 VLAN 绕过、已下载内容都不由本方案解决。'
    ],
    lab: [
      {title: '故障 1：许可放在拒绝之后', detail: '在备份副本中构造错误：把 A 的许可放到 deny ip any any 后面。预测 A 仍失败，检查 show access-lists 找到第一条匹配。恢复到前置序号 30，或切回核对过的完整授权清单。不要在正式正确文件上丢失原配置。', command: 'show access-lists\nshow ip interface g0/0.10'},
      {title: '故障 2：B 接错 VLAN', detail: '在 STU-SW 把 Fa0/2 改为 access vlan 20，但 B 保留 .12/26 与网关 .1。观察 B 到 .1 失败。检查端口归属后把它改回 VLAN 10；不要靠把 B 改成教师 IP 来绕过学生政策。', command: 'show vlan brief\n! 修复，在 STU-SW 执行：\nconfigure terminal\ninterface fa0/2\n switchport access vlan 10\nend'},
      {title: '故障 3：R1 链路遗漏服务器 VLAN', detail: '在 CORE-SW Fa0/1 的 trunk 允许列表里暂时去掉 VLAN 30。教师与已授权 A 都可能无法访问网站，说明不是单学生许可问题。核对链路的允许项，再恢复四个 VLAN。', command: 'show interfaces trunk\n! 修复，在 CORE-SW 执行：\nconfigure terminal\ninterface fa0/1\n switchport trunk allowed vlan 10,20,30,99\nend'},
      {title: '故障 4：实验网站服务关闭', detail: 'LAB-SRV → Services → HTTP → Off。保持 A 授权和正确网络配置，比较 A 与 Teacher-A 的新 HTTP 请求。再打开 HTTP，重新访问。ping 在受限学生政策下不是网站服务检查。'},
      {title: '提交验证记录', detail: '每个故障写一行：预期、现象、检查证据、原因、修复与复测。保存正确的未授权、A 授权、撤销三份 .pkt；附 HTTP 结果、ACL 顺序与拓扑截图。网站动画是学习辅助，真实 Packet Tracer 文件与测试证据仍需自己完成。', command: 'show ip interface brief\nshow ip route\nshow access-lists\n! 在交换机执行：\nshow vlan brief\nshow interfaces trunk'}
    ],
    questions: [
      {question: 'B 未授权，实验网页失败，但公共网页成功。应如何处理？', options: ['加入 permit ip any any', '删除学生 ACL', '这是政策预期，继续按矩阵验证其他项目'], correctIndex: 2, explanation: '未授权学生只能使用公共网站。正确的拒绝不是需要修复的故障。'},
      {question: 'A 已授权，教师也打不开实验网站。下一步更有帮助的是？', options: ['先给全部学生授权', '检查服务器 HTTP、IP、网关与 VLAN 30 路径', '把服务器移入学生 VLAN'], correctIndex: 1, explanation: '教师没有经过学生入方向 ACL 的限制。两者同样失败提示公共路径或应用服务问题，应收集证据再修改。'}
    ],
    takeaway: '正确排错既要恢复该成功的访问，也要保留该拒绝的访问。'
  }
];
