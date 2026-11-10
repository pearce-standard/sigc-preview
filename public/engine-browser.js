(function(){var __m={},__c={};function req(n){n=n.replace(/^\.\//,'');if(__c[n])return __c[n].exports;var m={exports:{}};__c[n]=m;__m[n](m,m.exports,req);return m.exports}
__m.fs={};__c.fs={exports:{existsSync:()=>false,writeFileSync(){},readFileSync(){}}};__c.path={exports:{}};__c.crypto={exports:{randomBytes:n=>({toString:()=>Array.from(crypto.getRandomValues(new Uint8Array(n))).map(b=>b.toString(16).padStart(2,'0')).join('')})}};
__m["config"]=function(module,exports,require){// SIGC booking rules. Source of truth: live site thestandardindoorgolfclub.com/memberships
// (read Nov 10, 2026) plus Eric's locks. Anything marked VERIFY is not confirmed.
module.exports = {
  timezone: 'America/Chicago',
  slotMinutes: 30,
  bays: [
    { id: 1, name: 'Bay 1' }, { id: 2, name: 'Bay 2' }, { id: 3, name: 'Bay 3' },
    { id: 4, name: 'Bay 4' }, { id: 5, name: 'Bay 5 (Private)' },
  ],
  // Staffed hours, minutes from midnight CT. 0=Sun..6=Sat
  staffedHours: {
    0: [660, 1200], 1: [540, 1260], 2: [540, 1260], 3: [540, 1260],
    4: [540, 1260], 5: [540, 1320], 6: [480, 1320],
  },
  memberExtendedHours: [300, 1440], // 5 AM to midnight, after-hours tiers only
  publicBookAheadDays: 10,
  memberBookAheadDays: 14,
  nonMember: {
    minMinutes: 60,
    offPeak: { days: [1, 2, 3, 4], from: 540, to: 960, hourly: 55 },
    hourly: 60,
  },
  reservationFee: 0.50,
  clubRental: 10, // non-members; free for members (Eric via Brand, Nov 10)
  clubRentalMember: 0,
  bayCapacity: { max: 5, recommended: 3 },
  eventCapacityNote: '50+ guests',
  salesTaxRate: 0.0825, // VERIFY which items are taxable before going live
  memberDailyMinutes: 90,
  tiers: {
    founding:     { name: 'Founding Membership', monthly: 199.99, monthlyMinutes: null, afterHours: true,  openBay: true,  window: null },
    open:         { name: 'Open Membership', monthly: 249.99, monthlyMinutes: null, afterHours: true,  openBay: true,  window: null },
    player:       { name: 'Player Membership', monthly: 169.99, monthlyMinutes: 900, afterHours: true,  openBay: false, window: null },
    champions:    { name: 'Champions (65 and over)', monthly: 129.99, monthlyMinutes: 1500, afterHours: false, openBay: false, window: { days: [1, 2, 3, 4], from: 540, to: 960 } },
    college_prep: { name: 'College Prep (17 and under)', monthly: 149.99, monthlyMinutes: 900, afterHours: false, openBay: false, window: null },
    ambassador:   { name: 'Ambassador (invite only)', monthly: 179.99, monthlyMinutes: null, afterHours: true, openBay: false, window: null, private: true, verify: 'Ambassador allowance/after-hours not on public site; VERIFY with Eric' },
    coaching:     { name: 'Coaching Membership', monthly: 0, monthlyMinutes: null, afterHours: true, openBay: false, window: null, private: true },
  },
  memberBayPrice: 0, // VERIFY: member bay time inside allowance priced at $0 + reservation fee
  giftCards: { ten_play: { name: 'Ten-Play Gift Card', price: 299, credit: 600 } },
};

};__m["rules"]=function(module,exports,require){const C = require('./config');
const money = n => Math.round(n * 100) / 100;
const dow = date => new Date(date + 'T12:00:00Z').getUTCDay();
const daysBetween = (a, b) => Math.round((new Date(b + 'T12:00:00Z') - new Date(a + 'T12:00:00Z')) / 864e5);
const fmt = m => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const fmt12 = m => { const h = Math.floor(m / 60) % 24, mm = String(m % 60).padStart(2, '0'); return `${h % 12 || 12}:${mm} ${h < 12 ? 'AM' : 'PM'}`; };
const parse = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };

function slotRate(date, start) {
  const o = C.nonMember.offPeak, d = dow(date);
  const hourly = o.days.includes(d) && start >= o.from && start < o.to ? o.hourly : C.nonMember.hourly;
  return hourly * C.slotMinutes / 60;
}

// Returns {ok, errors[], quote}
function evaluate({ date, start, minutes, bayId, member, today, usage = { dayMinutes: 0, monthMinutes: 0 }, code, codeRecord }) {
  const errors = [];
  const s = typeof start === 'string' ? parse(start) : start;
  const e = s + minutes;
  const d = dow(date);
  const staffed = C.staffedHours[d];
  const tier = member && C.tiers[member.tier];
  if (!C.bays.find(b => b.id === bayId)) errors.push('Unknown bay');
  if (minutes <= 0 || minutes % C.slotMinutes) errors.push(`Length must be in ${C.slotMinutes}-minute steps`);
  if (s % C.slotMinutes) errors.push('Start must be on a 30-minute boundary');
  const ahead = daysBetween(today, date);
  if (ahead < 0) errors.push('Date is in the past');
  const maxAhead = tier ? C.memberBookAheadDays : C.publicBookAheadDays;
  if (ahead > maxAhead) errors.push(`Bookings open ${maxAhead} days ahead`);

  let lines = [];
  if (!tier) {
    if (member && member.tier && !tier) errors.push('Unknown membership tier');
    if (minutes < C.nonMember.minMinutes) errors.push('Non-member bookings are 1 hour minimum');
    if (s < staffed[0] || e > staffed[1]) errors.push('Non-members book during staffed hours only');
    let bay = 0;
    for (let t = s; t < e; t += C.slotMinutes) bay += slotRate(date, t);
    if (codeRecord) {
      if (codeRecord.used) errors.push('This code has already been used');
      else if (codeRecord.minutes !== minutes) errors.push(`This code is for a ${codeRecord.minutes}-minute booking`);
    }
    lines.push({ label: `Bay time ${fmt12(s)}–${fmt12(e)} CT`, amount: money(bay) });
    if (codeRecord && !codeRecord.used && codeRecord.minutes === minutes) lines.push({ label: `Code ${code}`, amount: -money(bay) });
  } else {
    if (member.status !== 'active') errors.push('Membership is not active');
    const win = tier.afterHours ? C.memberExtendedHours : staffed;
    if (s < win[0] || e > win[1]) errors.push(tier.afterHours ? 'Members book 5 AM to midnight' : 'This membership books during staffed hours only');
    if (tier.window && (!tier.window.days.includes(d) || s < tier.window.from || e > tier.window.to)) errors.push('This membership books Mon–Thu 9 AM–4 PM only');
    if (usage.dayMinutes + minutes > C.memberDailyMinutes) errors.push('Members can book up to 1.5 hours per day');
    if (tier.monthlyMinutes != null && usage.monthMinutes + minutes > tier.monthlyMinutes) errors.push(`Monthly allowance is ${tier.monthlyMinutes / 60} hours`);
    if (code) errors.push('Promo codes are for non-member bookings');
    lines.push({ label: `${tier.name} bay time ${fmt12(s)}–${fmt12(e)} CT`, amount: C.memberBayPrice });
  }
  lines.push({ label: 'Reservation fee', amount: C.reservationFee });
  const total = money(lines.reduce((a, l) => a + l.amount, 0));
  return { ok: errors.length === 0, errors, quote: { lines, total, start: fmt(s), end: fmt(e), startLabel: fmt12(s), endLabel: fmt12(e) } };
}

function overlaps(a, b) { return a.date === b.date && a.bayId === b.bayId && a.start < b.end && b.start < a.end; }

module.exports = { fmt12, evaluate, slotRate, overlaps, parse, fmt, dow, daysBetween, money };

};__m["store"]=function(module,exports,require){const fs = require('fs'), path = require('path'), crypto = require('crypto');
const R = require('./rules'), C = require('./config');
class Store {
  constructor(file) { this.file = file; this.db = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file)) : { members: [], bookings: [], codes: [], giftCards: [], blocks: [] }; }
  save() { if (this.file) fs.writeFileSync(this.file, JSON.stringify(this.db, null, 2)); }
  member(id) { return this.db.members.find(m => m.id === id); }
  usage(memberId, date, extra = 0) {
    const mine = this.db.bookings.filter(b => b.memberId === memberId && b.status === 'confirmed');
    return {
      dayMinutes: mine.filter(b => b.date === date).reduce((a, b) => a + b.end - b.start, 0),
      monthMinutes: mine.filter(b => b.date.slice(0, 7) === date.slice(0, 7)).reduce((a, b) => a + b.end - b.start, 0),
    };
  }
  conflicts(req) {
    return [...this.db.bookings.filter(b => b.status === 'confirmed'), ...this.db.blocks].some(b => R.overlaps(b, req));
  }
  quote(input) {
    const member = input.memberId ? this.member(input.memberId) : null;
    if (input.memberId && !member) return { ok: false, errors: ['Member not found'] };
    const codeRecord = input.code ? this.db.codes.find(c => c.code.toLowerCase() === String(input.code).toLowerCase()) : null;
    const errors = [];
    if (input.code && !codeRecord) errors.push('Code not recognized');
    const r = R.evaluate({ ...input, member, codeRecord, usage: member ? this.usage(member.id, input.date) : undefined });
    const s = R.parse(r.quote.start), e = R.parse(r.quote.end);
    if (this.conflicts({ date: input.date, bayId: input.bayId, start: s, end: e })) errors.push('That bay is already booked for this time');
    r.errors.push(...errors); r.ok = r.errors.length === 0;
    return r;
  }
  book(input) {
    const r = this.quote(input);
    if (!r.ok) return r;
    const b = { id: 'bk_' + crypto.randomBytes(5).toString('hex'), date: input.date, bayId: input.bayId, start: R.parse(r.quote.start), end: R.parse(r.quote.end), memberId: input.memberId || null, guest: input.guest || null, code: input.code || null, total: r.quote.total, status: 'confirmed', payment: { provider: 'sandbox', status: 'captured_fake' }, createdAt: input.now || new Date().toISOString() };
    if (input.code) this.db.codes.find(c => c.code.toLowerCase() === input.code.toLowerCase()).used = b.id;
    this.db.bookings.push(b); this.save();
    return { ok: true, booking: b, quote: r.quote };
  }
  cancel(id) { const b = this.db.bookings.find(x => x.id === id); if (!b) return { ok: false, errors: ['Not found'] }; b.status = 'cancelled'; if (b.code) { const c = this.db.codes.find(c => c.used === b.id); if (c) c.used = null; } this.save(); return { ok: true, booking: b }; }
  availability(date, opts) {
    const out = [];
    for (const bay of C.bays) {
      const slots = [];
      for (let t = 300; t < 1440; t += C.slotMinutes) {
        const taken = this.conflicts({ date, bayId: bay.id, start: t, end: t + C.slotMinutes });
        const r = R.evaluate({ date, start: t, minutes: C.slotMinutes, bayId: bay.id, today: opts.today, member: opts.memberId ? this.member(opts.memberId) : null, usage: { dayMinutes: 0, monthMinutes: 0 } });
        const window = r.errors.filter(x => !/minimum|30-minute steps/.test(x));
        if (!window.length || taken) slots.push({ time: R.fmt(t), label: R.fmt12(t), available: !taken, price: opts.memberId ? C.memberBayPrice : R.slotRate(date, t), hourly: opts.memberId ? C.memberBayPrice : R.slotRate(date, t) * 60 / C.slotMinutes });
      }
      out.push({ bay, slots });
    }
    return out;
  }
  redeemGift(code, memberId) { const g = this.db.giftCards.find(x => x.code === code); if (!g) return { ok: false, errors: ['Gift card not found'] }; if (g.redeemedBy) return { ok: false, errors: ['Already redeemed'] }; g.redeemedBy = memberId; const m = this.member(memberId); m.credit = R.money((m.credit || 0) + g.credit); this.save(); return { ok: true, credit: m.credit }; }
}
module.exports = Store;

};
var Store=req('store'),C=req('config'),KEY='sigc-sandbox-db';var SEED={
  "members": [
    {
      "id": "m_founding",
      "name": "Test Founding",
      "email": "founding@example.test",
      "tier": "founding",
      "status": "active"
    },
    {
      "id": "m_open",
      "name": "Test Open",
      "email": "open@example.test",
      "tier": "open",
      "status": "active"
    },
    {
      "id": "m_player",
      "name": "Test Player",
      "email": "player@example.test",
      "tier": "player",
      "status": "active"
    },
    {
      "id": "m_champ",
      "name": "Test Champions",
      "email": "champ@example.test",
      "tier": "champions",
      "status": "active"
    },
    {
      "id": "m_prep",
      "name": "Test College Prep",
      "email": "prep@example.test",
      "tier": "college_prep",
      "status": "active"
    },
    {
      "id": "m_pending",
      "name": "Test Pending",
      "email": "pending@example.test",
      "tier": "founding",
      "status": "pending"
    }
  ],
  "bookings": [],
  "blocks": [],
  "codes": [
    {
      "code": "TESTFREE60A",
      "minutes": 60,
      "used": null
    },
    {
      "code": "TESTFREE60B",
      "minutes": 60,
      "used": null
    }
  ],
  "giftCards": [
    {
      "code": "TESTGIFT600",
      "credit": 600,
      "redeemedBy": null
    }
  ]
};
var s=new Store(null);s.db=JSON.parse(localStorage.getItem(KEY)||JSON.stringify(SEED));s.save=function(){localStorage.setItem(KEY,JSON.stringify(s.db))};
var today=function(){return new Intl.DateTimeFormat('en-CA',{timeZone:C.timezone}).format(new Date())};
var realFetch=window.fetch.bind(window);
window.sigcResetSandbox=function(){localStorage.removeItem(KEY);location.reload()};
window.fetch=function(u,o){o=o||{};var url=new URL(u,location.href);if(url.pathname.indexOf('/api/')!==0)return realFetch(u,o);
var j=o.body?JSON.parse(o.body):{},q=url.searchParams,p=url.pathname,out,code=200,m=(o.method||'GET').toUpperCase();
if(p==='/api/members')out=s.db.members.map(function(x){return{id:x.id,name:x.name,tier:x.tier,status:x.status}});
else if(p==='/api/availability')out=s.availability(q.get('date'),{today:today(),memberId:q.get('memberId')});
else if(p==='/api/quote')out=s.quote(Object.assign({},j,{today:today()}));
else if(p==='/api/book'){out=s.book(Object.assign({},j,{today:today()}));code=out.ok?201:422}
else if(p==='/api/bookings')out=s.db.bookings;
else{out={error:'not found'};code=404}
return Promise.resolve(new Response(JSON.stringify(out),{status:code,headers:{'content-type':'application/json'}}))};})();