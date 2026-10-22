import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, ArrowDownRight, ArrowRight, BookOpen, CalendarDays, Check, CheckCircle2, ChevronDown, CircleHelp, Clock3, Command, Flame, GraduationCap, LayoutDashboard, ListTodo, Menu, MessageCircle, MoreHorizontal, Plus, Send, Sparkles, Target, TrendingUp, WandSparkles, X } from 'lucide-react';

type Task = { id:number; subject:string; topic:string; deadline:string; priority:'low'|'medium'|'high'; estimatedMinutes:number; completed:number; createdAt:string };
type Progress = { total:number; completed:number; pending:number; remainingMinutes:number; completionPercent:number };
type Plan = { date:string; availableMinutes:number; scheduledMinutes:number; plan:Array<{taskId:number;subject:string;topic:string;deadline:string;priority:string;plannedMinutes:number;status:string}>; note:string };
const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';
const today = new Date().toISOString().slice(0,10);
const dateLabel = (date:string) => new Date(`${date}T12:00:00`).toLocaleDateString('en-IN',{day:'numeric',month:'short'});

async function request<T>(path:string, init?:RequestInit):Promise<T> {
  const response = await fetch(`${API}${path}`, { ...init, headers: { 'Content-Type':'application/json', ...(init?.headers ?? {}) } });
  if (!response.ok) { const body = await response.json().catch(()=>({})); throw new Error(body.error ?? `Request failed (${response.status})`); }
  return response.json();
}

