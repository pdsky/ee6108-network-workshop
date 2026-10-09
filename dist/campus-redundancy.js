import { evaluateAccess } from './campus-model.js?v=access-20261009-r3';

export const REDUNDANCY_NODES = Object.freeze({
  SA:{name:'Student-A',kind:'pc',backup:'Student-A-B'}, SB:{name:'Student-B',kind:'pc',backup:'Student-B-B'},
  TA:{name:'Teacher-A',kind:'pc',backup:'Teacher-A-B'}, TB:{name:'Teacher-B',kind:'pc',backup:'Teacher-B-B'},
  G1:{name:'Guest-1',kind:'pc',backup:'Guest-1-B'}, AUTH:{name:'AUTH-PC',kind:'pc',backup:'AUTH-PC-B'},
  SS:{name:'STU-SW',kind:'access',backup:'STU-SW-B'}, GS:{name:'GUEST-SW',kind:'access',backup:'GUEST-SW-B'},
  TS:{name:'TCH-SW',kind:'access',backup:'TCH-SW-B'}, CORE:{name:'CORE-SW',kind:'core',backup:'CORE-SW-B'},
  R1:{name:'R1',kind:'router',backup:'R2'},
  SERV:{name:'SRV-SW',kind:'access',backup:'SRV-SW-B'}, MGMT:{name:'MGMT-SW',kind:'access',backup:'MGMT-SW-B'},
  PUB:{name:'PUBLIC-SRV',kind:'server',backup:'PUBLIC-SRV-B'}, COURSE:{name:'COURSE-SRV',kind:'server',backup:'COURSE-SRV-B'}, LAB:{name:'LAB-SRV',kind:'server',backup:'LAB-SRV-B'}
});
const R_ACTOR_SWITCH={SA:'SS',SB:'SS',TA:'TS',G1:'GS'};
const R_TARGET_NODE={public:'PUB',course:'COURSE',lab:'LAB',teacher:'TA',management:'AUTH'};
const R_BACKUP_ID=id => `${id}-B`;
export function redundancyNodeName(id) {return id.endsWith('-B') ? REDUNDANCY_NODES[id.slice(0,-2)].backup : REDUNDANCY_NODES[id].name;}
export function redundancyEdges() {
  const edges=[['CORE','CORE-B'],['R1','CORE'],['R1-B','CORE-B']];
  for(const access of ['SS','GS','TS','SERV','MGMT']) for(const member of [access,R_BACKUP_ID(access)]) for(const core of ['CORE','CORE-B']) edges.push([member,core]);
  for(const [host,access] of Object.entries({SA:'SS',SB:'SS',TA:'TS',TB:'TS',G1:'GS',AUTH:'MGMT',PUB:'SERV',COURSE:'SERV',LAB:'SERV'})) edges.push([host,access],[R_BACKUP_ID(host),R_BACKUP_ID(access)]);
  return edges;
}
function rBfs(start,end,edges) {
  const queue=[[start]],seen=new Set([start]);
  while(queue.length){const path=queue.shift(),last=path.at(-1); if(last===end)return path; for(const [a,b] of edges){const next=a===last?b:b===last?a:null;if(next&&!seen.has(next)){seen.add(next);queue.push([...path,next]);}}}
  return null;
}
/** One physical failure, preconfigured HSRP/RSTP, explicit manual endpoint recovery. */
export function evaluateRedundancy(settings, options) {
  if(!settings||typeof settings!=='object')throw new TypeError('Expected redundancy settings.');
  const {enabled=true,failedNode='none',failedLink='none',manualTakeover=false,aclSynchronized=true}=settings;
  if([enabled,manualTakeover,aclSynchronized].some(v=>typeof v!=='boolean'))throw new TypeError('Backup flags must be boolean.');
  const ids=Object.keys(REDUNDANCY_NODES).flatMap(id=>[id,R_BACKUP_ID(id)]),allEdges=redundancyEdges();
  if(failedNode!=='none'&&!ids.includes(failedNode))throw new TypeError('Unknown failed node.');
  if(failedLink!=='none'&&!allEdges.some(edge=>edge.join('|')===failedLink))throw new TypeError('Unknown failed link.');
  if(failedNode!=='none'&&failedLink!=='none')throw new TypeError('This lab isolates one failure at a time.');
  const policy=evaluateAccess(options), actor=options.actor??'SA',target=options.target??'course',destination=R_TARGET_NODE[target];
  let edges=allEdges.filter(([a,b])=>(enabled||(!a.endsWith('-B')&&!b.endsWith('-B')))&&a!==failedNode&&b!==failedNode&&[a,b].join('|')!==failedLink);
  let start=actor,end=destination;
  // A spare endpoint has the same logical role only after the failed primary is offline and an explicit manual action.
  for(const [host,access] of [[actor,R_ACTOR_SWITCH[actor]],[destination,target==='teacher'?'TS':target==='management'?'MGMT':'SERV']]){
    if(enabled&&manualTakeover){
      const activeHost=failedNode===host?R_BACKUP_ID(host):host;
      const originalEdge=`${host}|${access}`;
      if(failedNode===host||failedNode===access||failedLink===originalEdge){
        const activeAccess=failedNode===access?R_BACKUP_ID(access):access;
        edges.push([activeHost,activeAccess]);
        if(host===actor)start=activeHost;else end=activeHost;
      }
    }
  }
  // Gateway peer selection follows loss of R1's own trunk/core reachability, not arbitrary request permission.
  const primaryUp=edges.some(([a,b])=>a==='R1'&&b==='CORE');
  const secondaryUp=enabled&&edges.some(([a,b])=>a==='R1-B'&&b==='CORE-B');
  const gateway=primaryUp?'R1':secondaryUp?'R1-B':null;
  const upstream=gateway?rBfs(start,gateway,edges):null,downstream=gateway?rBfs(gateway,end,edges):null;
  const connected=Boolean(upstream&&downstream),policyAvailable=gateway!=='R1-B'||aclSynchronized;
  let reason,phase;
  if(!connected){phase='disconnected';reason=enabled?'当前路径中断。终端、服务器或单网线接入端需要手动换线／接管；备用设备须在线且连通。':'没有启用备用设备与链路，主路径故障后无法恢复。';}
  else if(!policyAvailable){phase='policy_unready';reason='R2 的 ACL 尚未核对同步，扩展模型暂停放行。HSRP 不会自动复制 ACL，先同步并验证策略。';}
  else if(!policy.networkAllowed){phase='acl_denied';reason=`备用路径不会增加权限：${policy.policyName} 第 ${policy.rule.seq} 条仍然拒绝访问。`;}
  else if(!policy.allowed){phase=policy.phase;reason=policy.reason;}
  else {phase='success';reason=failedNode==='none'&&failedLink==='none'?'主路径正常，备用设备和备用上联待命。':`故障后仍可访问：${gateway==='R1-B'?'R2 接管虚拟网关；':''}连通路径恢复，原有 ACL 许可继续有效。`;}
  const fullPath=connected?[...upstream,...downstream.slice(1)]:upstream||[start];
  const routerIndex=fullPath.indexOf(gateway),path=phase==='acl_denied'||phase==='policy_unready'?fullPath.slice(0,routerIndex+1):fullPath;
  return {allowed:phase==='success',connected,policyAvailable,gateway,phase,reason,path,reply:phase==='success'?[...fullPath].reverse():[],policy,switched:path.some(id=>id.endsWith('-B')),sourceIPRole:actor,destinationIPRole:destination};
}
