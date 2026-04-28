import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, PlusCircle, History, Calculator, Settings, 
  LogOut, Wallet, TrendingUp, AlertCircle, CheckCircle2, 
  Send, Trash2, Edit3, Loader2, Save, X, ChevronRight, 
  CreditCard, Banknote, Plus, Lock, Mail, User, Building2
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
  signOut
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
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'register'
  const [authError, setAuthError] = useState(null);
  const [profile, setProfile] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [transactions, setTransactions] = useState([]);
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [editingTxId, setEditingTxId] = useState(null);
  const [bankBalances, setBankBalances] = useState({});
  const [toast, setToast] = useState(null);

  // AUTH FORM STATE
  const [authForm, setAuthForm] = useState({
    email: '',
    password: '',
    namaUsaha: ''
  });

  const [formData, setFormData] = useState({
    tanggal: new Date().toISOString().split('T')[0],
    jenisTransaksi: '', metodeBayar: '', akunBank: '', noRekTujuan: '',
    namaPelanggan: '', nominal: '', noWhatsapp: '', statusBayar: 'BELUM BAYAR'
  });

  // FIREBASE AUTH & SYNC LOGIC
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

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setAuthError(null);
    try {
      if (authMode === 'register') {
        const userCredential = await createUserWithEmailAndPassword(auth, authForm.email, authForm.password);
        const user = userCredential.user;
        
        // CREATE INITIAL PROFILE
        await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'profile'), {
          namaUsaha: authForm.namaUsaha.toUpperCase(),
          email: authForm.email,
          config: DEFAULT_CONFIG,
          bankBalances: {},
          createdAt: new Date().toISOString()
        });
      } else {
        await signInWithEmailAndPassword(auth, authForm.email, authForm.password);
      }
    } catch (err) {
      let errorMsg = "TERJADI KESALAHAN";
      if (err.code === 'auth/user-not-found') errorMsg = "EMAIL TIDAK TERDAFTAR";
      if (err.code === 'auth/wrong-password') errorMsg = "PASSWORD SALAH";
      if (err.code === 'auth/email-already-in-use') errorMsg = "EMAIL SUDAH TERDAFTAR";
      setAuthError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const calculateFee = (nominal) => {
    const n = parseFloat(nominal) || 0;
    if (n < 100000) return 3000;
    if (n < 300000) return 5000;
    if (n < 1000000) return 7000;
    return Math.floor(n * 0.01);
  };

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const saveTransaction = async (e) => {
    e.preventDefault();
    if (!user) return;
    const fee = calculateFee(formData.nominal);
    const total = (parseFloat(formData.nominal) || 0) + fee;
    const payload = { 
      ...formData, 
      nominal: parseFloat(formData.nominal), 
      fee, 
      totalTagihan: total, 
      updatedAt: new Date().toISOString() 
    };

    try {
      if (editingTxId) {
        await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'transactions', editingTxId), payload);
        setEditingTxId(null);
        showToast("DATA BERHASIL DIPERBARUI");
      } else {
        payload.createdAt = new Date().toISOString();
        await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'transactions'), payload);
        showToast("DATA BERHASIL DISIMPAN");
      }
      setFormData({ 
        tanggal: new Date().toISOString().split('T')[0], 
        jenisTransaksi: '', metodeBayar: '', akunBank: '', noRekTujuan: '', 
        namaPelanggan: '', nominal: '', noWhatsapp: '', statusBayar: 'BELUM BAYAR' 
      });
      setActiveTab('history');
    } catch (err) { console.error(err); }
  };

  const updateConfig = async (key, newList) => {
    if (!user) return;
    const newConfig = { ...config, [key]: newList };
    setConfig(newConfig);
    await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'profile'), { config: newConfig });
  };

  const sendAgregatedWA = (targetTx) => {
    const pendingItems = transactions.filter(t => 
      t.noWhatsapp === targetTx.noWhatsapp && 
      t.statusBayar === 'BELUM BAYAR'
    );
    let total = 0;
    let detail = "";
    pendingItems.forEach((item, index) => {
      total += item.totalTagihan;
      detail += `${index + 1}. *${item.jenisTransaksi}* - RP ${item.totalTagihan.toLocaleString()}%0A`;
    });
    const pesan = `*TAGIHAN ${profile?.namaUsaha || 'PPOB'}*%0A%0AHALO *${targetTx.namaPelanggan}*, BERIKUT RINCIAN TAGIHAN ANDA:%0A%0A${detail}%0A*TOTAL: RP ${total.toLocaleString()}*%0A%0AMOHON SEGERA DISELESAIKAN. TERIMA KASIH!`;
    window.open(`https://wa.me/${targetTx.noWhatsapp}?text=${pesan}`, '_blank');
  };

  const stats = useMemo(() => {
    const omset = transactions.reduce((a, c) => a + (c.totalTagihan || 0), 0);
    const profit = transactions.reduce((a, c) => a + (c.fee || 0), 0);
    const pending = transactions.filter(t => t.statusBayar === 'BELUM BAYAR').reduce((a, c) => a + (c.totalTagihan || 0), 0);
    return { omset, profit, pending };
  }, [transactions]);

  const grandTotalAsset = useMemo(() => {
    const fisik = Object.values(bankBalances).reduce((a, b) => a + (parseFloat(b) || 0), 0);
    return fisik + stats.pending;
  }, [bankBalances, stats.pending]);

  // LOADING STATE
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center gap-4 text-blue-500 font-black italic tracking-widest uppercase">
        <Loader2 className="animate-spin" size={40} /> 
        MENGHUBUNGKAN KE CLOUD...
      </div>
    );
  }

  // LOGIN & REGISTER UI
  if (!user) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4 font-black italic uppercase tracking-tighter">
        <div className="w-full max-w-md bg-white p-10 rounded-[40px] shadow-2xl border-4 border-white">
          <div className="text-center mb-8">
            <h1 className="text-3xl text-blue-600 mb-2">PPOB CLOUD</h1>
            <p className="text-slate-400 text-[10px] tracking-widest">{authMode === 'login' ? 'MASUK KE DATABASE' : 'DAFTAR DATABASE BARU'}</p>
          </div>
          
          {authError && (
            <div className="bg-red-50 text-red-600 p-4 rounded-2xl mb-6 flex items-center gap-3 text-[10px]">
              <AlertCircle size={16} /> {authError}
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-4">
            {authMode === 'register' && (
              <div className="relative">
                <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  required
                  placeholder="NAMA USAHA / TOKO" 
                  className="w-full pl-12 p-4 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-blue-500 outline-none transition-all"
                  value={authForm.namaUsaha}
                  onChange={e => setAuthForm({...authForm, namaUsaha: e.target.value.toUpperCase()})}
                />
              </div>
            )}
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                required
                type="email"
                placeholder="ALAMAT EMAIL" 
                className="w-full pl-12 p-4 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-blue-500 outline-none transition-all"
                value={authForm.email}
                onChange={e => setAuthForm({...authForm, email: e.target.value})}
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                required
                type="password"
                placeholder="KATA SANDI" 
                className="w-full pl-12 p-4 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-blue-500 outline-none transition-all"
                value={authForm.password}
                onChange={e => setAuthForm({...authForm, password: e.target.value})}
              />
            </div>
            
            <button 
              type="submit" 
              className="w-full bg-blue-600 text-white py-5 rounded-[25px] shadow-lg shadow-blue-100 hover:scale-[1.02] active:scale-95 transition-all mt-4"
            >
              {authMode === 'login' ? 'MASUK SEKARANG' : 'BUAT AKUN CLOUD'}
            </button>
          </form>

          <div className="text-center mt-8">
            <button 
              onClick={() => { setAuthMode(authMode === 'login' ? 'register' : 'login'); setAuthError(null); }}
              className="text-slate-400 text-[10px] hover:text-blue-600"
            >
              {authMode === 'login' ? 'BELUM PUNYA AKUN? DAFTAR DISINI' : 'SUDAH PUNYA AKUN? MASUK DISINI'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // MAIN DASHBOARD UI (SAMA SEPERTI SEBELUMNYA)
  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col md:flex-row font-black italic text-[10px] uppercase tracking-tighter">
      {/* TOAST MESSAGE */}
      {toast && (
        <div className="fixed top-6 right-6 z-50 bg-slate-900 text-white px-8 py-4 rounded-2xl shadow-2xl border-l-8 border-blue-500 flex items-center gap-3 animate-bounce">
          <CheckCircle2 className="text-blue-500" size={18} /> {toast}
        </div>
      )}

      {/* SIDEBAR */}
      <div className="w-full md:w-64 bg-white border-r-4 border-slate-100 flex flex-col shrink-0 h-screen sticky top-0">
        <div className="p-8 border-b-4 border-slate-50">
          <h1 className="text-blue-600 text-[14px] leading-none mb-1">{profile?.namaUsaha || 'USAHA SAYA'}</h1>
          <p className="text-slate-400 text-[8px] tracking-[0.2em]">{user.email}</p>
        </div>
        <nav className="flex-1 p-6 space-y-2 overflow-y-auto custom-scrollbar">
          {[
            { id: 'dashboard', label: 'DASHBOARD', icon: LayoutDashboard },
            { id: 'input', label: 'INPUT BARU', icon: PlusCircle },
            { id: 'history', label: 'HISTORY DATA', icon: History },
            { id: 'calculator', label: 'KALKULATOR ASET', icon: Calculator },
            { id: 'settings', label: 'PENGATURAN', icon: Settings },
          ].map(item => (
            <button key={item.id} onClick={() => { setActiveTab(item.id); setEditingTxId(null); }} className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl transition-all ${activeTab === item.id ? 'bg-blue-600 text-white shadow-xl shadow-blue-100 scale-105' : 'text-slate-400 hover:bg-slate-50'}`}>
              <item.icon size={16} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="p-6 border-t-2 border-slate-50">
          <button onClick={() => signOut(auth)} className="w-full flex items-center gap-4 px-6 py-4 text-red-500 rounded-2xl hover:bg-red-50">
            <LogOut size={16} />
            <span>KELUAR AKUN</span>
          </button>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 p-4 md:p-10 overflow-y-auto">
        {activeTab === 'dashboard' && (
          <div className="space-y-8 max-w-5xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-white p-8 rounded-[40px] border-4 border-white shadow-xl">
                <p className="text-slate-400 mb-2">TOTAL OMSET</p>
                <h2 className="text-2xl text-slate-900">RP {stats.omset.toLocaleString()}</h2>
              </div>
              <div className="bg-white p-8 rounded-[40px] border-4 border-white shadow-xl">
                <p className="text-green-600 mb-2">PROFIT BERSIH</p>
                <h2 className="text-2xl text-green-600">RP {stats.profit.toLocaleString()}</h2>
              </div>
              <div className="bg-white p-8 rounded-[40px] border-4 border-white shadow-xl">
                <p className="text-orange-600 mb-2">PIUTANG PELANGGAN</p>
                <h2 className="text-2xl text-orange-600">RP {stats.pending.toLocaleString()}</h2>
              </div>
            </div>
            <div className="bg-white p-10 rounded-[40px] border-4 border-white shadow-xl h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={transactions.slice(0, 10).reverse()}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="tanggal" hide />
                  <YAxis hide />
                  <Tooltip />
                  <Area type="monotone" dataKey="totalTagihan" stroke="#2563eb" fill="#2563eb33" strokeWidth={4} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {activeTab === 'input' && (
          <div className="max-w-2xl mx-auto bg-white p-10 rounded-[40px] border-4 border-white shadow-2xl">
            <h2 className="text-xl mb-8 border-b-2 border-slate-50 pb-4 text-blue-600">{editingTxId ? 'EDIT DATA TRANSAKSI' : 'INPUT TRANSAKSI BARU'}</h2>
            <form onSubmit={saveTransaction} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <input type="date" value={formData.tanggal} onChange={e => setFormData({...formData, tanggal: e.target.value})} className="p-4 bg-slate-50 border-2 border-transparent rounded-2xl outline-none focus:border-blue-500" />
                <select required value={formData.jenisTransaksi} onChange={e => setFormData({...formData, jenisTransaksi: e.target.value})} className="p-4 bg-slate-50 border-2 border-transparent rounded-2xl outline-none focus:border-blue-500">
                  <option value="">PILIH LAYANAN</option>
                  {config.jenisTransaksi.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <input placeholder="NAMA PELANGGAN" required value={formData.namaPelanggan} onChange={e => setFormData({...formData, namaPelanggan: e.target.value.toUpperCase()})} className="w-full p-4 bg-slate-50 border-2 border-transparent rounded-2xl outline-none focus:border-blue-500" />
              <div className="grid grid-cols-2 gap-4">
                <input type="number" placeholder="NOMINAL" required value={formData.nominal} onChange={e => setFormData({...formData, nominal: e.target.value})} className="p-4 bg-slate-50 border-2 border-transparent rounded-2xl outline-none focus:border-blue-500" />
                <input placeholder="NOMOR WHATSAPP" required value={formData.noWhatsapp} onChange={e => setFormData({...formData, noWhatsapp: e.target.value})} className="p-4 bg-slate-50 border-2 border-transparent rounded-2xl outline-none focus:border-blue-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <select value={formData.metodeBayar} onChange={e => setFormData({...formData, metodeBayar: e.target.value})} className="p-4 bg-slate-50 border-2 border-transparent rounded-2xl outline-none focus:border-blue-500">
                  <option value="">METODE BAYAR</option>
                  {config.metodeBayar.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <select value={formData.akunBank} onChange={e => setFormData({...formData, akunBank: e.target.value})} className="p-4 bg-slate-50 border-2 border-transparent rounded-2xl outline-none focus:border-blue-500">
                  <option value="">AKUN TUJUAN</option>
                  {config.akunBank.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <select value={formData.statusBayar} onChange={e => setFormData({...formData, statusBayar: e.target.value})} className={`w-full p-4 border-2 border-transparent rounded-2xl outline-none focus:border-blue-500 ${formData.statusBayar === 'SUDAH BAYAR' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                {config.statusBayar.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <button type="submit" className="w-full bg-blue-600 text-white py-5 rounded-[25px] shadow-lg shadow-blue-200 mt-4 active:scale-95 transition-all">SIMPAN KE CLOUD DATABASE</button>
            </form>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="bg-white rounded-[40px] border-4 border-white shadow-xl overflow-hidden">
            <div className="p-8 border-b-2 border-slate-50 flex justify-between items-center">
              <h2 className="text-xl">RIWAYAT DATA TERBARU</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-slate-400">
                  <tr>
                    <th className="p-6">PELANGGAN</th>
                    <th className="p-6">LAYANAN</th>
                    <th className="p-6">TOTAL</th>
                    <th className="p-6">STATUS</th>
                    <th className="p-6 text-center">AKSI</th>
                  </tr>
                </thead>
                <tbody className="divide-y-2 divide-slate-50">
                  {transactions.map(tx => (
                    <tr key={tx.id} className="hover:bg-slate-50/50 group transition-all">
                      <td className="p-6">
                        <div className="font-black">{tx.namaPelanggan}</div>
                        <div className="text-[7px] text-slate-300">{tx.tanggal}</div>
                      </td>
                      <td className="p-6 text-slate-500">{tx.jenisTransaksi}</td>
                      <td className="p-6 text-blue-600">RP {tx.totalTagihan?.toLocaleString()}</td>
                      <td className="p-6">
                        <span className={`px-4 py-1 rounded-full text-[8px] ${tx.statusBayar === 'SUDAH BAYAR' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>{tx.statusBayar}</span>
                      </td>
                      <td className="p-6 flex justify-center gap-2">
                        <button onClick={() => sendAgregatedWA(tx)} className="p-2 bg-green-500 text-white rounded-lg hover:scale-110"><Send size={12}/></button>
                        <button onClick={() => { setFormData(tx); setEditingTxId(tx.id); setActiveTab('input'); }} className="p-2 bg-blue-500 text-white rounded-lg hover:scale-110"><Edit3 size={12}/></button>
                        <button onClick={async () => { if(confirm('HAPUS DATA?')) await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'transactions', tx.id)); }} className="p-2 text-red-200 hover:text-red-500"><Trash2 size={12}/></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'calculator' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            <div className="bg-white p-10 rounded-[40px] border-4 border-white shadow-xl space-y-4">
              <h2 className="text-xl mb-6 text-blue-600 flex items-center gap-2"><CreditCard/> SALDO FISIK & BANK</h2>
              {config.akunBank.map(bank => (
                <div key={bank} className="flex flex-col gap-1">
                  <span className="ml-4 text-[7px] text-slate-400">{bank}</span>
                  <input type="number" value={bankBalances[bank] || ''} onChange={async (e) => {
                    const newBalances = {...bankBalances, [bank]: e.target.value};
                    setBankBalances(newBalances);
                    await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'profile'), { bankBalances: newBalances });
                  }} className="w-full p-4 bg-slate-50 border-2 border-transparent rounded-2xl outline-none focus:border-blue-500" placeholder="0" />
                </div>
              ))}
            </div>
            <div className="bg-slate-900 p-10 rounded-[40px] text-white flex flex-col justify-center items-center text-center space-y-6">
              <div className="space-y-2">
                <p className="text-slate-500 text-[8px] tracking-[0.5em]">TOTAL SALDO + PIUTANG</p>
                <h3 className="text-4xl italic">RP {grandTotalAsset.toLocaleString()}</h3>
              </div>
              <div className="w-full h-1 bg-slate-800 rounded-full"></div>
              <div className="grid grid-cols-2 gap-4 w-full">
                <div className="p-4 bg-slate-800 rounded-2xl">
                  <p className="text-[7px] text-slate-500 mb-1">TOTAL CASH/BANK</p>
                  <p className="text-xs">RP {Object.values(bankBalances).reduce((a, b) => a + (parseFloat(b) || 0), 0).toLocaleString()}</p>
                </div>
                <div className="p-4 bg-slate-800 rounded-2xl">
                  <p className="text-[7px] text-slate-500 mb-1">TOTAL PIUTANG</p>
                  <p className="text-xs text-orange-500">RP {stats.pending.toLocaleString()}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="max-w-6xl mx-auto space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {Object.keys(DEFAULT_CONFIG).map(key => (
                <div key={key} className="bg-white p-8 rounded-[40px] border-4 border-white shadow-xl flex flex-col h-80">
                  <h3 className="mb-4 text-blue-600 border-b-2 border-slate-50 pb-2">{key.toUpperCase()}</h3>
                  <div className="flex-1 overflow-y-auto space-y-2 mb-4 custom-scrollbar">
                    {config[key].map((item, idx) => (
                      <div key={idx} className="bg-slate-50 px-4 py-2 rounded-xl flex justify-between items-center group">
                        <span className="text-slate-700">{item}</span>
                        <button onClick={() => updateConfig(key, config[key].filter((_, i) => i !== idx))} className="text-red-200 opacity-0 group-hover:opacity-100"><X size={12}/></button>
                      </div>
                    ))}
                  </div>
                  <form onSubmit={(e) => { e.preventDefault(); const val = e.target.newItem.value.toUpperCase(); if(val) { updateConfig(key, [...config[key], val]); e.target.reset(); }}} className="flex gap-2">
                    <input name="newItem" className="flex-1 p-3 bg-slate-50 border-2 border-transparent rounded-xl focus:border-blue-500 outline-none" placeholder="+" />
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
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #E2E8F0; border-radius: 20px; }
      `}</style>
    </div>
  );
}