export default function App() {
  const [tasks,setTasks] = useState<Task[]>([]);
  const [progress,setProgress] = useState<Progress>({total:0,completed:0,pending:0,remainingMinutes:0,completionPercent:0});
  const [busy,setBusy] = useState(false);
  const [notice,setNotice] = useState('');
  const [chatInput,setChatInput] = useState('');
  const [messages,setMessages] = useState<Array<{role:'assistant'|'user';text:string}>>([{role:'assistant',text:'Hey Sarthak! 👋 Tell me what you need to study and how much time you have. I can create tasks and rescue a busy study day.'}]);
  const [showAdd,setShowAdd] = useState(false);
  const [form,setForm] = useState({subject:'Computer Networks',topic:'OSI and TCP/IP layers',deadline:today,priority:'high' as Task['priority'],estimatedMinutes:45});
  const [availableMinutes,setAvailableMinutes] = useState(120);
  const [plan,setPlan] = useState<Plan|null>(null);
  const [activeNav,setActiveNav] = useState('Overview');

  const refresh = useCallback(async () => {
    try {
      const [taskData,progressData] = await Promise.all([request<Task[]>('/api/tasks'),request<Progress>('/api/progress')]);
      setTasks(taskData); setProgress(progressData);
    } catch { setNotice(`Can't reach the API. Start the backend on ${API}.`); }
  },[]);
  useEffect(()=>{ void refresh(); },[refresh]);
  useEffect(()=>{ if(!notice) return; const id=window.setTimeout(()=>setNotice(''),5000); return ()=>window.clearTimeout(id); },[notice]);

  const pendingTasks = useMemo(()=>tasks.filter(t=>!t.completed),[tasks]);
  const dueSoon = useMemo(()=>[...pendingTasks].sort((a,b)=>a.deadline.localeCompare(b.deadline)).slice(0,4),[pendingTasks]);

  async function addTask() {
    setBusy(true);
    try {
      const created = await request<Task>('/api/tasks',{method:'POST',body:JSON.stringify(form)});
      await refresh(); setShowAdd(false); setNotice(`Added “${created.topic}” to your study list.`);
      setMessages(old=>[...old,{role:'assistant',text:`Done — I saved “${created.topic}” under ${created.subject}, due ${dateLabel(created.deadline)}. It’s marked ${created.priority} priority.`}]);
    } catch(e) { setNotice(e instanceof Error?e.message:'Could not create task'); }
    finally { setBusy(false); }
  }
  async function finishTask(task:Task) {
    try { await request(`/api/tasks/${task.id}/complete`,{method:'POST'}); await refresh(); setNotice(`Nice work! Completed ${task.topic}.`); }
    catch(e) { setNotice(e instanceof Error?e.message:'Could not update task'); }
  }
  async function rescueDay() {
    setBusy(true);
    try {
      const result=await request<Plan>('/api/replan',{method:'POST',body:JSON.stringify({availableMinutes,date:today})});
      setPlan(result);
      const lines=result.plan.filter(x=>x.plannedMinutes>0).map(x=>`• ${x.topic}: ${x.plannedMinutes} min`).join('\n');
      setMessages(old=>[...old,{role:'assistant',text:`I rebuilt your plan around ${availableMinutes} available minutes. I prioritized urgent work first.\n\n${lines || 'You have no unfinished tasks yet. Add a task to get started.'}\n\n${result.note}`}]);
      setNotice('Your study plan has been updated.');
    } catch(e) { setNotice(e instanceof Error?e.message:'Could not replan your day'); }
    finally { setBusy(false); }
  }
  async function sendMessage() {
    const text=chatInput.trim(); if(!text) return;
    setMessages(old=>[...old,{role:'user',text}]); setChatInput('');
    const lower=text.toLowerCase();
    if(lower.includes('rescue')||lower.includes('replan')||lower.includes('lost')||lower.includes('plan my day')) { await rescueDay(); return; }
    if(lower.includes('progress')||lower.includes('how am i doing')) {
      setMessages(old=>[...old,{role:'assistant',text:`You've completed ${progress.completed} of ${progress.total} tasks (${progress.completionPercent}%). There are ${progress.pending} tasks left, about ${progress.remainingMinutes} minutes of estimated work. Keep going!`}]); return;
    }
    if(lower.includes('show')&&lower.includes('task')) {
      const summary=pendingTasks.map(t=>`• ${t.topic} — ${t.subject}, due ${dateLabel(t.deadline)}`).join('\n');
      setMessages(old=>[...old,{role:'assistant',text:summary||'You have no pending tasks. Add one with the “Add task” button.'}]); return;
    }
    if(lower.includes('add task')||lower.includes('create task')) { setShowAdd(true); setMessages(old=>[...old,{role:'assistant',text:'I opened the task form. Fill in the subject, topic, deadline, and time estimate, then save it.'}]); return; }
    setMessages(old=>[...old,{role:'assistant',text:'I can help with your current study tasks. Try “show my tasks”, “check my progress”, or “rescue my study day”. You can also use Add task to save a new topic. The planning actions update your saved data.'}]);
  }

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-icon"><GraduationCap size={23}/></div><div><strong>studyflow<span>AI</span></strong><small>YOUR PERSONAL STUDY COACH</small></div></div>
      <div className="workspace-label">WORKSPACE</div>
      <nav>{[{name:'Overview',icon:LayoutDashboard},{name:'My tasks',icon:ListTodo},{name:'Study plan',icon:CalendarDays},{name:'AI coach',icon:MessageCircle}].map(({name,icon:Icon})=><button key={name} className={`nav-item ${activeNav===name?'active':''}`} onClick={()=>{setActiveNav(name);if(name==='AI coach')document.getElementById('chat')?.scrollIntoView({behavior:'smooth'});if(name==='My tasks')document.getElementById('tasks')?.scrollIntoView({behavior:'smooth'});if(name==='Study plan')document.getElementById('plan')?.scrollIntoView({behavior:'smooth'});}}><Icon size={18}/>{name}{name==='My tasks'&&pendingTasks.length>0&&<span className="nav-count">{pendingTasks.length}</span>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="streak-card"><div className="streak-icon"><Flame size={18}/></div><div><strong>Build your streak</strong><p>Small steps add up.</p></div><ArrowDownRight size={17}/></div><div className="profile"><div className="avatar">SJ</div><div className="profile-copy"><strong>Sarthak Jadhav</strong><small>Student workspace</small></div><MoreHorizontal size={19}/></div></div>
    </aside>
    <main className="main-content">
      <header className="topbar"><div className="breadcrumb"><span>Workspace</span><span className="slash">/</span><strong>{activeNav}</strong></div><div className="top-actions"><span className="today-chip"><CalendarDays size={15}/>{new Date().toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short'})}</span><button className="icon-button" aria-label="Help" onClick={()=>setNotice('Tip: add tasks, track progress, or use Rescue my study day to generate a prioritized plan.')}><CircleHelp size={18}/></button><div className="avatar small">SJ</div></div></header>
      <div className="page-wrap">
        <section className="welcome-row"><div><div className="eyebrow"><Sparkles size={14}/> YOUR LEARNING, IN FLOW</div><h1>Good afternoon, Sarthak <span className="wave">✦</span></h1><p className="subtitle">A little progress today goes a long way. Let's make it count.</p></div><button className="primary-button" onClick={()=>setShowAdd(true)}><Plus size={17}/> Add task</button></section>
        <section className="stats-grid">
          <div className="stat-card"><div className="stat-top"><span>Tasks completed</span><span className="stat-icon mint"><CheckCircle2 size={18}/></span></div><div className="stat-value">{progress.completed}<small> / {progress.total}</small></div><div className="mini-progress"><span style={{width:`${progress.completionPercent}%`}}/></div><div className="stat-foot"><span className="green-text"><TrendingUp size={13}/> {progress.completionPercent}%</span> overall completion</div></div>
          <div className="stat-card"><div className="stat-top"><span>Study time left</span><span className="stat-icon lilac"><Clock3 size={18}/></span></div><div className="stat-value">{Math.floor(progress.remainingMinutes/60)}<small>h </small>{progress.remainingMinutes%60}<small>m</small></div><div className="stat-foot">Estimated time across pending tasks</div></div>
          <div className="stat-card"><div className="stat-top"><span>Pending tasks</span><span className="stat-icon peach"><Target size={18}/></span></div><div className="stat-value">{progress.pending}<small> tasks</small></div><div className="stat-foot"><span className="orange-text">Stay focused</span> one task at a time</div></div>
          <div className="stat-card"><div className="stat-top"><span>Today's focus</span><span className="stat-icon blue"><Activity size={18}/></span></div><div className="stat-value">{plan?plan.scheduledMinutes:0}<small> min</small></div><div className="stat-foot">{plan?'Planned for today':'Run Rescue my study day'}</div></div>
        </section>
        <section className="content-grid">
          <div className="left-column">
            <section className="panel tasks-panel" id="tasks"><div className="panel-header"><div><h2>Up next</h2><p>Your nearest deadlines, all in one place.</p></div><button className="text-button" onClick={()=>setShowAdd(true)}>Add new <Plus size={15}/></button></div>
              {dueSoon.length===0?<div className="empty-state"><div className="empty-icon"><BookOpen size={22}/></div><strong>You're all caught up</strong><p>Add your next topic and we'll help you plan it.</p><button className="secondary-button" onClick={()=>setShowAdd(true)}><Plus size={15}/> Create first task</button></div>:<div className="task-list">{dueSoon.map((task,i)=><div className="task-row" key={task.id}><button className="task-check" aria-label={`Complete ${task.topic}`} onClick={()=>void finishTask(task)}><Check size={15}/></button><div className={`subject-mark mark-${i%4}`}>{task.subject.toLowerCase().includes('network')?'⌘':task.subject.toLowerCase().includes('java')?'J':task.subject.toLowerCase().includes('math')?'∑':'✦'}</div><div className="task-main"><strong>{task.topic}</strong><span>{task.subject}</span></div><div className="task-meta"><span className={`priority ${task.priority}`}>{task.priority}</span><span className="due-date"><CalendarDays size={13}/>{dateLabel(task.deadline)}</span></div><span className="task-duration"><Clock3 size={13}/>{task.estimatedMinutes}m</span></div>)}</div>}
              <div className="panel-footer"><span>Showing {dueSoon.length} of {pendingTasks.length} pending tasks</span><button className="subtle-link" onClick={()=>setActiveNav('My tasks')}>View all <ArrowRight size={14}/></button></div>
            </section>
            <section className="rescue-card" id="plan"><div className="rescue-content"><div className="rescue-tag"><WandSparkles size={14}/> SMART REPLANNING</div><h2>Plans changed?<br/>We've got you.</h2><p>Tell StudyFlow how much time you have. We'll prioritize the most urgent work and reshape today's plan.</p><div className="time-picker"><label htmlFor="minutes">Available study time</label><div><select id="minutes" value={availableMinutes} onChange={e=>setAvailableMinutes(Number(e.target.value))}><option value={30}>30 minutes</option><option value={60}>1 hour</option><option value={90}>1.5 hours</option><option value={120}>2 hours</option><option value={180}>3 hours</option><option value={240}>4 hours</option></select><button onClick={()=>void rescueDay()} disabled={busy}>{busy?'Planning…':'Rescue my day'} <ArrowRight size={15}/></button></div></div></div><div className="rescue-art"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="art-core"><Sparkles size={29}/></div><div className="float-card float-top"><CheckCircle2 size={15}/> Priorities sorted</div><div className="float-card float-bottom"><Clock3 size={15}/> Time optimized</div></div></section>
            {plan&&<section className="panel plan-result"><div className="panel-header"><div><h2>Your rescued plan</h2><p>{plan.scheduledMinutes} minutes scheduled · {dateLabel(plan.date)}</p></div><span className="result-pill"><CheckCircle2 size={14}/> Updated</span></div>{plan.plan.filter(x=>x.plannedMinutes>0).length===0?<p className="muted">No unfinished tasks yet. Add tasks to build a plan.</p>:plan.plan.filter(x=>x.plannedMinutes>0).map((item,i)=><div className="plan-row" key={item.taskId}><div className="plan-time">{item.plannedMinutes}m</div><div><strong>{item.topic}</strong><p>{item.subject} · {item.status}</p></div><span className={`priority ${item.priority}`}>{item.priority}</span></div>)}<p className="plan-note">{plan.note}</p></section>}
          </div>
          <div className="right-column">
            <section className="panel coach-panel" id="chat"><div className="panel-header"><div className="coach-title"><div className="coach-avatar"><Sparkles size={18}/></div><div><h2>StudyFlow coach</h2><p><span className="online-dot"/> Ready to help</p></div></div><button className="icon-button" aria-label="More options"><MoreHorizontal size={19}/></button></div><div className="coach-context"><div className="context-icon"><WandSparkles size={16}/></div><div><strong>Your study sidekick</strong><p>Ask about tasks, progress, or a new plan.</p></div></div><div className="chat-messages" aria-live="polite">{messages.slice(-6).map((message,i)=><div className={`message ${message.role}`} key={`${i}-${message.text.slice(0,12)}`}><div className="message-avatar">{message.role==='assistant'?<Sparkles size={14}/>:<span>SJ</span>}</div><div className="message-bubble">{message.text.split('\n').map((line,j)=><span key={j}>{line||' '}<br/></span>)}</div></div>)}</div><div className="suggestions"><button onClick={()=>setChatInput('Show my tasks')}>Show my tasks</button><button onClick={()=>setChatInput('Check my progress')}>My progress</button><button onClick={()=>setChatInput('Rescue my study day')}>Rescue my day</button></div><form className="chat-form" onSubmit={e=>{e.preventDefault();void sendMessage();}}><input value={chatInput} onChange={e=>setChatInput(e.target.value)} placeholder="Ask your study coach…" aria-label="Message study coach"/><button aria-label="Send message" type="submit"><Send size={17}/></button></form><div className="chat-disclaimer"><Command size={12}/> Demo assistant · Actions update your saved study data</div></section>
            <section className="tip-card"><div className="tip-icon"><Sparkles size={18}/></div><div><span className="tip-label">A SMALL REMINDER</span><h3>Progress over perfection.</h3><p>Try one focused 25-minute session. Starting is half the win.</p></div></section>
            <section className="panel week-panel"><div className="panel-header"><div><h2>Weekly rhythm</h2><p>Task completion at a glance</p></div><span className="week-badge">This week</span></div><div className="week-chart">{['M','T','W','T','F','S','S'].map((day,i)=><div className="day-column" key={`${day}${i}`}><div className="bar-track"><div className={`bar ${i===new Date().getDay()-1?'today-bar':''}`} style={{height:`${[32,56,42,76,48,22,18][i]}%`}}/></div><span className={i===new Date().getDay()-1?'current-day':''}>{day}</span></div>)}</div><div className="week-footer"><span><i/> Completion activity</span><strong>{progress.completionPercent}% overall</strong></div></section>
          </div>
        </section>
        <footer className="page-footer"><span>StudyFlow AI <span className="footer-dot">·</span> Built for students, one session at a time.</span><span className="connection"><span className="online-dot"/> API-powered workspace</span></footer>
      </div>
    </main>
    {showAdd&&<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setShowAdd(false);}}><form className="task-modal" onSubmit={e=>{e.preventDefault();void addTask();}}><div className="modal-heading"><div><div className="eyebrow"><Plus size={14}/> NEW STUDY TASK</div><h2>Add a task</h2><p>Turn a topic into your next small win.</p></div><button type="button" className="icon-button" onClick={()=>setShowAdd(false)} aria-label="Close"><X size={19}/></button></div><label>Subject<input required maxLength={100} value={form.subject} onChange={e=>setForm({...form,subject:e.target.value})}/></label><label>Topic to study<input required maxLength={200} value={form.topic} onChange={e=>setForm({...form,topic:e.target.value})}/></label><div className="form-two"><label>Deadline<input type="date" required value={form.deadline} onChange={e=>setForm({...form,deadline:e.target.value})}/></label><label>Priority<select value={form.priority} onChange={e=>setForm({...form,priority:e.target.value as Task['priority']})}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label></div><label>Estimated study time<select value={form.estimatedMinutes} onChange={e=>setForm({...form,estimatedMinutes:Number(e.target.value)})}><option value={15}>15 minutes</option><option value={30}>30 minutes</option><option value={45}>45 minutes</option><option value={60}>1 hour</option><option value={90}>1.5 hours</option><option value={120}>2 hours</option></select></label><div className="modal-actions"><button type="button" className="secondary-button" onClick={()=>setShowAdd(false)}>Cancel</button><button className="primary-button" disabled={busy}>{busy?'Saving…':'Save task'} <ArrowRight size={15}/></button></div></form></div>}
    {notice&&<div className="toast" role="status"><CheckCircle2 size={17}/>{notice}<button onClick={()=>setNotice('')} aria-label="Dismiss"><X size={15}/></button></div>}
  </div>;
}
