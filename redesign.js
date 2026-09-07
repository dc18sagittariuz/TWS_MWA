/* Interaction layer: compact results, shared status, filters and map workspace. */
const STATUS_LABEL = {pass:'ผ่านเกณฑ์', fail:'ไม่ผ่านเกณฑ์', wait:'รอผล / ข้อมูลไม่ครบ'};
const STATUS_COLOR = {pass:'#087a55', fail:'#bd3030', wait:'#b7791f'};
const el = id => document.getElementById(id);
let loadSequence = 0, loadedAt = '', selectedMapPlace = null, lastDialogFocus = null;
const savedView = new URLSearchParams(location.search);
let restoreView = true;
if (PROJECTS[savedView.get('project')]) CURRENT_PROJECT = PROJECTS[savedView.get('project')];
function setProjectHeading(){
  el('project-select').value = CURRENT_PROJECT.key;
  el('header-title').textContent = CURRENT_PROJECT.name;
}
setProjectHeading();

// Missing required readings cannot be presented as a completed passing result.
rowIsWaiting = function(r){
  if (readingFails(r)) return false;
  if ([r.ph,r.turb].some(v => numOf(v) === null)) return true;
  if (isDirect(r.type) && numOf(r.cl) === null) return true;
  return hasBactAnalysis(r.date) && [r.ecoli,r.coliform].some(v => statusBact(v) === null);
};
function placeStatus(rows){
  return rows.some(readingFails) ? 'fail' : !rows.length || rows.some(rowIsWaiting) ? 'wait' : 'pass';
}
function currentPlaceRows(p){
  const fy = el('list-fy').value;
  const rows = fy === 'all' ? p.rows : p.rows.filter(r => String(r.fy) === fy);
  const date = rows.reduce((latest,r)=>r.date>latest?r.date:latest,'');
  return rows.filter(r=>r.date===date);
}
function statusBadge(status){return `<span class="badge status-${status}">${STATUS_LABEL[status]}</span>`;}
function failureNames(r){
  return [['คลอรีน',statusCl(r.cl,r.type)],['ความขุ่น',statusTurb(r.turb)],['pH',statusPH(r.ph)],['สี',statusColor(r.color)],['การนำไฟฟ้า',statusCond(r.cond)],['Coliform',statusBact(r.coliform)],['E.coli',statusBact(r.ecoli)]].filter(x=>x[1]==='bad').map(x=>x[0]);
}
function waitingNames(r){
  const names = [];
  if(numOf(r.ph)===null) names.push('pH');
  if(numOf(r.turb)===null) names.push('ความขุ่น');
  if(isDirect(r.type)&&numOf(r.cl)===null) names.push('คลอรีน');
  if(hasBactAnalysis(r.date)) {if(statusBact(r.coliform)===null) names.push('Coliform');if(statusBact(r.ecoli)===null) names.push('E.coli');}
  return names;
}

