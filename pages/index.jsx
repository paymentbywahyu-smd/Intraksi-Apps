import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, PlusCircle, History, Calculator, Settings, 
  LogOut, Wallet, TrendingUp, AlertCircle, CheckCircle2, 
  Send, Trash2, Edit3, Loader2, Save, X, ChevronRight, 
  CreditCard, Banknote, Plus 
} from 'lucide-react';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  AreaChart, Area 
} from 'recharts';

// FIREBASE IMPORTS
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, collection, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';

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
const appId = 'intraksi-apps';

const DEFAULT_CONFIG = {
  metodeBayar: ['TUNAI', 'TRANSFER', 'QRIS'],
  jenisTransaksi: ['TRANSFER BANK', 'TOP UP E-WALLET', 'TOKEN PLN', 'PULSA/DATA'],
  akunBank: ['BCA', 'MANDIRI', 'BNI', 'BRI', 'DANA', 'OVO'],
  statusBayar: ['BELUM BAYAR', 'SUDAH BAYAR']
};

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [profile, setProfile] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [transactions, setTransactions] = useState([]);
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  
  // STATE UNTUK FITUR DASHBOARD (DARI KODE ASLI)
  const [editingTxId, setEditingTxId] = useState(null);
  const [formData, setFormData] = useState({
    tanggal: new Date().toISOString().split('T')[0],
    jenisTransaksi: '', metodeBayar: '', akunBank: '', noRekTujuan: '',
    namaPelanggan: '', nominal: '', noWhatsapp: '', statusBayar: 'BELUM BAYAR'
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // AMBIL PROFIL
        const profileRef = doc(db, 'users', currentUser.uid);
        onSnapshot(profileRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setProfile(data);
            if (data.config) setConfig(data.config);
          }
          setLoading(false);
        });

        // AMBIL TRANSAKSI (DARI KODE ASLI)
        const txRef = collection(db, 'users', currentUser.uid, 'transactions');
        onSnapshot(txRef, (snap) => {
          const txData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          txData.sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));
          setTransactions(txData);
        });
      } else {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleRegister = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const userCredential = await signInAnonymously(auth);
      const newUser = userCredential.user;
      const form = new FormData(e.target);

      const newProfile = {
        namaPemilik: form.get('namaPemilik').toUpperCase(),
        namaUsaha: form.get('namaUsaha').toUpperCase(),
        whatsapp: form.get('whatsapp'),
        modalAwal: parseFloat(form.get('modalAwal')) || 0,
        email: form.get('email'),
        config: DEFAULT_CONFIG,
        createdAt: new Date().toISOString(),
        userId: newUser.uid
      };

      await setDoc(doc(db, 'users', newUser.uid), newProfile);
      setProfile(newProfile);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // LOGIKA BISNIS (DARI KODE ASLI)
  const calculateFee = (nominal) => {
    const n = parseFloat(nominal);
    if (isNaN(n)) return 0;
    if (n < 100000) return 3000;
    if (n < 300000) return 5000;
    if (n < 1000000) return 7000;
    return n * 0.01;
  };

  const saveTransaction = async (e) => {
    e.preventDefault();
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
        await updateDoc(doc(db, 'users', user.uid, 'transactions', editingTxId), payload); 
        setEditingTxId(null); 
      } else { 
        payload.timestamp = new Date().toISOString(); 
        await addDoc(collection(db, 'users', user.uid, 'transactions'), payload); 
      }
      setActiveTab('history');
      setFormData({ 
        tanggal: new Date().toISOString().split('T')[0], 
        jenisTransaksi: '', metodeBayar: '', akunBank: '', noRekTujuan: '', 
        namaPelanggan: '', nominal: '', noWhatsapp: '', statusBayar: 'BELUM BAYAR' 
      });
    } catch (e) { setError(e.message); }
  };

  const stats = useMemo(() => {
    const omset = transactions.reduce((a, c) => a + c.totalTagihan, 0);
    const profit = transactions.reduce((a, c) => a + c.fee, 0);
    const pending = transactions.filter(t => t.statusBayar !== config.statusBayar[1]).reduce((a, c) => a + c.totalTagihan, 0);
    return { omset, profit, pending };
  }, [transactions, config]);

  if (loading && !profile) return <div className="min-h-screen bg-slate-900 flex items-center justify-center"><Loader2 className="animate-spin text-blue-500" size={40} /></div>;

  if (!profile) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-[40px] shadow-2xl overflow-hidden border-[8px] border-slate-800">
          <div className="bg-blue-600 p-8 text-center text-white">
            <h1 className="text-3xl font-black italic">INTRANKSI APPS</h1>
            <p className="text-[10px] font-bold uppercase mt-1 italic">DATABASE CLOUD PRO</p>
          </div>
          <div className="p-8">
            {error && <div className="mb-4 p-3 bg-red-50 text-red-600 text-[10px] font-bold rounded-xl uppercase">{error}</div>}
            <form onSubmit={handleRegister} className="space-y-4">
              <input name="namaPemilik" placeholder="NAMA PEMILIK" required className="w-full bg-slate-50 border p-4 rounded-2xl text-xs font-bold uppercase outline-none focus:border-blue-500 transition-all" />
              <input name="namaUsaha" placeholder="NAMA USAHA" required className="w-full bg-slate-50 border p-4 rounded-2xl text-xs font-bold uppercase outline-none focus:border-blue-500 transition-all" />
              <input name="whatsapp" placeholder="WHATSAPP (62...)" required className="w-full bg-slate-50 border p-4 rounded-2xl text-xs font-bold outline-none focus:border-blue-500 transition-all" />
              <input name="modalAwal" type="number" placeholder="MODAL AWAL" required className="w-full bg-slate-50 border p-4 rounded-2xl text-xs font-bold outline-none focus:border-blue-500 transition-all" />
              <input name="email" type="email" placeholder="EMAIL" required className="w-full bg-slate-50 border p-4 rounded-2xl text-xs font-bold outline-none focus:border-blue-500 transition-all" />
              <button type="submit" className="w-full bg-blue-600 text-white font-black py-5 rounded-2xl text-xs uppercase tracking-widest italic active:scale-95 transition-all">AKTIFKAN DATABASE</button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col md:flex-row font-sans">
      {/* SIDEBAR */}
      <div className="w-full md:w-72 bg-white border-r flex flex-col shrink-0">
        <div className="p-6 border-b"><h2 className="font-black text-xs uppercase italic text-blue-600">{profile.namaUsaha}</h2></div>
        <nav className="flex-1 p-4 space-y-1 font-black text-xs uppercase italic">
          {['dashboard', 'input', 'history', 'calculator', 'settings'].map(id => (
            <button key={id} onClick={() => setActiveTab(id)} className={`w-full flex items-center px-5 py-4 rounded-2xl ${activeTab === id ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'text-slate-400'}`}>{id}</button>
          ))}
          <button onClick={() => auth.signOut().then(() => window.location.reload())} className="w-full flex items-center px-5 py-4 text-red-500 rounded-2xl">KELUAR</button>
        </nav>
      </div>

      {/* CONTENT */}
      <div className="flex-1 p-8 overflow-y-auto">
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 font-black italic">
              <div className="bg-white p-6 rounded-[30px] border">OMSET: RP {stats.omset.toLocaleString()}</div>
              <div className="bg-white p-6 rounded-[30px] border text-green-600">PROFIT: RP {stats.profit.toLocaleString()}</div>
              <div className="bg-white p-6 rounded-[30px] border text-orange-600">PIUTANG: RP {stats.pending.toLocaleString()}</div>
            </div>
            <div className="h-80 bg-white p-6 rounded-[30px] border">
               <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={transactions.slice().reverse()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="tanggal" />
                    <YAxis />
                    <Tooltip />
                    <Area type="monotone" dataKey="totalTagihan" stroke="#2563eb" fill="#2563eb33" />
                  </AreaChart>
               </ResponsiveContainer>
            </div>
          </div>
        )}

        {activeTab === 'input' && (
          <div className="max-w-2xl mx-auto">
            <form onSubmit={saveTransaction} className="bg-white p-8 rounded-[30px] border space-y-4">
              <h2 className="font-black italic text-xs uppercase mb-4 tracking-widest text-slate-400">Input Transaksi Baru</h2>
              <input type="date" value={formData.tanggal} onChange={e => setFormData({...formData, tanggal: e.target.value})} className="w-full p-4 bg-slate-50 border rounded-2xl font-bold" />
              <select value={formData.jenisTransaksi} onChange={e => setFormData({...formData, jenisTransaksi: e.target.value})} className="w-full p-4 bg-slate-50 border rounded-2xl font-bold uppercase">
                <option value="">PILIH JENIS LAYANAN</option>
                {config.jenisTransaksi.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <input placeholder="NAMA PELANGGAN" value={formData.namaPelanggan} onChange={e => setFormData({...formData, namaPelanggan: e.target.value.toUpperCase()})} className="w-full p-4 bg-slate-50 border rounded-2xl font-bold uppercase" />
              <input type="number" placeholder="NOMINAL TRANSAKSI" value={formData.nominal} onChange={e => setFormData({...formData, nominal: e.target.value})} className="w-full p-4 bg-slate-50 border rounded-2xl font-bold" />
              <button type="submit" className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black italic uppercase text-xs tracking-widest">Simpan Ke Cloud</button>
            </form>
          </div>
        )}
        
        {/* TAB LAIN TETAP BISA ANDA TAMBAHKAN DI SINI SESUAI KEBUTUHAN */}
        <div className="mt-8">
           <h1 className="text-2xl font-black italic uppercase">Selamat Datang, {profile.namaPemilik}</h1>
           <p className="text-slate-400 font-bold text-xs mt-1 uppercase italic tracking-widest">Database cloud pro aktif</p>
        </div>
      </div>
    </div>
  );
}
