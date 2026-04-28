import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, PlusCircle, History, Calculator, Settings, 
  LogOut, Wallet, TrendingUp, AlertCircle, CheckCircle2, 
  Send, Trash2, Edit3, Loader2, Save, X, ChevronRight, 
  CreditCard, Banknote, Plus, Lock, Mail, User, Building2, Coins
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
  const [authMode, setAuthMode] = useState('login');
  const [authError, setAuthError] = useState(null);
  const [profile, setProfile] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [transactions, setTransactions] = useState([]);
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [editingTxId, setEditingTxId] = useState(null);
  const [bankBalances, setBankBalances] = useState({});
  const [toast, setToast] = useState(null);

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
          modalUsaha: 0,
          config: DEFAULT_CONFIG,
          bankBalances: {},
          createdAt: new Date().toISOString()
        });
      } else {
        await signInWithEmailAndPassword(auth, authForm.email, authForm.password);
      }
    } catch (err) {
      setAuthError("KESALAHAN LOGIN/REGISTER");
    } finally { setLoading(false); }
  };

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const updateProfileData = async (newData) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'profile'), newData);
      showToast("DATA DISIMPAN");
    } catch (e) { console.error(e); }
  };

  const saveTransaction = async (e) => {
    e.preventDefault();
    if (!user) return;
    const fee = 3000; // Contoh fee statis
    const total = (parseFloat(formData.nominal) || 0) + fee;
    const payload = { ...formData, nominal: parseFloat(formData.nominal), fee, totalTagihan: total, updatedAt: new Date().toISOString() };
    try {
      if (editingTxId) {
        await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'transactions', editingTxId), payload);
        setEditingTxId(null);
      } else {
        await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'transactions'), { ...payload, createdAt: new Date().toISOString() });
      }
      setActiveTab('history');
      showToast("TRANSAKSI BERHASIL");
    } catch (err) { console.error(err); }
  };

  const stats = useMemo(() => {
    const omset = transactions.reduce((a, c) => a + (c.totalTagihan || 0), 0);
    const profit = transactions.reduce((a, c) => a + (c.fee || 0), 0);
    const pending = transactions.filter(t => t.statusBayar === 'BELUM BAYAR').reduce((a, c) => a + (c.totalTagihan || 0), 0);
    return { omset, profit, pending };
  }, [transactions]);

  if (loading) return <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-blue-500 font-black italic uppercase tracking-widest"><Loader2 className="animate-spin mb-4" size={40} /> LOADING CLOUD...</div>;

  if (!user) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4 font-black italic uppercase">
        <div className="w-full max-w-md bg-white p-10 rounded-[40px] shadow-2xl border-4 border-white">
          <h1 className="text-3xl text-blue-600 mb-8 text-center">PPOB CLOUD</h1>
          {authError && <div className="bg-red-50 text-red-600 p-4 rounded-xl mb-4 text-[10px]">{authError}</div>}
          <form onSubmit={handleAuth} className="space-y-4">
            {authMode === 'register' && (
              <input required placeholder="NAMA USAHA" className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-blue-500 outline-none" value={authForm.namaUsaha} onChange={e => setAuthForm({...authForm, namaUsaha: e.target.value.toUpperCase()})} />
            )}
            <input required type="email" placeholder="EMAIL" className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-blue-500 outline-none" value={authForm.email} onChange={e => setAuthForm({...authForm, email: e.target.value})} />
            <input required type="password" placeholder="PASSWORD" className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-blue-500 outline-none" value={authForm.password} onChange={e => setAuthForm({...authForm, password: e.target.value})} />
            <button className="w-full bg-blue-600 text-white py-5 rounded-[25px] shadow-lg shadow-blue-100 hover:scale-105 transition-all">{authMode === 'login' ? 'MASUK' : 'DAFTAR'}</button>
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
          <h1 className="text-blue-600 text-[14px] leading-none mb-1">{profile?.namaUsaha || 'USER'}</h1>
          <p className="text-slate-400 text-[8px] tracking-[0.2em]">{user.email}</p>
        </div>
        <nav className="flex-1 p-6 space-y-2">
          {['dashboard', 'input', 'history', 'calculator', 'settings'].map(id => (
            <button key={id} onClick={() => setActiveTab(id)} className={`w-full text-left flex items-center gap-4 px-6 py-4 rounded-2xl transition-all ${activeTab === id ? 'bg-blue-600 text-white shadow-xl scale-105' : 'text-slate-400 hover:bg-slate-50'}`}>
              {id.toUpperCase()}
            </button>
          ))}
        </nav>
        <div className="p-6 border-t-2 border-slate-50">
          <button onClick={() => signOut(auth)} className="w-full text-red-500 px-6 py-4 rounded-2xl hover:bg-red-50">KELUAR</button>
        </div>
      </div>

      {/* CONTENT */}
      <div className="flex-1 p-4 md:p-10 overflow-y-auto">
        {activeTab === 'dashboard' && (
          <div className="space-y-8 max-w-5xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white p-6 rounded-[30px] shadow-lg border-4 border-white">
                <p className="text-slate-400 mb-1">OMSET</p>
                <h2 className="text-lg">RP {stats.omset.toLocaleString()}</h2>
              </div>
              <div className="bg-white p-6 rounded-[30px] shadow-lg border-4 border-white">
                <p className="text-green-600 mb-1">PROFIT</p>
                <h2 className="text-lg">RP {stats.profit.toLocaleString()}</h2>
              </div>
              <div className="bg-white p-6 rounded-[30px] shadow-lg border-4 border-white">
                <p className="text-orange-600 mb-1">PIUTANG</p>
                <h2 className="text-lg">RP {stats.pending.toLocaleString()}</h2>
              </div>
              <div className="bg-blue-600 p-6 rounded-[30px] shadow-lg border-4 border-blue-500 text-white">
                <p className="text-blue-200 mb-1">MODAL</p>
                <h2 className="text-lg">RP {profile?.modalUsaha?.toLocaleString() || 0}</h2>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'input' && (
          <div className="max-w-2xl mx-auto bg-white p-10 rounded-[40px] shadow-2xl border-4 border-white">
            <h2 className="text-xl mb-8 border-b-2 border-slate-50 pb-4 text-blue-600">INPUT BARU</h2>
            <form onSubmit={saveTransaction} className="space-y-4">
              <input placeholder="NAMA PELANGGAN" required className="w-full p-4 bg-slate-50 rounded-2xl outline-none border-2 border-transparent focus:border-blue-500" value={formData.namaPelanggan} onChange={e => setFormData({...formData, namaPelanggan: e.target.value.toUpperCase()})} />
              <input type="number" placeholder="NOMINAL" required className="w-full p-4 bg-slate-50 rounded-2xl outline-none border-2 border-transparent focus:border-blue-500" value={formData.nominal} onChange={e => setFormData({...formData, nominal: e.target.value})} />
              <input placeholder="NO WHATSAPP" required className="w-full p-4 bg-slate-50 rounded-2xl outline-none border-2 border-transparent focus:border-blue-500" value={formData.noWhatsapp} onChange={e => setFormData({...formData, noWhatsapp: e.target.value})} />
              <button className="w-full bg-blue-600 text-white py-5 rounded-[25px] mt-4 shadow-lg shadow-blue-100">SIMPAN TRANSAKSI</button>
            </form>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="max-w-4xl mx-auto space-y-8">
            <div className="bg-white p-10 rounded-[40px] shadow-xl border-4 border-white">
              <div className="flex items-center gap-4 mb-8 border-b-2 border-slate-50 pb-4">
                <Building2 className="text-blue-600" size={24} />
                <h2 className="text-xl">PENGATURAN PROFIL USAHA</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="text-slate-400 ml-2">NAMA USAHA</label>
                  <input className="w-full p-4 bg-slate-50 rounded-2xl outline-none border-2 border-transparent focus:border-blue-500 font-black" value={profile?.namaUsaha || ''} onChange={e => updateProfileData({ namaUsaha: e.target.value.toUpperCase() })} />
                </div>
                <div className="space-y-2">
                  <label className="text-blue-600 ml-2 font-black tracking-widest">INPUT MODAL USAHA (RP)</label>
                  <div className="relative">
                    <Coins className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-500" size={20} />
                    <input type="number" placeholder="0" className="w-full pl-12 p-4 bg-blue-50 rounded-2xl outline-none border-2 border-transparent focus:border-blue-600 text-blue-600 font-black text-lg shadow-inner" value={profile?.modalUsaha || ''} onChange={e => updateProfileData({ modalUsaha: parseFloat(e.target.value) || 0 })} />
                  </div>
                </div>
              </div>
            </div>
            <p className="text-center text-slate-300 text-[8px] tracking-[0.5em]">SEMUA PERUBAHAN TERSIMPAN OTOMATIS KE CLOUD</p>
          </div>
        )}
      </div>
    </div>
  );
}
