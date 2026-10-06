# 网络动画实验室与校园授权课堂 · EE6108

两套中文网络工作坊学习与授课网页：基础五课讲解子网、ARP、交换、网关与静态路由；校园授权六课讲解学生、教师与访客分区、VLAN、ACL，以及按电脑、按网站独立授予和撤销访问许可。

## 校园网络授权六课

入口：`dist/campus.html`。页面顶部直接提供 **知识讲解、动画与授权、Packet Tracer 步骤、本课测验** 四个入口。

1. **校园分区**：学生、教师、访客、服务器、管理设备分别放入五个 VLAN，先写访问需求。
2. **地址规划**：为五个区域分配子网，用容量练习验证终端和网关的地址需求。
3. **VLAN 与单臂路由**：区分 access、trunk 和 R1 子接口，观察 CORE→R1→CORE 的路径。
4. **ACL 规则**：按来源、目的、协议和端口筛选，第一条匹配决定许可或拒绝。
5. **教师授权与撤销**：对 Student-A、Student-B、Guest-1 分别授权课程 `.102` 和实验 `.101` 的 TCP 80；一个网站的许可不开放另一个网站，也不改变其他电脑的许可。
6. **故障排查**：比较 ACL 顺序错误、服务器 VLAN 路径中断和 HTTP 服务关闭。

每课都有通俗解释、授课话术、设备配置步骤和两道测验，共 12 题。动画可以暂停、单步、调整速度、查看设备地址，并显示当前首条 ACL 匹配和学生 A/B、教师、访客访问三个网站的权限对照表。

建议演示：访客访问公开网站 → 课程网站默认受限 → 只给 Guest-1 开放课程 → 检查实验仍受限、学生权限不变 → 撤销课程许可。随后切换教师，验证三个网站默认可达，再引入一个故障并解释失败位置。

| 访问者 | 公开网站 PUB | 课程网站 COURSE | 实验网站 LAB |
| --- | --- | --- | --- |
| 学生 A / B | 默认可访问 | 每台电脑单独授权 | 每台电脑单独授权 |
| 访客 Guest-1 | 默认可访问 | 单独授权 | 单独授权 |
| 教师 A / B | 默认可访问 | 默认可访问 | 默认可访问 |

以上默认状态以网络及 HTTP 服务正常为前提。普通教师电脑的教学网站访问权限与专用 AUTH-PC 的设备管理权限分别配置。

## 基础网络五课

1. **地址规划**：IP、子网掩码、可用地址与 VLSM；用容量滑块比较 /24–/30。
2. **同区通信**：ARP 查询目标 MAC，交换机学习源 MAC，观察 ICMP 请求与回复。
3. **两个子网**：默认网关、R1 的直连路由，以及跨链路重新封装的帧。
4. **两台路由器**：配置 R1 去 C 区、R2 回 A/B 区的静态路由。
5. **故障排查**：每次引入一个错误，按证据定位、修复并复测。

每课都有「先学懂」「怎样讲给学生」「动手做实验」三部分，还有学习目标、预测题、配置参考和成功判据。

## 演示

- 自动播放、暂停、上一步／下一步、速度控制、可点击步骤条。
- 三种通信路径：A1→A2、A1→B1、A1→C1。
- 三种故障：错误网关、缺少回程路由、错误掩码；可修复后重放。
- 点击电脑、交换机、路由器，查看示例配置。
- 「进入演示模式」隐藏学习卡片，便于课堂投屏。
- 键盘：空格播放／暂停，← → 单步，R 重置。输入框与选择框内不会触发这些快捷键。

## 本地运行

无需安装 npm 包或构建工具，使用 Python 的静态服务器即可：

```sh
python3 -m http.server 4318 --bind 127.0.0.1 --directory dist
```

浏览器打开 `http://127.0.0.1:4318/campus.html` 进入校园授权课堂，或打开 `http://127.0.0.1:4318/` 进入基础五课。网页使用 ES modules，源码版通过 HTTP 服务器运行。

## 离线演示

下载仓库 ZIP 并解压，在 `offline/` 中用浏览器打开：

- [校园网络授权-学习网站.html](offline/校园网络授权-学习网站.html)：校园授权六课。
- [网络动画实验室-离线版.html](offline/网络动画实验室-离线版.html)：基础网络五课。

两个文件放在同一目录时，可用网页入口相互切换。GitHub 的 HTML 文件预览展示源码；请下载后用浏览器打开，或使用上面的本地服务器。

从源码重新生成两份单文件网页：

```sh
python3 scripts/build-offline.py --page campus --output "offline/校园网络授权-学习网站.html"
python3 scripts/build-offline.py --page foundation --output "offline/网络动画实验室-离线版.html"
```

## 校园授权课地址规划

| 区域 | VLAN | 子网 | 掩码 | 网关 | 示例设备 |
| --- | --- | --- | --- | --- | --- |
| 学生 | 10 | 192.168.10.0/26 | 255.255.255.192 | .1 | Student-A .11；Student-B .12 |
| 教师 | 20 | 192.168.10.64/27 | 255.255.255.224 | .65 | Teacher-A .66；Teacher-B .67 |
| 服务器 | 30 | 192.168.10.96/28 | 255.255.255.240 | .97 | PUBLIC .100；LAB .101；COURSE .102 |
| 管理 | 99 | 192.168.10.112/28 | 255.255.255.240 | .113 | AUTH-PC .114；四台交换机 .115–.118 |
| 访客 | 40 | 192.168.10.128/27 | 255.255.255.224 | .129 | Guest-1 .130 |