showError = function(message){
  el('app-message').hidden = false;
  el('app-message').innerHTML = `<strong>โหลดข้อมูลไม่สำเร็จ</strong><span>${escHtml(message)}</span><button class="tool-btn" onclick="loadData()">ลองอีกครั้ง</button>`;
  el('cards').innerHTML = '<div class="empty"><b>ยังไม่มีข้อมูลพร้อมแสดง</b><p>ตรวจการเชื่อมต่อ แล้วกดลองอีกครั้ง</p></div>';
  el('total-count').textContent = 'โหลดข้อมูลไม่สำเร็จ';
};
loadData = function(){
  const sequence = ++loadSequence, project = CURRENT_PROJECT;
  showLoading();
  el('app-message').hidden = true;
  el('total-count').textContent = 'กำลังโหลดข้อมูล…';
  if(!PLACES.length) el('cards').innerHTML = '<div class="skeleton-card" aria-label="กำลังโหลดข้อมูล"><i></i><i></i><i></i></div>'.repeat(4);
  const timeout = setTimeout(()=>{
    if(sequence!==loadSequence)return;
    loadSequence++;
    hideLoading();showError('การเชื่อมต่อใช้เวลานานเกินไป โปรดลองใหม่');
  },30000);
  if(typeof Papa==='undefined'){clearTimeout(timeout);hideLoading();showError('โหลดเครื่องมืออ่านข้อมูลไม่สำเร็จ กรุณารีเฟรชหน้าเว็บ');return;}
  Papa.parse(csvUrl(project), {
    download:true, header:false, skipEmptyLines:true,
    complete(res){
      clearTimeout(timeout);
      if(sequence!==loadSequence)return;
      try{
        if(!res.data || !res.data.length)throw Error('ไม่พบข้อมูลในชีต');
        buildHeaderMap(res.data[0],project.col);
        if(headerMap.name==null || headerMap.date==null)throw Error('ไม่พบคอลัมน์สถานที่หรือวันที่ กรุณาตรวจหัวตารางและสิทธิ์การแชร์ชีต');
        let rows=res.data.slice(1).map(normalize).filter(r=>r.name);
        if(project.filterCol)rows=rows.filter(r=>project.filterValues.includes(r[project.filterCol]));
        ROWS=rows;groupByPlace();buildListFilters();
        const previousFY=el('list-fy').value;
        el('list-fy').innerHTML='<option value="all">ทุกปี</option>'+getFYOptions().map(y=>`<option value="${y}">ปีงบ ${y}</option>`).join('');
        if([...el('list-fy').options].some(o=>o.value===previousFY))el('list-fy').value=previousFY;
        loadedAt=new Date().toLocaleString('th-TH',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
        el('total-count').textContent=`${PLACES.length.toLocaleString('th-TH')} สถานที่ · โหลดข้อมูล ${loadedAt}`;
        if(restoreView){
          el('search').value=savedView.get('q')||'';
          currentFilter=['all','pass','fail','wait'].includes(savedView.get('status'))?savedView.get('status'):'all';
          for(const [id,key] of [['list-fy','fy'],['flt-branch','branch'],['flt-province','province']]){
            const v=savedView.get(key);if(v&&[...el(id).options].some(o=>o.value===v))el(id).value=v;
          }
          const requestedTab=savedView.get('tab');
          if(['list','map','dash'].includes(requestedTab))activateTab(requestedTab,false);
        }
        page=0;render();mapInited=false;
        if(el('view-map').classList.contains('active')){initMap();mapInited=true;}
        if(el('view-dash').classList.contains('active'))initDash();
        restoreView=false;setProjectHeading();saveViewURL();
      }catch(err){showError(err.message);}finally{hideLoading();}
    },
    error(err){clearTimeout(timeout);if(sequence!==loadSequence)return;hideLoading();showError(err.message||'ไม่สามารถเชื่อมต่อ Google Sheets ได้');}
  });
};
const originalSwitchProject=switchProject;
switchProject=function(key){
  if(!PROJECTS[key])return;
  closeFilters();closeMapDetail();closeModal();
  el('list-fy').value='all';el('map-status').value='all';
  originalSwitchProject(key);setProjectHeading();
  el('list-summary').replaceChildren();el('result-info').textContent='';el('map-results').replaceChildren();el('map-count').textContent='กำลังโหลด…';
  if(el('view-dash').classList.contains('active'))initDash();saveViewURL();
};
function activateTab(tab, initialize=true){
  document.querySelectorAll('.tabs .tab').forEach((button,i)=>{
    const active=['list','map','dash'][i]===tab;button.classList.toggle('active',active);button.setAttribute('aria-current',active?'page':'false');
  });
  document.querySelectorAll('.view').forEach(view=>view.classList.toggle('active',view.id==='view-'+tab));
  if(initialize){
    if(tab==='map'){initMap();mapInited=true;setTimeout(()=>map?.invalidateSize(),60);}
    if(tab==='dash')initDash();
    saveViewURL();
  }
}
switchTab=function(tab){activateTab(tab);};
async function exportDashboard(event){
  const button=event.currentTarget||event.target.closest('button');
  if(!ROWS.length){toast('ยังไม่มีข้อมูลสำหรับบันทึก');return;}
  if(typeof html2canvas==='undefined'){toast('เครื่องมือบันทึกภาพยังโหลดไม่สำเร็จ กรุณารีเฟรชหน้า');return;}
  activateTab('dash');
  await document.fonts.ready;
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  saveDashJpeg({target:button});
}
const originalBuildListFilters=buildListFilters;
buildListFilters=function(){
  const branch=el('flt-branch').value,province=el('flt-province').value;
  originalBuildListFilters();
  for(const [id,value,label] of [['flt-branch',branch,'branch-label'],['flt-province',province,'province-label']]){
    el(label).hidden=el(id).options.length<2;
    if([...el(id).options].some(o=>o.value===value))el(id).value=value;
  }
};
applyFilters=function(){
  const q=el('search').value.trim().toLowerCase(),branch=el('flt-branch').value,province=el('flt-province').value;
  return PLACES.filter(p=>{
    const rows=currentPlaceRows(p);if(!rows.length)return false;
    return (!q || [p.name,p.code,...rows.map(r=>r.branch)].join(' ').toLowerCase().includes(q)) &&
      (currentFilter==='all'||placeStatus(rows)===currentFilter) &&
      (!branch||branch==='all'||rows.some(r=>r.branch===branch)) &&
      (!province||province==='all'||rows.some(r=>r.province===province));
  });
};
setFilter=function(filter){currentFilter=filter;page=0;render();};
function resetListFilters(){
  el('search').value='';['list-fy','flt-branch','flt-province'].forEach(id=>el(id).value='all');currentFilter='all';page=0;render();
}
function openFilters(){
  el('advanced-filters').classList.add('sheet-open');el('filter-backdrop').hidden=false;
  document.body.classList.add('filters-open');el('list-fy').focus();
}
function closeFilters(){
  const wasOpen=el('advanced-filters').classList.contains('sheet-open');
  el('advanced-filters').classList.remove('sheet-open');el('filter-backdrop').hidden=true;document.body.classList.remove('filters-open');
  if(wasOpen)document.querySelector('.filter-toggle').focus();
}
render=function(){
  filtered=applyFilters();
  filtered.sort((a,b)=>{
    const da=currentPlaceRows(a)[0]?.date||'',db=currentPlaceRows(b)[0]?.date||'';return sortDesc?db.localeCompare(da):da.localeCompare(db);
  });
  const items=filtered.slice(0,PAGE_SIZE*(page+1));
  el('cards').innerHTML=items.length?items.map(p=>renderCard(p,currentPlaceRows(p))).join(''):
    '<div class="empty"><div class="empty-icon">⌕</div><b>ไม่พบสถานที่ที่ตรงกัน</b><p>ลองเปลี่ยนคำค้นหาหรือล้างตัวกรอง</p><button class="tool-btn" onclick="resetListFilters()">ล้างตัวกรอง</button></div>';
  el('result-info').textContent=`แสดง ${items.length.toLocaleString('th-TH')} จาก ${filtered.length.toLocaleString('th-TH')} สถานที่`;
  el('load-more-btn').style.display=items.length<filtered.length?'block':'none';
  document.querySelectorAll('.filter-row button.chip').forEach((b,i)=>{const active=['all','pass','fail','wait'][i]===currentFilter;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
  const count={pass:0,fail:0,wait:0};
  PLACES.forEach(p=>{const rows=currentPlaceRows(p);if(rows.length)count[placeStatus(rows)]++;});
  el('list-summary').innerHTML=Object.entries(count).map(([status,n])=>`<button class="summary-item status-${status}" onclick="setFilter('${status}')"><span>${STATUS_LABEL[status]}</span><strong>${n.toLocaleString('th-TH')} <small>สถานที่</small></strong></button>`).join('');
  const active=[];
  for(const [id,label] of [['list-fy','ปีงบ'],['flt-branch','สาขา'],['flt-province','จังหวัด']]){
    const select=el(id);if(select.value&&select.value!=='all')active.push(`<button class="active-filter" onclick="el('${id}').value='all';page=0;render()">${label}: ${escHtml(select.selectedOptions[0].text)} <span aria-hidden="true">×</span></button>`);
  }
  el('active-filters').innerHTML=active.join('');el('filter-count').textContent=active.length?String(active.length):'';
  saveViewURL();
};
renderCard=function(p,rows=p.latestRows){
  const status=placeStatus(rows),date=rows[0]?.date||p.latestDate;
  const failed=[...new Set(rows.flatMap(failureNames))],waiting=[...new Set(rows.flatMap(waitingNames))];
  const summary=failed.length?`ไม่ผ่าน ${failed.length} พารามิเตอร์: ${failed.join(' · ')}`:waiting.length?`ยังไม่มีผล ${waiting.join(' · ')}`:'ค่าที่ตรวจครบผ่านเกณฑ์ทั้งหมด';
  return `<article class="card card-${status}"><div class="card-header"><h3 class="card-name">${escHtml(p.name)}</h3>${statusBadge(status)}</div>
    <div class="card-sub">${escHtml(rows[0]?.branch||'ไม่ระบุสาขา')} · เก็บตัวอย่าง ${escHtml(fmtDate(date))}</div>
    <p class="reading-summary status-${status}">${escHtml(summary)}</p>
    <details class="reading-details"><summary>ดูค่าตรวจล่าสุด <span>${rows.length} จุดเก็บ</span></summary>${rows.map(r=>`<div class="type-block"><div class="type-head"><div class="type-name">${escHtml(r.type||'ตัวอย่างน้ำ')}<div class="sample-point">${escHtml(r.point)}</div></div>${statusBadge(rowStatus(r))}</div><div class="stats-grid">${[['คลอรีน','mg/L',r.cl,statusCl(r.cl,r.type)],['ความขุ่น','NTU',r.turb,statusTurb(r.turb)],['pH','',r.ph,statusPH(r.ph)]].map(([name,unit,value,status])=>`<div class="stat"><div class="stat-val ${status==='bad'?'bad':''}">${valOr(value)}</div><div class="stat-label">${name} ${unit}</div></div>`).join('')}</div><div class="ecoli-row"><span>Coliform: ${bactDisplay(r.coliform,r.date,statusBact)}</span><span>E.coli: ${bactDisplay(r.ecoli,r.date,statusBact)}</span>${r.color?`<span>สี: ${valOr(r.color)}</span>`:''}${r.cond?`<span>การนำไฟฟ้า: ${valOr(r.cond)}</span>`:''}</div></div>`).join('')}</details>
    <div class="card-actions"><button class="act-btn act-history" onclick="openHistory('${p.uid}')">ประวัติผลตรวจ</button><button class="act-btn act-trend" onclick="openTrend('${p.uid}')">กราฟแนวโน้ม</button>${p.coord?`<button class="tool-btn" onclick="jumpToMap('${p.uid}')" aria-label="แสดง ${escHtml(p.name)} บนแผนที่">แผนที่ ↗</button>`:''}</div></article>`;
};

const originalRenderFamilyDash=renderFamilyDash;
renderFamilyDash=function(){
  if(!ROWS.length){el('fdb-total').textContent='0';el('fdb-meta').textContent='ไม่มีข้อมูล';['fdb-donuts','fdb-bars','fdb-table-left','fdb-table-right'].forEach(id=>el(id).replaceChildren());}
  else originalRenderFamilyDash();
  requestAnimationFrame(syncFamilyMonthHeight);
  saveViewURL();
};
const originalRenderDash=renderDash;
renderDash=function(fy){
  if(!rowsForFY(fy).length){
    ['db-total','db-pct','db-pass','db-fpct','db-fail','db-latest','db-r-pass','db-r-fail','db-r-wait','db-wait'].forEach(id=>el(id).textContent='—');
    ['db-types','db-params','db-fails','db-repeats','db-overdue','db-branches','db-worst'].forEach(id=>{if(el(id))el(id).replaceChildren();});
    drawDonut('db-donut-canvas',90,36,13,[],'—','ไม่มีข้อมูล');return;
  }
  originalRenderDash(fy);renderTypeComparisons(computeStats(rowsForFY(fy)));saveViewURL();
};
const originalInitDash=initDash;
let dashProject=null;
initDash=function(){
  const same=dashProject===CURRENT_PROJECT.key;
  const ids=['db-fy-sel','fdb-fy','fdb-month','fdb-province'];
  const values=Object.fromEntries(ids.map(id=>[id,el(id).value]));
  originalInitDash();
  const params={ 'db-fy-sel':'dashFY','fdb-fy':'dashFY','fdb-month':'month','fdb-province':'dashProvince'};
  ids.forEach(id=>{
    const value=restoreView?savedView.get(params[id]):same?values[id]:null;
    if(value&&[...el(id).options].some(o=>o.value===value))el(id).value=value;
  });
  dashProject=CURRENT_PROJECT.key;
  if(CURRENT_PROJECT.key==='family')renderFamilyDash();else renderDash(el('db-fy-sel').value);
};

placePassForFY=function(p,fy){
  const rows=fy==='all'?p.rows:p.rows.filter(r=>String(r.fy)===String(fy));if(!rows.length)return null;
  const latestDate=rows.reduce((d,r)=>r.date>d?r.date:d,'');
  const latestRows=rows.filter(r=>r.date===latestDate),status=placeStatus(latestRows);
  return {pass:status==='pass',status,latestDate,latestRows};
};
redrawMapMarkers=function(){
  if(!map)return;
  closeMapDetail();mapMarkers.forEach(({marker})=>map.removeLayer(marker));mapMarkers=[];
  const q=el('map-search-input').value.trim().toLowerCase(),status=el('map-status').value;
  PLACES.forEach(p=>{
    if(!p.coord || (q&&!p.name.toLowerCase().includes(q)))return;
    const result=placePassForFY(p,mapFY);if(!result||(status!=='all'&&status!==result.status))return;
    const marker=L.circleMarker(p.coord,{radius:7,fillColor:STATUS_COLOR[result.status],color:'#fff',weight:2,fillOpacity:.95,pane:'stationPane'}).addTo(map);
    marker.bindTooltip(`${escHtml(p.name)} · ${STATUS_LABEL[result.status]}`);
    marker.on('click',()=>selectMapPlace(p.uid));
    mapMarkers.push({marker,place:p,result});
  });
  el('map-count').textContent=mapMarkers.length.toLocaleString('th-TH')+' สถานที่';
  renderMapList();saveViewURL();
};
function renderMapList(){
  el('map-results').innerHTML=mapMarkers.length?mapMarkers.map(({place:p,result:r})=>`<button class="map-result" id="map-result-${p.uid}" onclick="selectMapPlace('${p.uid}')"><strong>${escHtml(p.name)}</strong><span>${escHtml(fmtDate(r.latestDate))}</span>${statusBadge(r.status)}</button>`).join(''):'<div class="map-empty">ไม่พบสถานที่ที่มีพิกัดตรงกับตัวกรอง</div>';
}
function selectMapPlace(id){
  const item=mapMarkers.find(x=>x.place.uid===id);if(!item)return;
  selectedMapPlace=id;
  mapMarkers.forEach(x=>x.marker.setStyle({radius:x===item?11:7,weight:x===item?3:2,color:x===item?'#172b4d':'#fff'}));
  map.setView(item.place.coord,Math.max(map.getZoom(),13));
  document.querySelectorAll('.map-result').forEach(b=>b.classList.toggle('selected',b.id==='map-result-'+id));
  const resultButton=el('map-result-'+id);
  if(resultButton){const panel=document.querySelector('.map-results-panel');panel.scrollTop=Math.max(0,resultButton.offsetTop-panel.offsetTop-100);}
  el('map-detail').innerHTML=`<button class="close-map-detail tool-btn" onclick="closeMapDetail()" aria-label="ปิดรายละเอียดสถานที่">×</button>`+renderCard(item.place,item.result.latestRows);
  el('map-detail').hidden=false;
}
function closeMapDetail(){selectedMapPlace=null;if(el('map-detail'))el('map-detail').hidden=true;}
function fitMapResults(){if(map&&mapMarkers.length)map.fitBounds(L.latLngBounds(mapMarkers.map(x=>x.place.coord)),{padding:[35,35],maxZoom:15});}
jumpToMap=function(id){
  const p=findPlace(id);if(!p?.coord)return;
  mapFY='all';el('map-status').value='all';el('map-search-input').value='';activateTab('map');
  setTimeout(()=>{map.invalidateSize();selectMapPlace(id);},70);
};
onMapSearchInput=function(){hideMapSuggest();redrawMapMarkers();};
const originalInitMap=initMap;
initMap=function(){
  if(typeof L==='undefined'){el('app-message').hidden=false;el('app-message').textContent='โหลดแผนที่ไม่สำเร็จ กรุณาตรวจการเชื่อมต่อแล้วรีเฟรชหน้า';return;}
  originalInitMap();map.invalidateSize();
  loadKmzData().catch(()=>toast('โหลดขอบเขตพื้นที่ไม่สำเร็จ แต่ยังดูจุดตรวจบนแผนที่ได้'));
};

function saveViewURL(){
  if(restoreView)return;
  const params=new URLSearchParams();params.set('project',CURRENT_PROJECT.key);
  const tab=document.querySelector('.view.active')?.id.replace('view-','')||'list';params.set('tab',tab);
  for(const [key,value] of [['q',el('search').value],['status',currentFilter],['fy',el('list-fy').value],['branch',el('flt-branch').value],['province',el('flt-province').value],['mapFY',mapFY],['mapStatus',el('map-status').value],['mapQ',el('map-search-input').value],['dashFY',el(CURRENT_PROJECT.key==='family'?'fdb-fy':'db-fy-sel').value],['month',el('fdb-month').value],['dashProvince',el('fdb-province').value]])if(value&&value!=='all')params.set(key,value);
  try{history.replaceState(null,'',location.pathname+'?'+params.toString());}catch{}
}
async function shareView(){saveViewURL();try{await navigator.clipboard.writeText(location.href);toast('คัดลอกลิงก์มุมมองนี้แล้ว');}catch{window.prompt('คัดลอกลิงก์มุมมองนี้',location.href);}}
function toast(message){let node=el('toast');if(!node){node=document.createElement('div');node.id='toast';node.setAttribute('role','status');document.body.append(node);}node.textContent=message;node.hidden=false;clearTimeout(window.toastTimeout);window.toastTimeout=setTimeout(()=>node.hidden=true,3500);}
const originalOpenHistory=openHistory,originalOpenTrend=openTrend,originalCloseModal=closeModal;
function focusDialog(){lastDialogFocus=document.activeElement;document.body.classList.add('dialog-open');el('modal').querySelector('.modal').focus();}
openHistory=function(id){originalOpenHistory(id);focusDialog();};
openTrend=function(id){originalOpenTrend(id);focusDialog();};
closeModal=function(){originalCloseModal();document.body.classList.remove('dialog-open');lastDialogFocus?.focus();};
document.addEventListener('keydown',event=>{
  if(event.key==='Escape'){closeModal();closeFdbDetail();closeFilters();closeMapDetail();closeSideMenu();}
  if(event.key!=='Tab')return;
  const container=el('modal').classList.contains('show')?el('modal'):el('advanced-filters').classList.contains('sheet-open')?el('advanced-filters'):null;
  if(!container)return;
  const focusable=[...container.querySelectorAll('button,select,input,a[href],summary,[tabindex="0"]')].filter(n=>!n.hidden&&n.getClientRects().length&&!n.disabled);
  const first=focusable[0],last=focusable[focusable.length-1];
  if(event.shiftKey&&(document.activeElement===first||!focusable.includes(document.activeElement))){event.preventDefault();last?.focus();}
  else if(!event.shiftKey&&(document.activeElement===last||!focusable.includes(document.activeElement))){event.preventDefault();first?.focus();}
});
window.addEventListener('resize',()=>{if(innerWidth>760)closeFilters();map?.invalidateSize();});
// Set up DOM before the original DOMContentLoaded handler requests data.
el('search').setAttribute('aria-label','ค้นหาชื่อสถานที่ รหัส หรือสาขา');
el('search').placeholder='ค้นหาสถานที่ รหัส หรือสาขา';
el('map-search-input').setAttribute('aria-label','ค้นหาสถานที่บนแผนที่');
el('db-fy-sel').setAttribute('aria-label','ปีงบประมาณของ Dashboard');
mapFY=savedView.get('mapFY')||'all';
el('map-status').value=['all','pass','fail','wait'].includes(savedView.get('mapStatus'))?savedView.get('mapStatus'):'all';
el('map-search-input').value=savedView.get('mapQ')||'';
const ICON_PATHS={refresh:'M20 7v5h-5 M4 17v-5h5 M6.1 6.1a8 8 0 0 1 13.2 3 M4.7 14.9a8 8 0 0 0 13.2 3',download:'M12 3v12 m-5-5 5 5 5-5 M5 16v5h14v-5',list:'M9 6h12 M9 12h12 M9 18h12 M3 6h1 M3 12h1 M3 18h1',map:'m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z M9 3v15 M15 6v15',chart:'M4 3v17h17 M8 15v-5 M13 15V6 M18 15v-8',share:'M14 3h7v7 M10 14 21 3 M10 4H4v16h16v-6'};
function uiIcon(name){return `<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${ICON_PATHS[name]||ICON_PATHS.list}"/></svg>`;}
document.querySelectorAll('.tabs .tab').forEach((b,i)=>b.innerHTML=uiIcon(['list','map','chart'][i])+b.textContent);
document.querySelector('.header-tools button[onclick="loadData()"]').innerHTML=uiIcon('refresh')+'<span>รีเฟรช</span>';
document.querySelector('.header-tools button[onclick="exportDashboard(event)"]').innerHTML=uiIcon('download')+'<span>บันทึกภาพ</span>';
document.querySelector('button[onclick="shareView()"]').innerHTML=uiIcon('share')+'แชร์มุมมอง';
function renderTypeComparisons(stats){
  el('db-type-title').textContent='สถานะผลตรวจแยกประเภทน้ำ';
  window._dbTypeData=stats.typeStats;
  el('db-types').innerHTML=Object.entries(stats.typeStats).sort((a,b)=>(b[1].pass+b[1].fail+b[1].wait)-(a[1].pass+a[1].fail+a[1].wait)).map(([name,v])=>{
    const total=v.pass+v.fail+v.wait;
    return `<button class="db-tcard comparison-row" onclick="toggleTypeDetail('${escJsAttr(name)}')"><div class="comparison-label"><span class="db-tcard-name">${escHtml(name)}</span><span>${total.toLocaleString('th-TH')} รายการ ↗</span></div><div class="comparison-track" aria-hidden="true">${['pass','fail','wait'].map(status=>`<span style="width:${total?v[status]/total*100:0}%;background:${STATUS_COLOR[status]}"></span>`).join('')}</div><div class="comparison-values">${['pass','fail','wait'].map(status=>`<span><i style="background:${STATUS_COLOR[status]}"></i>${STATUS_LABEL[status]} ${v[status]} <small>(${total?Math.round(v[status]/total*100):0}%)</small></span>`).join('')}</div></button>`;
  }).join('');
}
const originalToggleTypeDetail=toggleTypeDetail;
toggleTypeDetail=function(key){
  const v=window._dbTypeData?.[key];
  if(v&&!v.pass&&!v.fail){
    const panel=el('db-type-detail');const closing=_activeTypeKey===key;_activeTypeKey=closing?null:key;
    panel.style.display=closing?'none':'block';panel.innerHTML=closing?'':`<div class="db-alert">${escHtml(key)}: ${v.wait} รายการยังรอผลหรือมีข้อมูลไม่ครบ</div>`;return;
  }
  originalToggleTypeDetail(key);
  document.querySelectorAll('.db-tcard').forEach(button=>button.setAttribute('aria-expanded',String(button.querySelector('.db-tcard-name')?.textContent===_activeTypeKey)));
};
const originalOpenFdbDetail=openFdbDetail,originalCloseFdbDetail=closeFdbDetail;
let familyDialogFocus=null;
openFdbDetail=function(key){familyDialogFocus=document.activeElement;originalOpenFdbDetail(key);document.querySelector('.fdb-detail-modal').focus();document.body.classList.add('family-dialog-open');};
closeFdbDetail=function(){const open=el('fdb-detail-overlay').classList.contains('show');originalCloseFdbDetail();document.body.classList.remove('family-dialog-open');if(open)familyDialogFocus?.focus();};
document.addEventListener('keydown',event=>{
  if(event.key!=='Tab'||!el('fdb-detail-overlay').classList.contains('show')||el('modal').classList.contains('show'))return;
  const buttons=[...el('fdb-detail-overlay').querySelectorAll('button,[tabindex="0"],a[href]')].filter(n=>n.getClientRects().length);
  const first=buttons[0],last=buttons[buttons.length-1];
  if(event.shiftKey&&(document.activeElement===first||!buttons.includes(document.activeElement))){event.preventDefault();last?.focus();}
  else if(!event.shiftKey&&(document.activeElement===last||!buttons.includes(document.activeElement))){event.preventDefault();first?.focus();}
});

// The monthly table must never determine the height of the neighbouring water table.
function syncFamilyMonthHeight(){
  const reference=el(innerWidth>760?'fdb-left-column':'fdb-water-table-card');
  const height=reference?.offsetHeight;
  if(height>0)el('fdb-right-column').style.height=height+'px';
}
function scrollFamilyToLatestMonth(doc=document){
  const viewport=doc.getElementById('fdb-month-scroll');
  const table=doc.getElementById('fdb-table-right');
  if(!viewport||!table)return;
  const latest=[...table.querySelectorAll('tbody tr[data-latest-date]')].reduce((best,row)=>
    !best||row.dataset.latestDate>best.dataset.latestDate?row:best,null);
  if(!latest){viewport.scrollTop=0;return;}
  const headerHeight=table.tHead?.getBoundingClientRect().height||0;
  const footerHeight=table.tFoot?.getBoundingClientRect().height||0;
  const rowRect=latest.getBoundingClientRect(),viewRect=viewport.getBoundingClientRect();
  const rowTop=rowRect.top-viewRect.top+viewport.scrollTop-viewport.clientTop;
  const usableHeight=viewport.clientHeight-headerHeight-footerHeight;
  viewport.scrollTop=Math.max(0,Math.min(viewport.scrollHeight-viewport.clientHeight,
    rowTop-headerHeight-Math.max(0,(usableHeight-rowRect.height)/2)));
}
if(typeof ResizeObserver!=='undefined'){
  const monthHeightObserver=new ResizeObserver(syncFamilyMonthHeight);
  monthHeightObserver.observe(el('fdb-left-column'));
  monthHeightObserver.observe(el('fdb-water-table-card'));
}
window.addEventListener('resize',syncFamilyMonthHeight);
document.fonts.ready.then(syncFamilyMonthHeight);
