import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, PlusCircle, History, Calculator, Settings, 
  LogOut, Wallet, TrendingUp, AlertCircle, CheckCircle2, 
  Send, Trash2, Edit3, Loader2, Save, X, ChevronRight, 
  CreditCard, Banknote, Plus, Lock, Mail, User, Building2, Phone, Coins, Key
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
const appId = typeof __app_id !== 'undefined' ? __app_id : 'intraksi-ppob-v1';

const DEFAULT_CONFIG = {
  metodeBayar: ['TUNAI', 'TRANSFER', 'QRIS'],
  jenisTransaksi: ['TRANSFER BANK', 'TOP UP E-WALLET', 'TOKEN PLN', 'PULSA/DATA'],
  akunBank: ['BCA', 'MANDIRI', 'BNI', 'BRI', 'DANA', 'OVO'],
  statusBayar: ['BELUM BAYAR', 'SUDAH BAYAR']
};

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authMode, setAuthMode] = useState('login');
  const [authError, setAuthError] = useState(null);
  const [profile, setProfile] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [transactions, setTransactions] = useState([]);
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [editingTxId, setEditingTxId] = useState(null);
  const [bankBalances, setBankBalances] = useState({});
  const [toast, setToast] = useState(null);

  // NEW STATES FOR SETTINGS
  const [passFormData, setPassFormData] = useState({ newPassword: '', confirmPassword: '' });

  const [authForm, setAuthForm] = useState({ email: '', password: '', namaUsaha: '' });
  const [formData, setFormData] = useState({
    tanggal: new Date().toISOString().split('T')[0],
    jenisTransaksi: '', metodeBayar: '', akunBank: '', noRekTujuan: '',
    namaPelanggan: '', nominal: '', noWhatsapp: '', statusBayar: 'BELUM BAYAR'
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const profileRef = doc(db, 'artifacts', appId, 'users', currentUser.uid, 'settings', 'profile');
        const unsubProfile = onSnapshot(profileRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setProfile(data);
            if (data.config) setConfig(data.config);
            if (data.bankBalances) setBankBalances(data.bankBalances);
          }
          setLoading(false);
        });

        const txRef = collection(db, 'artifacts', appId, 'users', currentUser.uid, 'transactions');
        const unsubTx = onSnapshot(txRef, (snap) => {
          const txData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          txData.sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));
          setTransactions(txData);
        });

        return () => { unsubProfile(); unsubTx(); };
      } else {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setAuthError(null);
    try {
      if (authMode === 'register') {
        const userCredential = await createUserWithEmailAndPassword(auth, authForm.email, authForm.password);
        const user = userCredential.user;
        await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'profile'), {
          namaUsaha: authForm.namaUsaha.toUpperCase(),
          email: authForm.email,
          nomorTelepon: '',
          modalUsaha: 0,
          config: DEFAULT_CONFIG,
          bankBalances: {},
          createdAt: new Date().toISOString()
        });
      } else {
        await signInWithEmailAndPassword(auth, authForm.email, authForm.password);
      }
    } catch (err) {
      setAuthError("KESALAHAN OTENTIKASI: " + err.code);
    } finally { setLoading(false); }
  };

  const updateProfileField = async (field, value) => {
    if (!user) return;
    try {
      const profileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'profile');
      await updateDoc(profileRef, { [field]: value });
    } catch (e) {
      console.error("GAGAL UPDATE PROFIL:", e);
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    if (passFormData.newPassword !== passFormData.confirmPassword) {
      showToast("PASSWORD TIDAK COCOK!");
      return;
    }
    try {
      await updatePassword(auth.currentUser, passFormData.newPassword);
      showToast("PASSWORD BERHASIL DIGANTI");
      setPassFormData({ newPassword: '', confirmPassword: '' });
    } catch (err) {
      showToast("GAGAL: SILAKAN LOGIN ULANG UNTUK KEAMANAN");
    }
  };

  const updateConfig = (key, newList) => {
    const newConfig = { ...config, [key]: newList };
    setConfig(newConfig);
    updateProfileField('config', newConfig);
  };

  const stats = useMemo(() => {
    const omset = transactions.reduce((a, c) => a + (c.totalTagihan || 0), 0);
    const profit = transactions.reduce((a, c) => a + (c.fee || 0), 0);
    const pending = transactions.filter(t => t.statusBayar === 'BELUM BAYAR').reduce((a, c) => a + (c.totalTagihan || 0), 0);
    return { omset, profit, pending };
  }, [transactions]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.jenisTransaksi || !formData.metodeBayar || !formData.nominal) return;
    try {
      const txData = {
        ...formData,
        nominal: parseFloat(formData.nominal),
        fee: parseFloat(formData.fee || 0),
        totalTagihan: parseFloat(formData.nominal) + parseFloat(formData.fee || 0),
        timestamp: new Date().toISOString()
      };
      if (editingTxId) {
        await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'transactions', editingTxId), txData);
        setEditingTxId(null);
        showToast("TRANSAKSI DIPERBARUI");
      } else {
        await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'transactions'), txData);
        showToast("TRANSAKSI BERHASIL");
      }
      setFormData({
        tanggal: new Date().toISOString().split('T')[0],
        jenisTransaksi: '', metodeBayar: '', akunBank: '', noRekTujuan: '',
        namaPelanggan: '', nominal: '', fee: '', noWhatsapp: '', statusBayar: 'BELUM BAYAR'
      });
      setActiveTab('history');
    } catch (e) { showToast("GAGAL MENYIMPAN"); }
  };

  if (loading) return <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-blue-500 font-black italic uppercase tracking-widest"><Loader2 className="animate-spin mb-4" size={40} /> MENGHUBUNGKAN...</div>;

  if (!user) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4 font-black italic uppercase">
        <div className="w-full max-w-md bg-white p-10 rounded-[40px] shadow-2xl border-4 border-white">
          <h1 className="text-3xl text-blue-600 mb-8 text-center tracking-tighter">PPOB CLOUD</h1>
          {authError && <div className="bg-red-50 text-red-600 p-4 rounded-xl mb-4 text-[8px]">{authError}</div>}
          <form onSubmit={handleAuth} className="space-y-4">
            {authMode === 'register' && (
              <input required placeholder="NAMA USAHA" className="w-full p-4 bg-slate-50 rounded-2xl outline-none border-2 border-transparent focus:border-blue-500" value={authForm.namaUsaha} onChange={e => setAuthForm({...authForm, namaUsaha: e.target.value.toUpperCase()})} />
            )}
            <input required type="email" placeholder="EMAIL" className="w-full p-4 bg-slate-50 rounded-2xl outline-none border-2 border-transparent focus:border-blue-500" value={authForm.email} onChange={e => setAuthForm({...authForm, email: e.target.value})} />
            <input required type="password" placeholder="PASSWORD" className="w-full p-4 bg-slate-50 rounded-2xl outline-none border-2 border-transparent focus:border-blue-500" value={authForm.password} onChange={e => setAuthForm({...authForm, password: e.target.value})} />
            <button className="w-full bg-blue-600 text-white py-5 rounded-[25px] shadow-lg hover:bg-slate-900 transition-all">{authMode === 'login' ? 'MASUK' : 'DAFTAR'}</button>
          </form>
          <button onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')} className="w-full mt-6 text-slate-400 text-[10px]">{authMode === 'login' ? 'BUAT AKUN BARU' : 'SUDAH PUNYA AKUN'}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col md:flex-row font-black italic text-[10px] uppercase tracking-tighter">
      {toast && <div className="fixed top-6 right-6 z-50 bg-slate-900 text-white px-8 py-4 rounded-2xl border-l-8 border-blue-500 flex items-center gap-3 animate-bounce shadow-2xl"><CheckCircle2 size={18} /> {toast}</div>}

      {/* SIDEBAR */}
      <div className="w-full md:w-64 bg-white border-r-4 border-slate-100 flex flex-col shrink-0 h-screen sticky top-0">
        <div className="p-8 border-b-4 border-slate-50">
          <h1 className="text-blue-600 text-[14px] leading-none mb-1 truncate">{profile?.namaUsaha || 'USER'}</h1>
          <p className="text-slate-400 text-[8px] tracking-[0.2em] truncate">{user.email}</p>
        </div>
        <nav className="flex-1 p-6 space-y-2 overflow-y-auto">
          {[
            { id: 'dashboard', icon: LayoutDashboard },
            { id: 'input', icon: PlusCircle },
            { id: 'history', icon: History },
            { id: 'calculator', icon: Calculator },
            { id: 'settings', icon: Settings }
          ].map(item => (
            <button key={item.id} onClick={() => setActiveTab(item.id)} className={`w-full text-left flex items-center gap-4 px-6 py-4 rounded-2xl transition-all ${activeTab === item.id ? 'bg-blue-600 text-white shadow-xl scale-105' : 'text-slate-400 hover:bg-slate-50'}`}>
              <item.icon size={18} />
              {item.id.toUpperCase()}
            </button>
          ))}
        </nav>
        <div className="p-6 border-t-2 border-slate-50">
          <button onClick={() => signOut(auth)} className="w-full text-red-500 px-6 py-4 rounded-2xl hover:bg-red-50 text-left flex items-center gap-4"><LogOut size={18} /> KELUAR</button>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 p-4 md:p-10 overflow-y-auto custom-scrollbar">
        
        {activeTab === 'dashboard' && (
          <div className="space-y-8 max-w-5xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white p-6 rounded-[30px] shadow-lg border-4 border-white"><p className="text-slate-400 mb-1">OMSET</p><h2 className="text-lg">RP {stats.omset.toLocaleString()}</h2></div>
              <div className="bg-white p-6 rounded-[30px] shadow-lg border-4 border-white"><p className="text-green-600 mb-1">PROFIT</p><h2 className="text-lg">RP {stats.profit.toLocaleString()}</h2></div>
              <div className="bg-white p-6 rounded-[30px] shadow-lg border-4 border-white"><p className="text-orange-600 mb-1">PIUTANG</p><h2 className="text-lg">RP {stats.pending.toLocaleString()}</h2></div>
              <div className="bg-blue-600 p-6 rounded-[30px] shadow-lg border-4 border-blue-500 text-white"><p className="text-blue-200 mb-1">MODAL</p><h2 className="text-lg">RP {profile?.modalUsaha?.toLocaleString() || 0}</h2></div>
            </div>

            <div className="bg-white p-8 rounded-[40px] shadow-xl border-4 border-white h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={transactions.slice().reverse()}>
                  <defs><linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#2563eb" stopOpacity={0.3}/><stop offset="95%" stopColor="#2563eb" stopOpacity={0}/></linearGradient></defs>
                  <Tooltip contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontStyle: 'italic', fontWeight: '900', fontSize: '10px' }} />
                  <Area type="monotone" dataKey="profit" stroke="#2563eb" strokeWidth={4} fillOpacity={1} fill="url(#colorProfit)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {activeTab === 'input' && (
          <div className="max-w-2xl mx-auto bg-white p-10 rounded-[40px] shadow-xl border-4 border-white">
            <h2 className="text-xl mb-8 flex items-center gap-4"><PlusCircle className="text-blue-600" /> {editingTxId ? 'EDIT TRANSAKSI' : 'TRANSAKSI BARU'}</h2>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><label className="text-slate-400 ml-2">TANGGAL</label><input type="date" className="w-full p-4 bg-slate-50 rounded-2xl outline-none border-2 border-transparent focus:border-blue-500" value={formData.tanggal} onChange={e => setFormData({...formData, tanggal: e.target.value})} /></div>
                <div className="space-y-2"><label className="text-slate-400 ml-2">PELANGGAN</label><input placeholder="NAMA" className="w-full p-4 bg-slate-50 rounded-2xl outline-none border-2 border-transparent focus:border-blue-500" value={formData.namaPelanggan} onChange={e => setFormData({...formData, namaPelanggan: e.target.value.toUpperCase()})} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><label className="text-slate-400 ml-2">JENIS</label><select className="w-full p-4 bg-slate-50 rounded-2xl outline-none border-2 border-transparent focus:border-blue-500 appearance-none" value={formData.jenisTransaksi} onChange={e => setFormData({...formData, jenisTransaksi: e.target.value})}>
                  <option value="">PILIH</option>{config.jenisTransaksi.map(j => <option key={j} value={j}>{j}</option>)}
                </select></div>
                <div className="space-y-2"><label className="text-slate-400 ml-2">BANK/E-WALLET</label><select className="w-full p-4 bg-slate-50 rounded-2xl outline-none border-2 border-transparent focus:border-blue-500 appearance-none" value={formData.akunBank} onChange={e => setFormData({...formData, akunBank: e.target.value})}>
                  <option value="">PILIH</option>{config.akunBank.map(b => <option key={b} value={b}>{b}</option>)}
                </select></div>
              </div>
              <div className="space-y-2"><label className="text-slate-400 ml-2">NOMOR TUJUAN</label><input placeholder="REK / ID PELANGGAN / NO HP" className="w-full p-4 bg-slate-50 rounded-2xl outline-none border-2 border-transparent focus:border-blue-500" value={formData.noRekTujuan} onChange={e => setFormData({...formData, noRekTujuan: e.target.value})} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><label className="text-slate-400 ml-2">NOMINAL</label><input type="number" placeholder="RP" className="w-full p-4 bg-slate-50 rounded-2xl outline-none border-2 border-transparent focus:border-blue-500 font-bold" value={formData.nominal} onChange={e => setFormData({...formData, nominal: e.target.value})} /></div>
                <div className="space-y-2"><label className="text-slate-400 ml-2">FEE / ADMIN</label><input type="number" placeholder="RP" className="w-full p-4 bg-slate-50 rounded-2xl outline-none border-2 border-transparent focus:border-blue-500 font-bold" value={formData.fee} onChange={e => setFormData({...formData, fee: e.target.value})} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><label className="text-slate-400 ml-2">METODE</label><select className="w-full p-4 bg-slate-50 rounded-2xl outline-none border-2 border-transparent focus:border-blue-500 appearance-none" value={formData.metodeBayar} onChange={e => setFormData({...formData, metodeBayar: e.target.value})}>
                  <option value="">PILIH</option>{config.metodeBayar.map(m => <option key={m} value={m}>{m}</option>)}
                </select></div>
                <div className="space-y-2"><label className="text-slate-400 ml-2">STATUS</label><select className="w-full p-4 bg-slate-50 rounded-2xl outline-none border-2 border-transparent focus:border-blue-500 appearance-none" value={formData.statusBayar} onChange={e => setFormData({...formData, statusBayar: e.target.value})}>
                  {config.statusBayar.map(s => <option key={s} value={s}>{s}</option>)}
                </select></div>
              </div>
              <div className="flex gap-4 pt-4">
                <button type="submit" className="flex-1 bg-blue-600 text-white py-5 rounded-[25px] shadow-lg hover:bg-slate-900 transition-all flex items-center justify-center gap-3"><Save size={20}/> SIMPAN TRANSAKSI</button>
                {editingTxId && <button type="button" onClick={() => {setEditingTxId(null); setFormData({tanggal: new Date().toISOString().split('T')[0], statusBayar: 'BELUM BAYAR'});}} className="px-8 bg-slate-100 text-slate-400 rounded-[25px] hover:bg-slate-200 transition-all"><X size={20}/></button>}
              </div>
            </form>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-6 max-w-6xl mx-auto">
            <div className="flex justify-between items-center bg-white p-6 rounded-[30px] shadow-sm">
              <h2 className="text-lg flex items-center gap-4"><History className="text-blue-600" /> RIWAYAT TRANSAKSI</h2>
              <div className="flex gap-4">
                <div className="bg-slate-50 px-6 py-2 rounded-2xl border-2 border-slate-100"><p className="text-[8px] text-slate-400">TOTAL</p><p>{transactions.length} ITEM</p></div>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4">
              {transactions.map(tx => (
                <div key={tx.id} className="bg-white p-6 rounded-[35px] shadow-md border-4 border-white hover:border-blue-100 transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-6 group">
                  <div className="flex items-center gap-6">
                    <div className={`p-4 rounded-3xl ${tx.statusBayar === 'SUDAH BAYAR' ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-orange-600'}`}>
                      {tx.metodeBayar === 'TUNAI' ? <Banknote size={24}/> : <CreditCard size={24}/>}
                    </div>
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-sm">{tx.namaPelanggan || 'NONAME'}</h3>
                        <span className="text-[8px] px-3 py-1 bg-slate-100 rounded-full">{tx.tanggal}</span>
                      </div>
                      <p className="text-slate-400 text-[8px] tracking-widest">{tx.jenisTransaksi} • {tx.akunBank} • {tx.noRekTujuan}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-8 w-full md:w-auto justify-between md:justify-end">
                    <div className="text-right">
                      <p className="text-slate-400 text-[8px]">TOTAL TAGIHAN</p>
                      <h4 className="text-sm">RP {tx.totalTagihan?.toLocaleString()}</h4>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => {setFormData(tx); setEditingTxId(tx.id); setActiveTab('input');}} className="p-4 bg-slate-50 text-slate-400 rounded-2xl hover:bg-blue-50 hover:text-blue-600 transition-all"><Edit3 size={16}/></button>
                      <button onClick={async () => {if(confirm('HAPUS DATA?')) await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'transactions', tx.id));}} className="p-4 bg-slate-50 text-slate-400 rounded-2xl hover:bg-red-50 hover:text-red-600 transition-all"><Trash2 size={16}/></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="max-w-4xl mx-auto space-y-10">
            {/* 1. PROFIL USAHA & MODAL */}
            <div className="bg-white p-10 rounded-[40px] shadow-xl border-4 border-white">
              <div className="flex items-center gap-4 mb-8 border-b-2 border-slate-50 pb-4">
                <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl"><Building2 size={24} /></div>
                <h2 className="text-xl">PROFIL USAHA & MODAL</h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="text-slate-400 ml-2">NAMA USAHA</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                    <input className="w-full pl-12 p-4 bg-slate-50 rounded-2xl outline-none border-2 border-transparent focus:border-blue-500 font-black" value={profile?.namaUsaha || ''} onChange={e => updateProfileField('namaUsaha', e.target.value.toUpperCase())} />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-slate-400 ml-2">NOMOR TELEPON USAHA</label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                    <input className="w-full pl-12 p-4 bg-slate-50 rounded-2xl outline-none border-2 border-transparent focus:border-blue-500 font-black" placeholder="08..." value={profile?.nomorTelepon || ''} onChange={e => updateProfileField('nomorTelepon', e.target.value)} />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-slate-400 ml-2">ALAMAT EMAIL (TIDAK DAPAT DIUBAH)</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-200" size={18} />
                    <input disabled className="w-full pl-12 p-4 bg-slate-100 text-slate-400 rounded-2xl border-2 border-transparent font-black cursor-not-allowed" value={profile?.email || ''} />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-blue-600 font-black ml-2">INPUT MODAL USAHA (RP)</label>
                  <div className="relative">
                    <Coins className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-500" size={18} />
                    <input type="number" className="w-full pl-12 p-4 bg-blue-50 text-blue-600 rounded-2xl outline-none border-2 border-blue-100 focus:border-blue-500 font-black text-lg" placeholder="0" value={profile?.modalUsaha || ''} onChange={e => updateProfileField('modalUsaha', parseFloat(e.target.value) || 0)} />
                  </div>
                </div>
              </div>
            </div>

            {/* 2. KEAMANAN AKUN (GANTI SANDI) */}
            <div className="bg-white p-10 rounded-[40px] shadow-xl border-4 border-white">
              <div className="flex items-center gap-4 mb-8 border-b-2 border-slate-50 pb-4">
                <div className="p-3 bg-red-50 text-red-600 rounded-2xl"><Lock size={24} /></div>
                <h2 className="text-xl">KEAMANAN AKUN</h2>
              </div>
              
              <form onSubmit={handleUpdatePassword} className="grid grid-cols-1 md:grid-cols-2 gap-8 items-end">
                <div className="space-y-2">
                  <label className="text-slate-400 ml-2">KATA SANDI BARU</label>
                  <div className="relative">
                    <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                    <input required type="password" placeholder="MIN. 6 KARAKTER" className="w-full pl-12 p-4 bg-slate-50 rounded-2xl outline-none border-2 border-transparent focus:border-red-500 font-black" value={passFormData.newPassword} onChange={e => setPassFormData({...passFormData, newPassword: e.target.value})} />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-slate-400 ml-2">KONFIRMASI SANDI BARU</label>
                  <div className="relative">
                    <CheckCircle2 className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                    <input required type="password" placeholder="ULANGI SANDI" className="w-full pl-12 p-4 bg-slate-50 rounded-2xl outline-none border-2 border-transparent focus:border-red-500 font-black" value={passFormData.confirmPassword} onChange={e => setPassFormData({...passFormData, confirmPassword: e.target.value})} />
                  </div>
                </div>
                <button type="submit" className="md:col-span-2 w-full bg-slate-900 text-white py-5 rounded-[25px] shadow-lg hover:bg-red-600 transition-all font-black flex items-center justify-center gap-3"><Save size={20}/> PERBARUI KATA SANDI</button>
              </form>
            </div>

            {/* 3. KONFIGURASI LIST (FITUR LAMA YANG TETAP DIJAGA) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {Object.keys(DEFAULT_CONFIG).map(key => (
                <div key={key} className="bg-white p-8 rounded-[35px] border-4 border-white shadow-lg flex flex-col h-72">
                  <h3 className="mb-4 text-blue-600 border-b-2 border-slate-50 pb-2 text-[8px] tracking-widest">{key.toUpperCase()}</h3>
                  <div className="flex-1 overflow-y-auto space-y-2 mb-4 custom-scrollbar">
                    {config[key]?.map((item, idx) => (
                      <div key={idx} className="bg-slate-50 px-4 py-2 rounded-xl flex justify-between items-center group">
                        <span className="text-slate-700">{item}</span>
                        <button onClick={() => updateConfig(key, config[key].filter((_, i) => i !== idx))} className="text-red-200 opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all"><X size={12}/></button>
                      </div>
                    ))}
                  </div>
                  <form onSubmit={(e) => { e.preventDefault(); const val = e.target.newItem.value.toUpperCase(); if(val) { updateConfig(key, [...config[key], val]); e.target.reset(); }}} className="flex gap-2">
                    <input name="newItem" className="flex-1 p-3 bg-slate-50 border-2 border-transparent rounded-xl focus:border-blue-500 outline-none" placeholder="TAMBAH..." />
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
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #E2E8F0; border-radius: 20px; }
      `}</style>
    </div>
  );
}