`.x` 简写均以 `192.168.10` 开头。校园课的五个 VLAN 直接连接 R1，无需静态路由。下面的基础课使用双路由器拓扑与不同的管理/链路规划，搭实验时选定一套，避免混用地址与接口命令。

## 基础五课地址规划

| 用途 | 子网 | 掩码 | 网关／接口 |
| --- | --- | --- | --- |
| A 区：50 台终端 + 网关 | 192.168.10.0/26 | 255.255.255.192 | 192.168.10.1 |
| B 区：25 台终端 + 网关 | 192.168.10.64/27 | 255.255.255.224 | 192.168.10.65 |
| C 区：10 台终端 + 网关 | 192.168.10.96/28 | 255.255.255.240 | 192.168.10.97 |
| R1–R2 连接 | 192.168.10.112/30 | 255.255.255.252 | R1 .113；R2 .114 |

每区两台电脑仅代表实际规划容量。R1 需要至少三个可用以太网接口，具体端口名称以所选设备为准。操作指南中的尖括号接口名必须替换为真实接口；`#` 开头为说明，按设备分段执行命令。

## 校园授权课的教学边界

授权按钮仅修改网页教学模型，不会配置真实网络或 Packet Tracer。教师在本实验中兼任网络管理员，通过专用 AUTH-PC SSH 到 R1 `.113` 修改 ACL；普通教师电脑不自动获得设备管理权限。

许可按固定源 IP 匹配，不认证真实学生身份，也不提供网页审批或自动到期。服务器留在独立 VLAN；同 VLAN 流量通常不经过路由入口 ACL。HTTP 许可不等于 ping 许可。撤销后应测试新请求，已显示、缓存或下载的内容不会自动消失。

实际设备命令及对应 `.pkt` 尚需在所选 Packet Tracer 设备上预实验；讲义提供 ACL 序号方式及完整清单切换备选。按老师要求保存默认受限、部分网站授权、撤销三种状态的 `.pkt` 和访问测试证据。拓扑共 14 台设备：1 台路由器、4 台交换机、6 台电脑、3 台服务器。

## 基础五课的教学边界

这是概念动画，并非完整网络模拟器。正式设备配置与连通性验证需要在 Packet Tracer 中完成并保存为 `.pkt`。首次 ARP 显式播放，后续必要邻居条目假定已缓存；MAC 以设备／接口标签表示。示例初始 TTL 为 64，不包含 NAT。

错误掩码场景统一为 **C1 改为 /24，关闭 R2 的 C 区接口 Proxy ARP，并清除 C1 的 ARP 缓存**。请求可到 C1，回复因错误邻居判断无法发出。Cisco 设备的 Proxy ARP 可能暂时掩盖错误，因此实际实验要核对该条件。

## 文件

- `dist/index.html`：页面结构。
- `dist/styles.css`：桌面、移动端与投屏布局。
- `dist/app.js`：动画控制、设备配置、讲义与互动。
- `dist/model.js`：正确路径、故障路径、IP／MAC／TTL 解释。
- `dist/lessons.js`：五课目标、任务、地址表和测验。
- `dist/study.js`：基础知识、讲解话术、实操与验收。
- `dist/campus.html` / `campus.css`：校园课堂页面与响应式布局。
- `dist/campus.js`：六课导航、授权操作、动画、测验和可选浏览器教学工具。
- `dist/campus-model.js`：精确 ACL 匹配、授权生命周期及故障路径模型。
- `dist/campus-lessons.js`：六课讲义、授课话术、命令与 12 道测验。
- `offline/`：可直接打开的两份单文件网页。
- `scripts/build-offline.py`：基础课与校园课的离线 HTML 打包。

## 参考资料

技术解释参考 Cisco 官方文档：

- [Packet Tracer Features](https://tutorials.ptnetacad.net/help/default/intro.htm)
- [Configure IP Access Lists](https://www.cisco.com/c/en/us/support/docs/security/ios-firewall/23602-confaccesslists.html)
- [Router-on-a-stick Inter-VLAN Routing Lab](https://contenthub.netacad.com/courses/srwe-dl/_common/4.2.8-lab---configure-router-on-a-stick-inter-vlan-routing.pdf)
- [Host and Subnet Quantities](https://www.cisco.com/c/en/us/support/docs/ip/routing-information-protocol-rip/13790-8.html)
- [Basic IP Routing](https://www.cisco.com/c/en/us/td/docs/routers/ios-xe/ip-routing/b-ip-routing/m_iri-iprouting.html)
- [Address Resolution Protocol](https://www.cisco.com/c/en/us/td/docs/ios-xml/ios/ipaddr_arp/configuration/15-s/arp-15-s-book/Configuring-Address-Resolution-Protocol.html)
- [Switch MAC Address Management](https://www.cisco.com/c/en/us/td/docs/switches/lan/catalyst3560/software/release/15-0_2_se/configuration/guide/scg3560/swadmin.html)

仓库只包含自行编写的网页与教学解释，不包含课程原始文档、同学分组名单或 Cisco 软件安装包。
