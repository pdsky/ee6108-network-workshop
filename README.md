# 网络动画实验室 · EE6108

一套中文网络工作坊学习与授课网页。用同一个小型校园案例，学习子网划分、ARP、交换、默认网关、静态路由与基本排错。

## 学习顺序

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

浏览器打开 `http://127.0.0.1:4318`。网页使用 ES modules，在线版本需要 HTTP 服务器。

生成可直接双击打开、无需网络的单文件版本：

```sh
python3 scripts/build-offline.py --output network-workshop-offline.html
```

## 地址规划

| 用途 | 子网 | 掩码 | 网关／接口 |
| --- | --- | --- | --- |
| A 区：50 台终端 + 网关 | 192.168.10.0/26 | 255.255.255.192 | 192.168.10.1 |
| B 区：25 台终端 + 网关 | 192.168.10.64/27 | 255.255.255.224 | 192.168.10.65 |
| C 区：10 台终端 + 网关 | 192.168.10.96/28 | 255.255.255.240 | 192.168.10.97 |
| R1–R2 连接 | 192.168.10.112/30 | 255.255.255.252 | R1 .113；R2 .114 |

每区两台电脑仅代表实际规划容量。R1 需要至少三个可用以太网接口，具体端口名称以所选设备为准。操作指南中的尖括号接口名必须替换为真实接口；`#` 开头为说明，按设备分段执行命令。

## 教学边界

这是概念动画，并非完整网络模拟器。正式设备配置与连通性验证需要在 Packet Tracer 中完成并保存为 `.pkt`。首次 ARP 显式播放，后续必要邻居条目假定已缓存；MAC 以设备／接口标签表示。示例初始 TTL 为 64，不包含 NAT。

错误掩码场景统一为 **C1 改为 /24，关闭 R2 的 C 区接口 Proxy ARP，并清除 C1 的 ARP 缓存**。请求可到 C1，回复因错误邻居判断无法发出。Cisco 设备的 Proxy ARP 可能暂时掩盖错误，因此实际实验要核对该条件。

## 文件

- `dist/index.html`：页面结构。
- `dist/styles.css`：桌面、移动端与投屏布局。
- `dist/app.js`：动画控制、设备配置、讲义与互动。
- `dist/model.js`：正确路径、故障路径、IP／MAC／TTL 解释。
- `dist/lessons.js`：五课目标、任务、地址表和测验。
- `dist/study.js`：基础知识、讲解话术、实操与验收。
- `scripts/build-offline.py`：离线 HTML 打包。

## 参考资料

基础技术解释参考 Cisco 官方文档：

- [Host and Subnet Quantities](https://www.cisco.com/c/en/us/support/docs/ip/routing-information-protocol-rip/13790-8.html)
- [Basic IP Routing](https://www.cisco.com/c/en/us/td/docs/routers/ios-xe/ip-routing/b-ip-routing/m_iri-iprouting.html)
- [Address Resolution Protocol](https://www.cisco.com/c/en/us/td/docs/ios-xml/ios/ipaddr_arp/configuration/15-s/arp-15-s-book/Configuring-Address-Resolution-Protocol.html)
- [Switch MAC Address Management](https://www.cisco.com/c/en/us/td/docs/switches/lan/catalyst3560/software/release/15-0_2_se/configuration/guide/scg3560/swadmin.html)

仓库只包含自行编写的网页与教学解释，不包含课程原始文档、同学分组名单或 Cisco 软件安装包。
