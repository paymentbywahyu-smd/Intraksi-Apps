import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, PlusCircle, History, Calculator, Settings, 
  LogOut, Wallet, TrendingUp, AlertCircle, CheckCircle2, 
  Send, Trash2, Edit3, Loader2, Save, X, ChevronRight, 
  CreditCard, Banknote, Plus, Lock, Mail, User, Building2, Phone
} from 'lucide-react';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  AreaChart, Area 
} from 'recharts';

// FIREBASE IMPORTS
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut,
  updatePassword
} from 'firebase/auth';
import { 
  getFirestore, doc, setDoc, onSnapshot, collection, 
  addDoc, updateDoc, deleteDoc 
} from 'firebase/firestore';

// GUNAKAN KONFIGURASI ASLI ANDA
const firebaseConfig = {
  apiKey: "AIzaSyAC2R3MExfYGVyeX_r81gw6eeowC4Cvn9M",
  authDomain: "intraksi-apps.firebaseapp.com",
  projectId: "intraksi-apps",
  storageBucket: "intraksi-apps.firebasestorage.app",
  messagingSenderId: "741631853497",
  appId: "1:741631853497:web:288406289b0bcede096c68"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = "ppob-manager-pro-v1";

const DEFAULT_CONFIG = {
  metodeBayar: ['TUNAI', 'TRANSFER', 'QRIS'],
  jenisTransaksi: ['TRANSFER BANK', 'TOP UP E-WALLET', 'TOKEN PLN', 'PULSA/DATA'],
  akunBank: ['BCA', 'MANDIRI', 'BNI', 'BRI', 'DANA', 'OVO'],
  statusBayar: ['BELUM BAYAR', 'SUDAH BAYAR']
};

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [transactions, setTransactions] = useState([]);
  const [profile, setProfile] = useState(null);
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [editingTxId, setEditingTxId] = useState(null);
  const [saveStatus, setSaveStatus] = useState('');
  
  // STATE UNTUK KALKULATOR SALDO
  const [bankBalances, setBankBalances] = useState({});

  const [formData, setFormData] = useState({
    tanggal: new Date().toISOString().split('T')[0],
    jenisTransaksi: '',
    metodeBayar: '',
    akunBank: '',
    noRekTujuan: '',
    namaPelanggan: '',
    nominal: '',
    noWhatsapp: '',
    statusBayar: 'BELUM BAYAR'
  });

  // AUTH LISTENER SESUAI LOGIKA ASLI
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // DATA FETCHING DENGAN GUARD USER
  useEffect(() => {
    if (!user) return;

    const profileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'settings');
    const unsubscribeProfile = onSnapshot(profileRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setProfile(data);
        if (data.config) setConfig(data.config);
      }
    });

    const txRef = collection(db, 'artifacts', appId, 'users', user.uid, 'transactions');
    const unsubscribeTx = onSnapshot(txRef, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));
      setTransactions(data);
    });

    return () => {
      unsubscribeProfile();
      unsubscribeTx();
    };
  }, [user]);

  const calculateFee = (nominal) => {
    const n = parseFloat(nominal);
    if (isNaN(n)) return 0;
    if (n < 100000) return 3000;
    if (n < 300000) return 5000;
    if (n < 1000000) return 7000;
    return n * 0.01;
  };

  const handleAuth = async (e, type) => {
    e.preventDefault();
    const email = e.target.email.value;
    const password = e.target.password.value;
    try {
      if (type === 'login') {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const res = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, 'artifacts', appId, 'users', res.user.uid, 'profile', 'settings'), {
          namaUsaha: e.target.namaUsaha.value.toUpperCase(),
          pemilik: e.target.namaPemilik.value.toUpperCase(),
          modalAwal: parseFloat(e.target.modalAwal.value) || 0,
          whatsapp: e.target.whatsapp.value,
          email: email,
          config: DEFAULT_CONFIG
        });
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    if (!user) return;
    setSaveStatus('loading');

    const newPass = e.target.newPassword.value;
    
    const updatedData = {
      namaUsaha: e.target.namaUsaha.value.toUpperCase(),
      pemilik: e.target.namaPemilik.value.toUpperCase(),
      email: e.target.email.value,
      whatsapp: e.target.whatsapp.value,
      modalAwal: parseFloat(e.target.modalAwal.value) || 0,
    };

    try {
      await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'settings'), updatedData);
      
      if (newPass) {
        await updatePassword(user, newPass);
      }

      setSaveStatus('success');
      setTimeout(() => setSaveStatus(''), 3000);
    } catch (err) {
      console.error(err);
      setSaveStatus('error');
    }
  };

  const saveTransaction = async (e) => {
    e.preventDefault();
    if (!user) return;

    const fee = calculateFee(formData.nominal);
    const payload = {
      ...formData,
      nominal: parseFloat(formData.nominal),
      fee,
      totalTagihan: parseFloat(formData.nominal) + fee,
      updatedAt: new Date().toISOString()
    };

    try {
      if (editingTxId) {
        await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'transactions', editingTxId), payload);
        setEditingTxId(null);
      } else {
        payload.createdAt = new Date().toISOString();
        await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'transactions'), payload);
      }
      setActiveTab('history');
      setFormData({ ...formData, nominal: '', namaPelanggan: '', noRekTujuan: '', noWhatsapp: '' });
    } catch (err) {
      alert(err.message);
    }
  };

  const updateConfig = async (key, newValue) => {
    if (!user) return;
    const newConfig = { ...config, [key]: newValue };
    await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'settings'), { config: newConfig });
  };

  const stats = useMemo(() => {
    const omset = transactions.reduce((a, c) => a + c.totalTagihan, 0);
    const profit = transactions.reduce((a, c) => a + c.fee, 0);
    const pending = transactions.filter(t => t.statusBayar !== 'SUDAH BAYAR').reduce((a, c) => a + c.totalTagihan, 0);
    return { omset, profit, pending };
  }, [transactions]);

  const totalRealtimeAsset = (Object.values(bankBalances).reduce((a, b) => a + (parseFloat(b) || 0), 0)) + stats.pending;

  if (loading) return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white font-black uppercase tracking-widest"><Loader2 className="animate-spin mr-2"/> MEMUAT DATABASE...</div>;

  if (!user) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden p-8">
        <h2 className="text-2xl font-black text-center mb-8 uppercase tracking-tighter">PPOB MANAGER LOGIN</h2>
        <form onSubmit={(e) => handleAuth(e, 'login')} className="space-y-4">
          <input name="email" type="email" placeholder="EMAIL" className="w-full p-4 bg-slate-50 border rounded-2xl outline-none font-bold uppercase text-xs" required />
          <input name="password" type="password" placeholder="PASSWORD" className="w-full p-4 bg-slate-50 border rounded-2xl outline-none font-bold uppercase text-xs" required />
          <button className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs">MASUK KE DASHBOARD</button>
        </form>
        <div className="mt-8 pt-8 border-t">
            <p className="text-center text-[10px] font-black text-slate-400 uppercase mb-4 tracking-widest">ATAU DAFTAR USAHA BARU</p>
            <form onSubmit={(e) => handleAuth(e, 'register')} className="space-y-3">
                <input name="namaUsaha" placeholder="NAMA USAHA" className="w-full p-3 bg-slate-50 border rounded-xl outline-none font-bold uppercase text-[10px]" required />
                <input name="namaPemilik" placeholder="NAMA PEMILIK" className="w-full p-3 bg-slate-50 border rounded-xl outline-none font-bold uppercase text-[10px]" required />
                <input name="modalAwal" type="number" placeholder="MODAL AWAL" className="w-full p-3 bg-slate-50 border rounded-xl outline-none font-bold uppercase text-[10px]" required />
                <input name="whatsapp" placeholder="WHATSAPP (62...)" className="w-full p-3 bg-slate-50 border rounded-xl outline-none font-bold uppercase text-[10px]" required />
                <input name="email" type="email" placeholder="EMAIL" className="w-full p-3 bg-slate-50 border rounded-xl outline-none font-bold uppercase text-[10px]" required />
                <input name="password" type="password" placeholder="PASSWORD" className="w-full p-3 bg-slate-50 border rounded-xl outline-none font-bold uppercase text-[10px]" required />
                <button className="w-full border-2 border-blue-600 text-blue-600 py-3 rounded-xl font-black uppercase tracking-widest text-[10px]">BUAT AKUN DATABASE</button>
            </form>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col md:flex-row">
      {/* SIDEBAR */}
      <div className="w-full md:w-72 bg-white border-r border-slate-200 p-6 space-y-8">
        <div className="flex items-center gap-3 px-2">
            <div className="bg-blue-600 p-2.5 rounded-2xl text-white shadow-lg shadow-blue-100"><TrendingUp size={22} strokeWidth={3}/></div>
            <div>
                <h1 className="font-black text-xs uppercase tracking-tighter leading-none">{profile?.namaUsaha || 'LOADING...'}</h1>
                <p className="text-[9px] font-black text-green-500 uppercase tracking-widest mt-1">CLOUD SYNC ACTIVE</p>
            </div>
        </div>

        <nav className="space-y-1">
          {[
            { id: 'dashboard', icon: LayoutDashboard, label: 'DASHBOARD' },
            { id: 'input', icon: PlusCircle, label: 'TRANSAKSI' },
            { id: 'history', icon: History, label: 'RIWAYAT' },
            { id: 'calculator', icon: Calculator, label: 'KALKULATOR' },
            { id: 'settings', icon: Settings, label: 'PENGATURAN' },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl font-black text-[11px] transition-all ${activeTab === item.id ? 'bg-blue-600 text-white shadow-xl shadow-blue-100' : 'text-slate-400 hover:bg-slate-50'}`}
            >
              <item.icon size={18} strokeWidth={3}/>
              <span className="uppercase tracking-widest">{item.label}</span>
            </button>
          ))}
        </nav>

        <button onClick={() => signOut(auth)} className="w-full flex items-center gap-4 px-4 py-4 text-red-400 font-black text-[11px] uppercase tracking-widest mt-20"><LogOut size={18}/> KELUAR SISTEM</button>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 p-4 md:p-10 overflow-y-auto">
        <header className="mb-10 flex justify-between items-center">
            <div>
                <h2 className="text-2xl font-black uppercase tracking-tighter text-slate-800">{activeTab}</h2>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">SISTEM KELOLA PPOB MODERN</p>
            </div>
            <div className="hidden md:flex gap-4">
                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Wallet size={16}/></div>
                    <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">MODAL USAHA</p>
                        <p className="font-black text-xs uppercase">RP {profile?.modalAwal?.toLocaleString() || 0}</p>
                    </div>
                </div>
            </div>
        </header>

        {activeTab === 'dashboard' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { label: 'TOTAL OMSET', val: stats.omset, color: 'blue', icon: TrendingUp },
                { label: 'KEUNTUNGAN', val: stats.profit, color: 'green', icon: Wallet },
                { label: 'PIUTANG PENDING', val: stats.pending, color: 'orange', icon: AlertCircle },
              ].map(card => (
                <div key={card.label} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                  <div className="flex justify-between items-start mb-4 text-xs">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{card.label}</span>
                    <div className={`p-2 bg-${card.color}-50 text-${card.color}-600 rounded-xl`}><card.icon size={20}/></div>
                  </div>
                  <p className="text-xl font-black uppercase text-xs">RP {card.val.toLocaleString()}</p>
                </div>
              ))}
            </div>
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
              <h3 className="font-black text-[11px] uppercase tracking-widest text-slate-400 mb-6">GRAFIK PERKEMBANGAN OMSET</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={transactions.slice().reverse()}>
                    <defs>
                      <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="tanggal" axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: '800', fill: '#94a3b8'}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: '800', fill: '#94a3b8'}} />
                    <Tooltip />
                    <Area type="monotone" dataKey="totalTagihan" stroke="#2563eb" fillOpacity={1} fill="url(#colorTotal)" strokeWidth={4} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'input' && (
          <div className="max-w-3xl mx-auto bg-white p-8 md:p-12 rounded-[3rem] border border-slate-100 shadow-sm">
            <form onSubmit={saveTransaction} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 text-xs">TANGGAL</label>
                    <input type="date" value={formData.tanggal} onChange={(e) => setFormData({...formData, tanggal: e.target.value})} className="w-full p-4 bg-slate-50 border-none rounded-2xl outline-none font-bold text-xs" required />
                </div>
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 text-xs">JENIS LAYANAN</label>
                    <select value={formData.jenisTransaksi} onChange={(e) => setFormData({...formData, jenisTransaksi: e.target.value})} className="w-full p-4 bg-slate-50 border-none rounded-2xl outline-none font-bold uppercase text-xs" required>
                        <option value="">PILIH LAYANAN</option>
                        {config.jenisTransaksi.map(j => <option key={j} value={j}>{j}</option>)}
                    </select>
                </div>
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 text-xs">PELANGGAN</label>
                    <input placeholder="NAMA PELANGGAN" value={formData.namaPelanggan} onChange={(e) => setFormData({...formData, namaPelanggan: e.target.value.toUpperCase()})} className="w-full p-4 bg-slate-50 border-none rounded-2xl outline-none font-bold uppercase text-xs" required />
                </div>
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 text-xs">NOMOR WHATSAPP</label>
                    <input placeholder="628..." value={formData.noWhatsapp} onChange={(e) => setFormData({...formData, noWhatsapp: e.target.value})} className="w-full p-4 bg-slate-50 border-none rounded-2xl outline-none font-bold text-xs" required />
                </div>
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 text-xs">NOMINAL UTAMA</label>
                    <input type="number" placeholder="0" value={formData.nominal} onChange={(e) => setFormData({...formData, nominal: e.target.value})} className="w-full p-4 bg-blue-50 border-none rounded-2xl outline-none font-black text-blue-600 text-lg text-xs" required />
                </div>
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 text-xs">SUMBER SALDO</label>
                    <select value={formData.akunBank} onChange={(e) => setFormData({...formData, akunBank: e.target.value})} className="w-full p-4 bg-slate-50 border-none rounded-2xl outline-none font-bold uppercase text-xs" required>
                        <option value="">PILIH BANK</option>
                        {config.akunBank.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                </div>
                <button className="md:col-span-2 w-full bg-blue-600 text-white py-5 rounded-[1.5rem] font-black uppercase tracking-widest text-xs shadow-xl shadow-blue-100 mt-4">SIMPAN DATA KE CLOUD</button>
            </form>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-50">
                  <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <th className="p-6">TANGGAL</th>
                    <th className="p-6">LAYANAN</th>
                    <th className="p-6">PELANGGAN</th>
                    <th className="p-6">TOTAL</th>
                    <th className="p-6">STATUS</th>
                    <th className="p-6">AKSI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {transactions.map(tx => (
                    <tr key={tx.id} className="text-xs font-bold uppercase text-slate-600 hover:bg-slate-50 transition-all">
                      <td className="p-6">{tx.tanggal}</td>
                      <td className="p-6"><span className="bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg text-[9px] font-black">{tx.jenisTransaksi}</span></td>
                      <td className="p-6">{tx.namaPelanggan}</td>
                      <td className="p-6 font-black text-slate-900 text-xs uppercase">RP {tx.totalTagihan.toLocaleString()}</td>
                      <td className="p-6">
                        <button 
                          onClick={async () => await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'transactions', tx.id), { statusBayar: tx.statusBayar === 'SUDAH BAYAR' ? 'BELUM BAYAR' : 'SUDAH BAYAR' })}
                          className={`px-4 py-2 rounded-xl text-[9px] font-black ${tx.statusBayar === 'SUDAH BAYAR' ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-orange-600'}`}
                        >
                          {tx.statusBayar}
                        </button>
                      </td>
                      <td className="p-6">
                        <div className="flex gap-2">
                           <button onClick={() => deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'transactions', tx.id))} className="p-2 text-red-300 hover:text-red-600"><Trash2 size={16}/></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'calculator' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-xs uppercase">
            <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm space-y-6">
              <h3 className="font-black uppercase tracking-tighter text-slate-800 text-xs">PENCATATAN SALDO FISIK</h3>
              {config.akunBank.map(bank => (
                <div key={bank} className="space-y-2">
                   <label className="text-[9px] font-black text-slate-400 tracking-widest ml-1">SALDO {bank}</label>
                   <input type="number" placeholder="0" value={bankBalances[bank] || ''} onChange={(e) => setBankBalances({...bankBalances, [bank]: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-black text-xs" />
                </div>
              ))}
            </div>
            <div className="bg-slate-900 p-10 rounded-[3rem] text-white space-y-8">
               <div className="space-y-1">
                  <p className="text-white/40 text-[10px] font-black tracking-widest text-xs">TOTAL ASET RIIL (SALDO + PIUTANG)</p>
                  <h4 className="text-3xl font-black text-xs uppercase tracking-tighter">RP {totalRealtimeAsset.toLocaleString()}</h4>
               </div>
               <div className="pt-8 border-t border-white/5 space-y-4">
                  <div className="flex justify-between items-center text-xs">
                     <span className="text-white/40 font-bold text-[10px] text-xs">TARGET MODAL AWAL</span>
                     <span className="font-black text-xs uppercase">RP {profile?.modalAwal?.toLocaleString()}</span>
                  </div>
                  <div className={`p-6 rounded-3xl flex items-center justify-between ${totalRealtimeAsset >= profile?.modalAwal ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                     <div className="text-xs">
                        <p className="text-[9px] font-black uppercase text-xs">STATUS KEUANGAN</p>
                        <p className="text-lg font-black text-xs uppercase">{totalRealtimeAsset >= profile?.modalAwal ? 'SURPLUS / AMAN' : 'DEFISIT / WARNING'}</p>
                     </div>
                     <CheckCircle2 size={32}/>
                  </div>
               </div>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-8">
            {/* FITUR BARU: PROFIL USAHA & MODAL */}
            <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm">
                <div className="flex justify-between items-center mb-8">
                    <h3 className="font-black uppercase tracking-tighter text-slate-800 flex items-center gap-3 text-xs">
                        <div className="w-1.5 h-6 bg-blue-600 rounded-full"></div> PROFIL USAHA & KONTROL MODAL
                    </h3>
                    {saveStatus === 'loading' && <Loader2 className="animate-spin text-blue-600"/>}
                    {saveStatus === 'success' && <CheckCircle2 className="text-green-500"/>}
                </div>
                
                <form onSubmit={handleUpdateProfile} className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2 text-xs"><Building2 size={14}/> NAMA USAHA</label>
                            <input name="namaUsaha" defaultValue={profile?.namaUsaha} className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold uppercase text-xs" required />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2 text-xs"><User size={14}/> NAMA PEMILIK</label>
                            <input name="namaPemilik" defaultValue={profile?.pemilik} className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold uppercase text-xs" required />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2 text-xs"><Mail size={14}/> EMAIL LOGIN</label>
                            <input name="email" type="email" defaultValue={profile?.email} className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold text-xs" required />
                        </div>
                    </div>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2 text-xs"><Phone size={14}/> TELEPON USAHA (62...)</label>
                            <input name="whatsapp" defaultValue={profile?.whatsapp} className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold text-xs" required />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2 text-xs"><Wallet size={14}/> INPUT MODAL USAHA (IDR)</label>
                            <input name="modalAwal" type="number" defaultValue={profile?.modalAwal} className="w-full p-4 bg-blue-50 rounded-2xl outline-none font-black text-blue-600 text-xs" required />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2 text-xs"><Lock size={14}/> GANTI SANDI (ISI JIKA INGIN UBAH)</label>
                            <input name="newPassword" type="password" className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold text-xs" />
                        </div>
                    </div>
                    <button className="md:col-span-2 w-full bg-blue-600 text-white py-5 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-blue-100 flex items-center justify-center gap-3">
                        <Save size={18}/> PERBARUI INFORMASI USAHA
                    </button>
                </form>
            </div>

            {/* MASTER DATA (LOGIKA ASLI) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {Object.keys(config).map(key => (
                <div key={key} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm text-xs uppercase">
                  <h4 className="font-black text-slate-400 text-[10px] uppercase tracking-widest mb-6">{key.replace(/([A-Z])/g, ' $1')}</h4>
                  <div className="space-y-2 mb-6 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                    {config[key].map((item, idx) => (
                      <div key={idx} className="bg-slate-50 px-4 py-3 rounded-xl flex justify-between items-center group">
                        <span className="text-slate-700 font-black text-[10px] text-xs uppercase">{item}</span>
                        <button onClick={() => updateConfig(key, config[key].filter((_, i) => i !== idx))} className="text-red-200 opacity-0 group-hover:opacity-100"><X size={14}/></button>
                      </div>
                    ))}
                  </div>
                  <form onSubmit={(e) => { e.preventDefault(); const val = e.target.newItem.value.toUpperCase(); if(val) { updateConfig(key, [...config[key], val]); e.target.reset(); }}} className="flex gap-2">
                    <input name="newItem" className="flex-1 p-3 bg-slate-50 border-none rounded-xl outline-none font-bold text-[10px] text-xs uppercase" placeholder="+" />
                    <button className="bg-blue-600 text-white px-4 rounded-xl hover:scale-105 active:scale-90 transition-all"><Plus size={16}/></button>
                  </form>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #E2E8F0; border-radius: 10px; }
      `}</style>
    </div>
  );
}
