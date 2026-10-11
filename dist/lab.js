const selected = key => document.querySelector(`[data-grant="${key}"]`).checked;
function updateCommands() {
  const studentBits = ['bl','bc','al','ac'].map(key => Number(selected(key))).join('');
  const guestBits = ['gl','gc'].map(key => Number(selected(key))).join('');
  const studentACL = studentBits === '0000' ? 'STUDENT_POLICY' : `STUDENT_G${studentBits}`;
  const guestACL = guestBits === '00' ? 'GUEST_POLICY' : `GUEST_G${guestBits}`;
  for (const [group, vlan, acl] of [['student',10,studentACL],['guest',40,guestACL]]) {
    document.getElementById(`${group}-command`).textContent = `configure terminal\ninterface GigabitEthernet0/0.${vlan}\nip access-group ${acl} in\nend`;
    document.getElementById(`${group}-status`).textContent = `当前生成：${acl} · 公开 HTTP 保留`;
  }
}
document.querySelectorAll('[data-grant]').forEach(input => input.addEventListener('change',updateCommands));
document.querySelectorAll('[data-copy]').forEach(button => button.addEventListener('click',async () => {
  const command=document.getElementById(button.dataset.copy).textContent;
  try { await navigator.clipboard.writeText(command); document.getElementById('copy-status').textContent='已复制。请在 AUTH 登录的 R1 SSH 会话中执行，然后重新发起网页请求。'; }
  catch { document.getElementById('copy-status').textContent='浏览器未允许复制，请选中上方命令手动复制。'; }
}));
updateCommands();
