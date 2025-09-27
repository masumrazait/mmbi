
// Mannat Bank 
(function(){
  function $(id){ return document.getElementById(id); }
  function uid(){ return 'u'+Math.random().toString(36).slice(2,9); }
  function now(){ return new Date().toISOString(); }
  function toNum(v){ const n = Number(v); return isNaN(n)?0:n; }

  let __balanceChart = null;
  window.__monthlyChartInstance = null;

  function initDemo(){
    if(!localStorage.getItem('mb_users')){
      const demo = {
        id: uid(), name: 'Masum Raza', email: 'demo@bank.com', mobile: '9999999999',
        pass: 'demo123', kyc: {}, addresses: [], beneficiaries: [], cards: [], loans: [], investments: [], budgets: [], tickets: [],
        accounts: [
          {id: 'A1', type: 'savings', name: 'Savings Account', balance: 50000},
          {id: 'A2', type: 'current', name: 'Current Account', balance: 25000},
          {id: 'FD1', type: 'fd', name: 'Fixed Deposit', balance: 100000}
        ],
        transactions: []
      };
      localStorage.setItem('mb_users', JSON.stringify([demo]));
    }
  }

  function saveUser(u){ const users = JSON.parse(localStorage.getItem('mb_users')||'[]'); const idx = users.findIndex(x=>x.id===u.id); if(idx>=0) users[idx]=u; else users.push(u); localStorage.setItem('mb_users', JSON.stringify(users)); }

  function getSession(){ return JSON.parse(localStorage.getItem('mb_session')||'null'); }
  function setSession(userId){ localStorage.setItem('mb_session', JSON.stringify({userId:userId, lastActive: now()})); }
  function clearSession(){ localStorage.removeItem('mb_session'); }
  function getSessionUser(){ const s = getSession(); if(!s) return null; const users = JSON.parse(localStorage.getItem('mb_users')||'[]'); return users.find(x=>x.id===s.userId) || null; }

  function login(email, pass){
    const users = JSON.parse(localStorage.getItem('mb_users')||'[]');
    const u = users.find(x=> (x.email===email || x.email===email.toLowerCase()) && x.pass===pass);
    if(u){ setSession(u.id); return {ok:true,user:u}; }
    return {ok:false,msg:'Invalid credentials'};
  }

  function register(data, file){
    const users = JSON.parse(localStorage.getItem('mb_users')||'[]');
    if(users.find(x=>x.email===data.email)) return {ok:false, msg:'Email already registered'};
    const id = uid();
    const u = {id, name: data.name, email: data.email, mobile: data.mobile, pass: data.pass, kyc:{}, addresses:[], beneficiaries:[], cards:[], accounts:[], transactions:[], loans:[], investments:[], budgets:[], tickets:[]};
    const opening = toNum(data.init);
    if(data.acct==='savings') u.accounts.push({id: 'A'+uid(), type:'savings', name:'Savings Account', balance: opening});
    else if(data.acct==='current') u.accounts.push({id: 'A'+uid(), type:'current', name:'Current Account', balance: opening});
    else if(data.acct==='fd') u.accounts.push({id: 'FD'+uid(), type:'fd', name:'Fixed Deposit', balance: opening});
    if(file) u.kyc[file.name] = 'uploaded';
    users.push(u); localStorage.setItem('mb_users', JSON.stringify(users));
    setSession(u.id);
    return {ok:true, user:u};
  }

  function addTransaction(user, fromAcctId, toAcctId, amount, type, meta){
    amount = toNum(amount);
    if(amount<=0) return {ok:false,msg:'Invalid amount'};
    const from = user.accounts.find(a=>a.id===fromAcctId);
    if(!from) return {ok:false,msg:'From account not found'};
    if(from.balance < amount) return {ok:false,msg:'Insufficient funds'};
    from.balance = toNum(from.balance) - amount;
    if(toAcctId){
      const to = user.accounts.find(a=>a.id===toAcctId);
      if(to) to.balance = toNum(to.balance) + amount;
    }
    const tx = {id: uid(), date: now(), from: fromAcctId, to: toAcctId||null, amount, type, meta: meta||{}};
    user.transactions = user.transactions || []; user.transactions.unshift(tx);
    saveUser(user);
    return {ok:true, tx};
  }

  function miniStatement(user, acctId, limit){
    limit = limit || 10;
    return (user.transactions||[]).filter(t => t.from===acctId || t.to===acctId).slice(0, limit);
  }

  function exportEPassbookCSV(user, acctId){
    const rows = [];
    const acct = user.accounts.find(a=>a.id===acctId);
    rows.push(['Account', acct ? acct.name : acctId]);
    rows.push(['Date','Type','From','To','Amount','Notes']);
    (user.transactions||[]).filter(t=> t.from===acctId || t.to===acctId).forEach(t=> rows.push([t.date, t.type, t.from||'', t.to||'', t.amount, (t.meta && t.meta.note)||'']));
    const csv = rows.map(r=> r.map(c=> '"'+String(c).replace(/"/g,'""') +'"').join(',')).join('\n');
    const blob = new Blob([csv], {type:'text/csv'});
    const url = URL.createObjectURL(blob);
    return url;
  }

  function exportPassbookPDF(user, acctId){
    try{
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({unit:'pt', format:'a4'});
      const acct = user.accounts.find(a=>a.id===acctId) || {name:acctId};
      function svgToDataURL(svgText){ return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgText); }
      return fetch('../assets/img/logo.svg').then(r=>r.text()).then(svgText=>{
        const imgSrc = svgToDataURL(svgText);
        const img = new Image();
        img.src = imgSrc;
        return new Promise((resolve,reject)=>{
          img.onload = function(){
            try{
              // watermark - low opacity: try to add image; if not supported, fallback to text watermark
              try{ doc.addImage(imgSrc, 'PNG', 160, 260, 300, 300, undefined, 'FAST'); }catch(e){ doc.setFontSize(40); doc.setTextColor(220); doc.text('MANNAT BANK', 180, 320); }
              // header
              doc.setFontSize(14); doc.setTextColor(40); doc.text('Mannat Bank of India - e-Passbook', 40, 40);
              doc.setFontSize(10); doc.text('Account: ' + acct.name, 40, 56);
              // prepare rows
              const rows = (user.transactions || []).filter(t=> t.from===acctId || t.to===acctId).map(t=> [t.date.split('T')[0], t.type, t.from||'', t.to||'', String(t.amount), (t.meta && t.meta.note)||'']);
              if(rows.length===0){ doc.setFontSize(11); doc.text('No transactions', 40, 100); doc.save('epassbook_'+acctId+'.pdf'); resolve(true); return; }
              doc.autoTable({ head:[['Date','Type','From','To','Amount','Notes']], body: rows, startY: 80, theme:'striped', styles:{fontSize:9}, headStyles:{fillColor:[13,110,253]} , didDrawPage: function (data) {
                const pageCount = doc.internal.getNumberOfPages();
                const str = 'Page ' + doc.internal.getCurrentPageInfo().pageNumber + ' of ' + pageCount;
                doc.setFontSize(9);
                doc.text(str, data.settings.margin.left, doc.internal.pageSize.height - 10);
                doc.setFontSize(9); doc.text('Mannat Bank of India — Demo e-Passbook', data.settings.margin.left, doc.internal.pageSize.height - 24);
              }});
              doc.save('epassbook_'+acctId+'.pdf'); resolve(true);
            }catch(e){ console.error('pdf draw error', e); doc.save('epassbook_'+acctId+'.pdf'); resolve(true); }
          };
          img.onerror = function(){ doc.setFontSize(14); doc.text('Mannat Bank of India - e-Passbook', 40, 40); doc.save('epassbook_'+acctId+'.pdf'); resolve(true); };
        });
      }).catch(err=>{ console.error(err); doc.setFontSize(14); doc.text('Mannat Bank of India - e-Passbook', 40, 40); doc.save('epassbook_'+acctId+'.pdf'); return true; });
    }catch(e){ console.error('PDF export failed', e); return false; }
  }

  // DOM
  document.addEventListener('DOMContentLoaded', function(){
    initDemo();

    // Login
    const loginForm = $('loginForm');
    if(loginForm){
      loginForm.addEventListener('submit', function(e){
        e.preventDefault();
        const email = $('loginUser').value.trim();
        const pass = $('loginPass').value.trim();
        const r = login(email, pass);
        const msg = $('msg');
        if(r.ok){ window.location = 'pages/dashboard.html'; } else { msg.innerHTML = '<div class="alert alert-danger">'+r.msg+'</div>'; }
      });
    }

    // Register
    const regForm = $('regForm');
    if(regForm){
      regForm.addEventListener('submit', function(e){
        e.preventDefault();
        const data = {name:$('regName').value.trim(), email:$('regEmail').value.trim().toLowerCase(), mobile:$('regMobile').value.trim(), pass:$('regPass').value, acct:$('regAcctType').value, init: Number($('regInit').value)||0};
        const f = $('regKyc').files[0];
        const r = register(data, f);
        const msg = $('regMsg');
        if(r.ok){ msg.innerHTML = '<div class="alert alert-success">Account created. Redirecting to dashboard...</div>'; setTimeout(()=> window.location = '../pages/dashboard.html', 800); } else { msg.innerHTML = '<div class="alert alert-danger">'+r.msg+'</div>'; }
      });
    }

    // Dashboard logic
    const logoutBtn = $('logoutBtn');
    if(logoutBtn) logoutBtn.addEventListener('click', function(){ clearSession(); window.location = '../index.html'; });
    const sessionUser = getSessionUser();
    if(sessionUser && $('navUser')) $('navUser').textContent = sessionUser.name || '';

    const menuMap = {
      'menu-dashboard': renderDashboard,
      'menu-accounts': renderAccounts,
      'menu-transact': renderTransfer,
      'menu-bill': renderBills,
      'menu-cards': renderCards,
      'menu-loans': renderLoans,
      'menu-invest': renderInvest,
      'menu-budget': renderBudget,
      'menu-profile': renderProfile,
      'menu-epass': renderEpass,
      'menu-support': renderSupport
    };
    Object.keys(menuMap).forEach(k=>{ const el = document.getElementById(k); if(el) el.addEventListener('click', function(){ document.querySelectorAll('.list-group .active').forEach(x=>x.classList.remove('active')); this.classList.add('active'); menuMap[k](); }); });

    if(sessionUser && $('contentArea')) renderDashboard();
    if(!sessionUser && window.location.pathname.indexOf('/pages/')===0){ window.location = '../index.html'; }
  });

  // Render functions
  function renderDashboard(){
    const user = getSessionUser(); const el = $('contentArea');
    if(!user){ window.location='../index.html'; return; }
    let html = `<h4>Welcome back, ${user.name}</h4><p class="small text-muted">Overview of your accounts</p><div class="row">`;
    user.accounts.forEach(a=>{ html += `<div class="col-md-4"><div class="card p-3 mb-3"><strong>${a.name}</strong><div class="small text-muted">${a.type}</div><div class="h5 mt-2">₹ ${toNum(a.balance).toLocaleString()}</div></div></div>`; });
    html += `</div><h5>Recent Transactions</h5><ul class="list-group">`;
    (user.transactions.slice(0,8)).forEach(t=>{ html += `<li class="list-group-item">${t.date.split('T')[0]} - ${t.type} - ₹${t.amount} <div class="small text-muted">${t.meta && t.meta.note||''}</div></li>`; });
    html += `</ul>`;
    html += `<div class="card mt-3 p-3 chart-card"><h6>Account Balances</h6><canvas id="balanceChart"></canvas></div>`;
    el.innerHTML = html;

    // balance & monthly charts - small and responsive
    setTimeout(()=>{
      try{
        // balance chart
        const ctx = document.getElementById('balanceChart');
        if(ctx){
          ctx.style.maxWidth = '380px';
          ctx.style.height = '220px';
          if(__balanceChart) { __balanceChart.destroy(); __balanceChart = null; }
          const labels = user.accounts.map(a=>a.name+' ('+a.type+')');
          const data = user.accounts.map(a=>toNum(a.balance));
          __balanceChart = new Chart(ctx, { type: 'doughnut', data: { labels: labels, datasets:[{ data: data }] }, options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'bottom'}} } });
        }

        // monthly transactions (last 12 months)
        const existingMonthly = document.getElementById('monthlyChart') ? document.getElementById('monthlyChart').closest('.card') : null; if(existingMonthly) existingMonthly.remove();
        const txnByMonth = {};
        (user.transactions||[]).forEach(t=>{
          const d = new Date(t.date);
          const key = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0');
          txnByMonth[key] = (txnByMonth[key]||0) + Number(t.amount || 0);
        });
        const months = []; const values = [];
        for(let i=11;i>=0;i--){
          const d = new Date(); d.setMonth(d.getMonth()-i);
          const key = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0');
          months.push(d.toLocaleString(undefined,{month:'short', year:'numeric'}));
          values.push(txnByMonth[key]||0);
        }
        const parent = document.getElementById('contentArea');
        if(parent){
          const card = document.createElement('div'); card.className='card mt-3 p-3 chart-card';
          card.innerHTML = '<h6>Monthly Transactions (last 12 months) - Click a point to drill down</h6><canvas id="monthlyChart"></canvas><div id="monthlyDetails" class="mt-2"></div>';
          parent.appendChild(card);
        }
        const mctx = document.getElementById('monthlyChart');
        if(mctx){
          mctx.style.height='200px';
          if(window.__monthlyChartInstance){ window.__monthlyChartInstance.destroy(); window.__monthlyChartInstance = null; }
          window.__monthlyChartInstance = new Chart(mctx, { type:'line', data:{ labels: months, datasets:[{ label:'Total amount', data: values, fill:false, tension:0.2 }] }, options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, onClick: (evt, items) => { if(items.length>0){ const idx = items[0].index; drillDownMonth(idx, months[idx]); } } } });
        }
      }catch(e){ console.error(e); }
    }, 80);
  }

  function renderAccounts(){
    const user = getSessionUser(), el=$('contentArea');
    if(!user){ window.location='../index.html'; return; }
    let html = `<h4>Accounts Overview</h4><div class="mb-3"><button class="btn btn-sm btn-primary" onclick="window.location.reload()">Refresh</button></div>`;
    html += `<div class="accordion" id="accList">`;
    user.accounts.forEach((a, idx)=>{
      html += `<div class="accordion-item">
        <h2 class="accordion-header" id="h${idx}">
          <button class="accordion-button ${idx? 'collapsed':''}" type="button" data-bs-toggle="collapse" data-bs-target="#c${idx}">${a.name} - ₹${toNum(a.balance).toLocaleString()}</button>
        </h2>
        <div id="c${idx}" class="accordion-collapse collapse ${idx? '':'show'}" data-bs-parent="#accList">
          <div class="accordion-body">
            <p>Account Type: ${a.type}</p>
            <p>Balance: ₹${toNum(a.balance).toLocaleString()}</p>
            <div class="mb-2"><button class="btn btn-sm btn-outline-secondary me-2" onclick="downloadEPassbook('${a.id}')">Download CSV</button><button class="btn btn-sm btn-outline-primary" onclick="downloadEPassbook('${a.id}', {pdf:true})">Download PDF</button></div>
            <h6>Mini Statement</h6>
            <ul class="list-group">` ;
      const stm = miniStatement(user, a.id, 20);
      if(stm.length===0) html += `<li class="list-group-item small text-muted">No transactions</li>`;
      stm.forEach(t=>{
        html += `<li class="list-group-item small">${t.date.split('T')[0]} ${t.type} ₹${t.amount} <div class="small text-muted">${t.meta && t.meta.note||''}</div></li>`;
      });
      html += `</ul></div></div></div>`;
    });
    html += `</div>`;
    el.innerHTML = html;
  }

  // Transfer, bills, cards, loans, invest, budget, profile, epass, support - simplified implementations (same as earlier)
  function renderTransfer(){ /* ... simplified for brevity, use basic transfer UI from previous versions */ 
    const user = getSessionUser(), el=$('contentArea');
    if(!user){ window.location='../index.html'; return; }
    let acctOptions = user.accounts.map(a => `<option value="${a.id}">${a.name} (₹${toNum(a.balance).toLocaleString()})</option>`).join('');
    let html = `<h4>Fund Transfer</h4>
      <div class="card p-3">
        <form id="transferForm">
          <div class="row">
            <div class="mb-3 col-md-6"><label>From Account</label><select id="fromAcct" class="form-select">${acctOptions}</select></div>
            <div class="mb-3 col-md-6"><label>To</label>
              <select id="toType" class="form-select">
                <option value="own">Own Account</option><option value="other">Other Bank (IMPS/NEFT)</option>
              </select>
            </div>
            <div id="toTarget" class="mb-3 col-md-12"></div>
            <div class="mb-3 col-md-6"><label>Amount</label><input id="tAmount" class="form-control" placeholder="Enter Amount"required/></div>
            <div class="mb-3 col-md-6"><label>Note</label><input id="tNote" class="form-control" /></div>
          </div>
          <div class="d-flex gap-2"><button class="btn btn-success" type="submit">Transfer</button></div>
        </form>
        <div id="tMsg" class="mt-2"></div>
      </div>
    `;
    el.innerHTML = html;
    const toType = $('toType'), toTarget = $('toTarget');
    function updateToTarget(){
      if(toType.value==='own'){
        toTarget.innerHTML = `<label>To Account</label><select id="toAcct" class="form-select">${acctOptions}</select>`;
      } else {
        const bens = user.beneficiaries || [];
        let opt = '<label>Beneficiary / Other Bank</label><select id="toAcct" class="form-select">';
        opt += `<option value="">-- Enter new beneficiary --</option>` + bens.map(b=>`<option value="ben_${b.id}">${b.name} - ${b.bank} - ${b.acc}</option>`).join('');
        opt += `</select><div class="mt-2"><input id="newBenName" placeholder="Beneficiary Name" class="form-control mb-1"/><input id="newBenBank" placeholder="Bank Name" class="form-control mb-1"/><input id="newBenAcc" placeholder="Account no / UPI" class="form-control mb-1" required/></div>`;
        toTarget.innerHTML = opt;
      }
    }
    updateToTarget();
    toType.addEventListener('change', updateToTarget);
    document.getElementById('transferForm').addEventListener('submit', function(e){
      e.preventDefault();
      const from = $('fromAcct').value;
      const type = $('toType').value;
      const amt = toNum($('tAmount').value);
      const note = $('tNote').value;
      const user = getSessionUser();
      if(type==='own'){
        const to = $('toAcct').value;
        if(!to){ $('tMsg').innerHTML = '<div class="alert alert-danger">Select to account</div>'; return; }
        const res = addTransaction(user, from, to, amt, 'transfer', {note});
        if(res.ok){ $('tMsg').innerHTML = '<div class="alert alert-success">Transfer successful</div>'; renderAccounts(); } else $('tMsg').innerHTML = '<div class="alert alert-danger">'+res.msg+'</div>';
      } else {
        const sel = $('toAcct').value;
        let benId = null;
        if(sel && sel.startsWith('ben_')) benId = sel.replace('ben_','');
        else {
          const bname = $('newBenName').value.trim(), bbank = $('newBenBank').value.trim(), bacc = $('newBenAcc').value.trim();
          if(!bname || !bbank || !bacc){ $('tMsg').innerHTML = '<div class="alert alert-danger">Fill beneficiary details</div>'; return; }
          const b = {id: uid(), name: bname, bank: bbank, acc: bacc};
          user.beneficiaries = user.beneficiaries || []; user.beneficiaries.push(b); saveUser(user);
          benId = b.id;
        }
        const res = addTransaction(user, from, null, amt, 'external_transfer', {toBank: 'OTHER_BANK', benId: benId, note});
        if(res.ok){ $('tMsg').innerHTML = '<div class="alert alert-success">External transfer queued</div>'; renderAccounts(); } else $('tMsg').innerHTML = '<div class="alert alert-danger">'+res.msg+'</div>';
      }
    });
  }

  function renderBills(){
    const user = getSessionUser(), el=$('contentArea');
    if(!user){ window.location='../index.html'; return; }
    let html = `<h4>Bill Payments & Recharge</h4>
      <div class="card p-3">
        <form id="billForm">
          <div class="row">
            <div class="mb-3 col-md-6"><label>From Account</label><select id="billFrom" class="form-select">${user.accounts.map(a=>`<option value="${a.id}">${a.name} (₹${toNum(a.balance).toLocaleString()})</option>`).join('')}</select></div>
            <div class="mb-3 col-md-6"><label>Category</label><select id="billCat" class="form-select"><option>Mobile Recharge</option><option>Electricity</option><option>Gas</option><option>DTH</option><option>Insurance</option></select></div>
            <div class="mb-3 col-md-6"><label>Reference / Number</label><input id="billRef" class="form-control" required/></div>
            <div class="mb-3 col-md-6"><label>Amount</label><input id="billAmt" class="form-control" placeholder"Enter Amount" required/></div>
          </div>
          <div><button class="btn btn-success" type="submit">Pay Bill</button></div>
        </form>
        <div id="billMsg" class="mt-2"></div>
      </div>
    `;
    el.innerHTML = html;
    document.getElementById('billForm').addEventListener('submit', function(e){
      e.preventDefault();
      const from = $('billFrom').value; const cat = $('billCat').value; const ref = $('billRef').value; const amt = toNum($('billAmt').value);
      const user = getSessionUser();
      if(amt<=0){ $('billMsg').innerHTML = '<div class="alert alert-danger">Invalid amount</div>'; return; }
      const res = addTransaction(user, from, null, amt, 'bill_payment', {category:cat, ref, note:cat+' - '+ref});
      if(res.ok){ $('billMsg').innerHTML = '<div class="alert alert-success">Bill payment successful</div>'; renderAccounts(); } else $('billMsg').innerHTML = '<div class="alert alert-danger">'+res.msg+'</div>';
    });
  }

  function renderCards(){ const user = getSessionUser(), el=$('contentArea'); if(!user){ window.location='../index.html'; return; }
    const cards = user.cards || [];
    let html = `<h4>Card Services</h4>
      <div class="card p-3 mb-3">
        <h6>Apply for Card</h6>
        <form id="applyCard">
          <div class="row"><div class="mb-3 col-md-6"><label>Card Type</label><select id="cardType" class="form-select"><option>Debit</option><option>Credit</option></select></div>
          <div class="mb-3 col-md-6"><label>Linked Account</label><select id="cardAcc" class="form-select">${user.accounts.map(a=>`<option value="${a.id}">${a.name}</option>`).join('')}</select></div></div>
          <button class="btn btn-primary">Apply</button>
        </form>
      </div>`;
    html += `<div class="card p-3"><h6>Your Cards</h6><ul class="list-group">`;
    if(cards.length===0) html += `<li class="list-group-item small text-muted">No cards</li>`;
    cards.forEach(c=> html += `<li class="list-group-item"><strong>${c.type} Card</strong> - ${c.mask} - Limit: ${c.limit? '₹'+c.limit : 'N/A'} <div class="mt-1"><button class="btn btn-sm btn-warning" onclick="blockCard('${c.id}')">${c.blocked? 'Unblock' : 'Block'}</button></div></li>`);
    html += `</ul></div>`;
    el.innerHTML = html;
    document.getElementById('applyCard').addEventListener('submit', function(e){ e.preventDefault(); const type = $('cardType').value, acc = $('cardAcc').value; const c = {id: uid(), type, accId: acc, mask: 'XXXX-XXXX-'+Math.floor(1000+Math.random()*9000), limit: type==='Credit'?50000: null, blocked:false}; user.cards = user.cards||[]; user.cards.push(c); saveUser(user); renderCards(); });
  }
  window.blockCard = function(id){ const user = getSessionUser(); const c = user.cards.find(x=>x.id===id); if(c){ c.blocked = !c.blocked; saveUser(user); renderCards(); } };

  function renderLoans(){ const user = getSessionUser(), el=$('contentArea'); if(!user){ window.location='../index.html'; return; }
    let html = `<h4>Loans & EMI</h4>
      <div class="card p-3 mb-3">
        <h6>Loan Eligibility Calculator</h6>
        <form id="loanCalc"><div class="row">
          <div class="mb-3 col-md-4"><label>Loan Amount</label><input id="loanAmt" class="form-control" placeholder="Enter Amount" required/></div>
          <div class="mb-3 col-md-4"><label>Tenure (yrs)</label><input id="loanTen" class="form-control" value="5" /></div>
          <div class="mb-3 col-md-4"><label>Interest % p.a.</label><input id="loanInt" class="form-control" value="9" /></div>
        </div><button class="btn btn-primary">Calculate EMI</button></form>
        <div id="loanRes" class="mt-2"></div>
      </div>
      <div class="card p-3"><h6>Apply Loan</h6>
        <form id="applyLoan"><div class="row">
          <div class="mb-3 col-md-4"><label>Type</label><select id="loanType" class="form-select"><option>Personal</option><option>Home</option><option>Car</option></select></div>
          <div class="mb-3 col-md-4"><label>Amount</label><input id="applyAmt" class="form-control" required/></div>
          <div class="mb-3 col-md-4"><label>Tenure (yrs)</label><input id="applyTen" class="form-control" value="3" /></div>
        </div><button class="btn btn-success">Apply</button></form>
        <div id="loanMsg" class="mt-2"></div>
      </div>`;
    el.innerHTML = html;
    document.getElementById('loanCalc').addEventListener('submit', function(e){ e.preventDefault(); const P = toNum($('loanAmt').value), years = toNum($('loanTen').value), r = toNum($('loanInt').value)/100/12; const n = years*12; if(P<=0){ $('loanRes').innerHTML = '<div class="alert alert-danger">Invalid amount</div>'; return; } const emi = (P*r*Math.pow(1+r,n))/(Math.pow(1+r,n) -1 || 1); $('loanRes').innerHTML = `<div class="alert alert-info">EMI: ₹${emi.toFixed(2)} per month for ${n} months. Total payable: ₹${(emi*n).toFixed(2)}</div>`; });
    document.getElementById('applyLoan').addEventListener('submit', function(e){ e.preventDefault(); const t = $('loanType').value, a = toNum($('applyAmt').value), ten = toNum($('applyTen').value); const user = getSessionUser(); const loan = {id: uid(), type:t, amount:a, tenure:ten, applied: now(), status:'Applied'}; user.loans = user.loans||[]; user.loans.push(loan); saveUser(user); $('loanMsg').innerHTML = '<div class="alert alert-success">Loan application submitted.</div>'; });
  }

  function renderInvest(){ const user = getSessionUser(), el=$('contentArea'); if(!user){ window.location='../index.html'; return; }
    let html = `<h4>Investments</h4>
      <div class="card p-3 mb-3">
        <h6>Fixed Deposit</h6>
        <form id="fdForm"><div class="row">
          <div class="mb-3 col-md-4"><label>Amount</label><input id="fdAmt" class="form-control" /></div>
          <div class="mb-3 col-md-4"><label>Tenure (yrs)</label><input id="fdTen" class="form-control" value="1" /></div>
          <div class="mb-3 col-md-4"><label>Interest %</label><input id="fdInt" class="form-control" value="6.5" /></div>
        </div><button class="btn btn-primary">Create FD</button></form>
        <div id="fdMsg" class="mt-2"></div>
      </div>
      <div class="card p-3"><h6>Portfolio</h6><ul class="list-group">`;
    (user.investments||[]).forEach(inv=> html += `<li class="list-group-item small">${inv.type} - ₹${inv.amount} (${inv.tenure} yrs)</li>`);
    html += `</ul></div>`;
    el.innerHTML = html;
    document.getElementById('fdForm').addEventListener('submit', function(e){ e.preventDefault(); const amt=toNum($('fdAmt').value), ten=toNum($('fdTen').value), intp=toNum($('fdInt').value); const user = getSessionUser(); if(amt<=0){ $('fdMsg').innerHTML = '<div class="alert alert-danger">Invalid amount</div>'; return;} user.investments = user.investments||[]; user.investments.push({id:uid(), type:'FD', amount:amt, tenure:ten, rate:intp, created: now()}); user.accounts.push({id: 'FD'+uid(), type:'fd', name:'Fixed Deposit', balance: amt}); saveUser(user); $('fdMsg').innerHTML = '<div class="alert alert-success">FD created</div>'; renderInvest(); });
  }

  function renderBudget(){ const user = getSessionUser(), el=$('contentArea'); if(!user){ window.location='../index.html'; return; }
    let html = `<h4>Budget Planner</h4>
      <div class="card p-3 mb-3">
        <form id="budgetForm"><div class="row">
          <div class="mb-3 col-md-4"><label>Monthly Income</label><input id="inc" class="form-control" required/></div>
          <div class="mb-3 col-md-4"><label>Monthly Expenses</label><input id="exp" class="form-control" required/></div>
          <div class="mb-3 col-md-4"><label>Savings Goal</label><input id="goal" class="form-control" required/></div>
        </div><button class="btn btn-primary">Save Budget</button></form>
        <div id="budgetMsg" class="mt-2"></div>
      </div>
      <div class="card p-3"><h6>Saved Budgets</h6><ul class="list-group">`;
    (user.budgets||[]).forEach(b=> html += `<li class="list-group-item small">Income ₹${b.income} - Expense ₹${b.expense} - Goal ₹${b.goal}</li>`);
    html += `</ul></div>`;
    el.innerHTML = html;
    // budget chart
    setTimeout(()=>{
      try{
        const container = document.querySelector('#contentArea .card.p-3.mb-3');
        if(container && !document.getElementById('budgetChart')){ const c=document.createElement('canvas'); c.id='budgetChart'; container.appendChild(c); }
        const budgets = user.budgets||[];
        const totalInc = budgets.reduce((s,b)=>s+toNum(b.income),0);
        const totalExp = budgets.reduce((s,b)=>s+toNum(b.expense),0);
        if(document.getElementById('budgetChart')){
          const c = document.getElementById('budgetChart'); if(window.__budgetChart){ window.__budgetChart.destroy(); window.__budgetChart = null; }
          window.__budgetChart = new Chart(c, { type:'bar', data:{ labels:['Income','Expense'], datasets:[{ label:'Monthly', data:[totalInc,totalExp] }]}, options:{ responsive:true, maintainAspectRatio:false } });
        }
      }catch(e){ console.error(e); }
    },100);
    document.getElementById('budgetForm').addEventListener('submit', function(e){ e.preventDefault(); const income=toNum($('inc').value), exp=toNum($('exp').value), goal=toNum($('goal').value); const user = getSessionUser(); user.budgets = user.budgets||[]; user.budgets.unshift({income, expense:exp, goal, created: now()}); saveUser(user); $('budgetMsg').innerHTML = '<div class="alert alert-success">Budget saved</div>'; renderBudget(); });
  }

  function renderProfile(){ const user = getSessionUser(), el=$('contentArea'); if(!user){ window.location='../index.html'; return; }
    let html = `<h4>Profile & KYC</h4>
      <div class="card p-3 mb-3">
        <h6>Personal Details</h6>
        <div class="row">
          <div class="mb-3 col-md-6"><label>Name</label><input id="pName" class="form-control" value="${user.name}"/></div>
          <div class="mb-3 col-md-6"><label>Email</label><input id="pEmail" class="form-control" value="${user.email}"/></div>
          <div class="mb-3 col-md-6"><label>Mobile</label><input id="pMobile" class="form-control" value="${user.mobile}"/></div>
        </div>
        <div class="d-flex gap-2"><button class="btn btn-primary" id="saveProfile">Save</button></div>
        <div id="profMsg" class="mt-2"></div>
      </div>
      <div class="card p-3 mb-3">
        <h6>KYC Documents</h6>
        <div class="small text-muted">Uploaded files:</div>
        <ul class="list-group mb-2">`;
    const k = []; // will be filled client-side
    html += `</ul><input id="kycFile" type="file" class="form-control"/><div class="mt-2"><button class="btn btn-sm btn-success" id="uploadKyc">Upload</button></div></div>`;
    html += `<div class="card p-3"><h6>Addresses</h6><ul class="list-group mb-2">`;
    html += `</ul><input id="newAddr" class="form-control mb-2"/><button class="btn btn-sm btn-primary" id="addAddr" placeholder"Enter Address,City,Pincode,State">Add Address</button></div>`;
    el.innerHTML = html;
    document.getElementById('saveProfile').addEventListener('click', function(){ user.name = $('pName').value; user.email = $('pEmail').value; user.mobile = $('pMobile').value; saveUser(user); $('profMsg').innerHTML = '<div class="alert alert-success">Profile saved</div>'; if($('navUser')) $('navUser').textContent = user.name; });
    document.getElementById('uploadKyc').addEventListener('click', function(){ const f = $('kycFile').files[0]; if(!f){ alert('Select file'); return; } user.kyc = user.kyc||{}; user.kyc[f.name] = 'uploaded'; saveUser(user); renderProfile(); });
    document.getElementById('addAddr').addEventListener('click', function(){ const a = $('newAddr').value.trim(); if(!a) return; user.addresses = user.addresses||[]; user.addresses.push(a); saveUser(user); renderProfile(); });
  }

  function renderEpass(){ const user = getSessionUser(), el=$('contentArea'); if(!user){ window.location='../index.html'; return; }
    let html = `<h4>e-Passbook & Statements</h4><div class="card p-3">`;
    if(user.accounts.length===0) html += `<div class="small text-muted">No accounts</div>`;
    html += `<div class="row">`;
    user.accounts.forEach(a=> html += `<div class="col-md-4"><div class="p-2 border rounded mb-2"><strong>${a.name}</strong><div class="small">Balance ₹${toNum(a.balance).toLocaleString()}</div><div class="mt-2"><button class="btn btn-sm btn-outline-secondary me-2" onclick="downloadEPassbook('${a.id}')">Download CSV</button><button class="btn btn-sm btn-outline-primary" onclick="downloadEPassbook('${a.id}', {pdf:true})">Download PDF</button></div></div></div>`);
    html += `</div></div></div>`;
    el.innerHTML = html;
  }
  window.downloadEPassbook = function(acctId, opts){ const user = getSessionUser(); if(!user) return; opts = opts||{}; if(opts.pdf){ exportPassbookPDF(user, acctId); return; } const url = exportEPassbookCSV(user, acctId); const a = document.createElement('a'); a.href = url; a.download = 'epassbook_'+acctId+'.csv'; document.body.appendChild(a); a.click(); a.remove(); };

  function renderSupport(){ const user = getSessionUser(), el=$('contentArea'); if(!user){ window.location='../index.html'; return; } let html = `<h4>Customer Support</h4><div class="card p-3 mb-3"><form id="ticketForm"><div class="mb-3"><label>Subject</label><input id="tSub" class="form-control" placeholder="Enter Subject" required/></div><div class="mb-3"><label>Message</label><textarea id="tMsgBox" class="form-control" placeholder="Message" required></textarea></div><button class="btn btn-primary">Raise Ticket</button></form></div><div class="card p-3"><h6>Your Tickets</h6><ul class="list-group">`; (user.tickets||[]).forEach(t=> html += `<li class="list-group-item small">${t.subject} - ${t.status} <div class="small text-muted">${t.created}</div></li>`); html += `</ul></div>`; el.innerHTML = html; document.getElementById('ticketForm').addEventListener('submit', function(e){ e.preventDefault(); const s = $('tSub').value.trim(), m = $('tMsgBox').value.trim(); if(!s||!m) return; user.tickets = user.tickets||[]; user.tickets.unshift({id:uid(), subject:s, message:m, status:'Open', created: now()}); saveUser(user); renderSupport(); }); }

  // drill-down helper used by monthly chart
  function drillDownMonth(index, label){
    try{
      const user = getSessionUser(); if(!user) return;
      const monthsKeys = [];
      for(let i=11;i>=0;i--){ const d = new Date(); d.setMonth(d.getMonth()-i); monthsKeys.push(d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0')); }
      const key = monthsKeys[index];
      const details = (user.transactions||[]).filter(t=>{ const d=new Date(t.date); const k=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'); return k===key; });
      const container = document.getElementById('monthlyDetails'); if(!container) return;
      if(details.length===0){ container.innerHTML = '<div class="small text-muted">No transactions for '+label+'</div>'; return; }
      let html = '<ul class="list-group">'; details.forEach(t=> html += `<li class="list-group-item small">${t.date.split('T')[0]} - ${t.type} - ₹${t.amount} <div class="small text-muted">${t.meta && t.meta.note||''}</div></li>`); html += '</ul>'; container.innerHTML = html;
    }catch(e){ console.error(e); }
  }

  // security redirect for pages
  if(window.location.pathname.indexOf('/pages/')===0 && window.location.pathname.indexOf('dashboard.html')>0){
    const user = getSessionUser(); if(!user){ window.location = '../index.html'; }
  }

  // expose functions for bindings (simpler)
  window.renderDashboard = renderDashboard; window.renderAccounts = renderAccounts; window.renderTransfer = renderTransfer; window.renderBills = renderBills; window.renderCards = renderCards; window.renderLoans = renderLoans; window.renderInvest = renderInvest; window.renderBudget = renderBudget; window.renderProfile = renderProfile; window.renderEpass = renderEpass; window.renderSupport = renderSupport; window.drillDownMonth = drillDownMonth;

})();
