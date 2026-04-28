import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, 
  PlusCircle, 
  History, 
  Calculator, 
  Settings, 
  LogOut, 
  Wallet, 
  TrendingUp, 
  AlertCircle,
  CheckCircle2,
  Send,
  Trash2,
  Edit3,
  Loader2,
  Save,
  X,
  ChevronRight,
  CreditCard,
  Banknote,
  Plus
} from 'lucide-react';
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';

// FIREBASE IMPORTS
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  signInWithCustomToken, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot
} from 'firebase/firestore';

// INITIALIZE FIREBASE FROM ENVIRONMENT
// INITIALIZE FIREBASE DIRECTLY
const firebaseConfig = {
  apiKey: "AIzaSyCCpjTjBCU1HnjCXrA8rb-VuWC67bWmvhw",
  authDomain: "intranksi-ppob.firebaseapp.com",
  projectId: "intranksi-ppob",
  storageBucket: "intranksi-ppob.firebasestorage.app",
  messagingSenderId: "729305891845",
  appId: "1:729305891845:web:feb0d2141d275efecf486c",
  measurementId: "G-CXP5QEC7YK"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'intranksi-ppob';
const APP_TITLE = "INTRANKSI APPS";

// DEFAULT MASTER DATA
const DEFAULT_CONFIG = {
  metodeBayar: ['TUNAI', 'TRANSFER', 'QRIS'],
  jenisTransaksi: ['TRANSFER BANK', 'TOP UP E-WALLET', 'TOKEN PLN', 'PULSA/DATA'],
  akunBank: ['BCA', 'MANDIRI', 'BNI', 'BRI', 'DANA', 'OVO'],
  statusBayar: ['BELUM BAYAR', 'SUDAH BAYAR']
};

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [transactions, setTransactions] = useState([]);
  const [profile, setProfile] = useState(null);
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [editingTxId, setEditingTxId] = useState(null);

  // STATE UNTUK KALKULATOR SALDO
  const [bankBalances, setBankBalances] = useState({});

  // STATE UNTUK FORM TRANSAKSI
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

  // INITIALIZE AUTHENTICATION
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("AUTH ERROR:", error);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  // DATA FETCHING
  useEffect(() => {
    if (!user) return;

    const profileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'settings');
    const unsubscribeProfile = onSnapshot(profileRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setProfile(data);
        if (data.config) setConfig(data.config);
      }
    }, (error) => console.error("PROFILE FETCH ERROR:", error));

    const txCollection = collection(db, 'artifacts', appId, 'users', user.uid, 'transactions');
    const unsubscribeTx = onSnapshot(txCollection, (snapshot) => {
      const txData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      txData.sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));
      setTransactions(txData);
    }, (error) => console.error("TX FETCH ERROR:", error));

    return () => {
      unsubscribeProfile();
      unsubscribeTx();
    };
  }, [user]);

  const calculateFee = (nominal) => {
    const n = parseFloat(nominal);
    if (isNaN(n)) return 0;
    if (n < 100000) return 3000;
    if (n >= 100000 && n < 300000) return 5000;
    if (n >= 300000 && n < 1000000) return 7000;
    return n * 0.01;
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!user) return;

    // AMBIL DATA DARI FORM DENGAN CARA YANG LEBIH AMAN
    const target = e.target;
    const newProfile = {
      namaUsaha: target[1].value.toUpperCase(), // INPUT KEDUA (NAMA USAHA)
      pemilik: target[0].value.toUpperCase(),   // INPUT PERTAMA (NAMA PEMILIK)
      modalAwal: parseFloat(target[3].value) || 0,
      whatsapp: target[2].value,
      email: target[4].value,
      config: DEFAULT_CONFIG,
      createdAt: new Date().toISOString()
    };

    try {
      console.log("MENCOBA MENYIMPAN PROFIL...");
      await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'settings'), newProfile);
      console.log("PROFIL BERHASIL DISIMPAN!");
      // REFRESH HALAMAN AGAR STATE PROFILE TER-UPDATE
      window.location.reload(); 
    } catch (error) {
      console.error("REGISTRATION ERROR:", error);
      alert("GAGAL MENYIMPAN KE DATABASE: " + error.message);
    }
  };

  const saveTransaction = async (e) => {
    e.preventDefault();
    if (!user) return;

    const fee = calculateFee(formData.nominal);
    const total = parseFloat(formData.nominal) + fee;
    
    const payload = {
      ...formData,
      nominal: parseFloat(formData.nominal),
      fee: fee,
      totalTagihan: total,
      updatedAt: new Date().toISOString()
    };

    try {
      if (editingTxId) {
        await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'transactions', editingTxId), payload);
        setEditingTxId(null);
      } else {
        payload.timestamp = new Date().toISOString();
        await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'transactions'), payload);
      }
      
      setActiveTab('history');
      resetForm();
    } catch (error) {
      console.error("SAVE ERROR:", error);
    }
  };

  const resetForm = () => {
    setFormData({
      tanggal: new Date().toISOString().split('T')[0],
      jenisTransaksi: '',
      metodeBayar: '',
      akunBank: '',
      noRekTujuan: '',
      namaPelanggan: '',
      nominal: '',
      noWhatsapp: '',
      statusBayar: config.statusBayar[0] || 'BELUM BAYAR'
    });
    setEditingTxId(null);
  };

  const handleEditClick = (tx) => {
    setFormData({
      tanggal: tx.tanggal,
      jenisTransaksi: tx.jenisTransaksi,
      metodeBayar: tx.metodeBayar,
      akunBank: tx.akunBank,
      noRekTujuan: tx.noRekTujuan,
      namaPelanggan: tx.namaPelanggan,
      nominal: tx.nominal.toString(),
      noWhatsapp: tx.noWhatsapp,
      statusBayar: tx.statusBayar
    });
    setEditingTxId(tx.id);
    setActiveTab('input');
  };

  const updateConfig = async (key, newValue) => {
    if (!user) return;
    const newConfig = { ...config, [key]: newValue };
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'settings'), {
        config: newConfig
      });
    } catch (error) {
      console.error("CONFIG UPDATE ERROR:", error);
    }
  };

  const deleteTransaction = async (id) => {
    if (!user || !window.confirm("APAKAH ANDA YAKIN INGIN MENGHAPUS DATA INI?")) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'transactions', id));
    } catch (error) {
      console.error("DELETE ERROR:", error);
    }
  };

  const toggleStatus = async (tx) => {
    if (!user) return;
    const nextStatus = tx.statusBayar === config.statusBayar[0] ? config.statusBayar[1] : config.statusBayar[0];
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'transactions', tx.id), {
        statusBayar: nextStatus
      });
    } catch (error) {
      console.error("STATUS TOGGLE ERROR:", error);
    }
  };

  // LOGIKA KIRIM WHATSAPP OTOMATIS AGREGASI
  const sendWhatsAppNotification = (targetTx) => {
    // CARI SEMUA TRANSAKSI PENDING UNTUK NOMOR WHATSAPP YANG SAMA
    const pendingSameUser = transactions.filter(t => 
      t.noWhatsapp === targetTx.noWhatsapp && 
      t.statusBayar !== config.statusBayar[1]
    );

    let message = `*NOTIFIKASI TAGIHAN ${profile.namaUsaha}*%0A%0A`;
    message += `HALO *${targetTx.namaPelanggan}*,%0A`;
    message += `BERIKUT ADALAH RINCIAN TAGIHAN ANDA YANG BELUM TERSELESAIKAN:%0A%0A`;

    let totalGabungan = 0;
    pendingSameUser.forEach((item, index) => {
      message += `${index + 1}. *${item.jenisTransaksi}*%0A`;
      message += `   TGL: ${item.tanggal}%0A`;
      message += `   NOMINAL: RP ${item.totalTagihan.toLocaleString()}%0A%0A`;
      totalGabungan += item.totalTagihan;
    });

    message += `----------------------------%0A`;
    message += `*TOTAL HARUS DIBAYAR: RP ${totalGabungan.toLocaleString()}*%0A`;
    message += `----------------------------%0A%0A`;
    message += `MOHON SEGERA MELAKUKAN PEMBAYARAN MELALUI KASIR ATAU TRANSFER.%0A`;
    message += `TERIMA KASIH!`;

    window.open(`https://wa.me/${targetTx.noWhatsapp}?text=${message}`);
  };

  const stats = useMemo(() => {
    const omset = transactions.reduce((acc, curr) => acc + curr.totalTagihan, 0);
    const profit = transactions.reduce((acc, curr) => acc + curr.fee, 0);
    const pending = transactions.filter(t => t.statusBayar !== config.statusBayar[1]).reduce((acc, curr) => acc + curr.totalTagihan, 0);
    return { omset, profit, pending };
  }, [transactions, config]);

  const totalPhysicalBalance = Object.values(bankBalances).reduce((acc, curr) => acc + (parseFloat(curr) || 0), 0);
  const totalRealtimeAsset = totalPhysicalBalance + stats.pending;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Loader2 className="animate-spin text-blue-500" size={48} />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
          <div className="bg-blue-600 p-8 text-white text-center">
            <h1 className="text-3xl font-bold tracking-tighter uppercase">{APP_TITLE}</h1>
            <p className="opacity-80 mt-2 font-bold uppercase tracking-widest text-[10px]">DATABASE CLOUD PRO</p>
          </div>
          <div className="p-8">
            <h2 className="text-xl font-black mb-6 text-slate-800 text-center uppercase tracking-tight text-xs">PENDAFTARAN USAHA BARU</h2>
            <form onSubmit={handleRegister} className="space-y-4">
              <input name="namaPemilik" placeholder="NAMA PEMILIK" className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none uppercase font-bold text-xs" required />
              <input name="namaUsaha" placeholder="NAMA USAHA" className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none uppercase font-bold text-xs" required />
              <input name="whatsapp" placeholder="NO. WHATSAPP (62...)" className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-xs" required />
              <input name="modalAwal" type="number" placeholder="MODAL AWAL USAHA" className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-bold text-xs" required />
              <input name="email" type="email" placeholder="EMAIL KONFIRMASI" className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-xs" required />
              <button className="w-full bg-blue-600 text-white py-4 rounded-xl font-black hover:bg-blue-700 transition uppercase shadow-lg shadow-blue-100 text-xs tracking-widest">SIMPAN & AKTIFKAN DATABASE</button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col md:flex-row font-sans text-slate-900">
      {/* SIDEBAR */}
      <div className="w-full md:w-72 bg-white border-r border-slate-200 flex flex-col shrink-0">
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-xl text-white">
              <TrendingUp size={20} strokeWidth={3} />
            </div>
            <div>
              <h2 className="font-black text-lg text-slate-800 leading-none tracking-tighter uppercase text-xs">{profile?.namaUsaha}</h2>
              <p className="text-[9px] text-green-500 font-black uppercase tracking-widest mt-1">ONLINE CLOUD</p>
            </div>
          </div>
        </div>
        
        <nav className="flex-1 p-4 space-y-1">
          {[
            { id: 'dashboard', icon: LayoutDashboard, label: 'DASHBOARD' },
            { id: 'input', icon: PlusCircle, label: editingTxId ? 'EDIT DATA' : 'TRANSAKSI BARU' },
            { id: 'history', icon: History, label: 'RIWAYAT' },
            { id: 'calculator', icon: Calculator, label: 'KALKULATOR' },
            { id: 'settings', icon: Settings, label: 'PENGATURAN' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => {
                if (item.id !== 'input') setEditingTxId(null);
                setActiveTab(item.id);
              }}
              className={`w-full flex items-center space-x-3 px-5 py-4 rounded-2xl font-black text-[11px] transition-all duration-200 ${
                activeTab === item.id 
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' 
                  : 'text-slate-500 hover:bg-slate-50 hover:text-blue-600'
              }`}
            >
              <item.icon size={18} strokeWidth={3} />
              <span className="tracking-wider uppercase text-xs">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-100">
          <button 
            onClick={() => window.location.reload()}
            className="w-full flex items-center justify-center space-x-3 px-4 py-3 text-slate-400 hover:text-red-600 rounded-xl transition font-black text-[10px] uppercase tracking-widest"
          >
            <LogOut size={16} />
            <span className="text-xs">KELUAR APLIKASI</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto p-4 md:p-8">
          <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tighter flex items-center gap-2 text-xs">
                {activeTab} <ChevronRight size={20} className="text-slate-300" />
              </h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 italic">PENGELOLA: {profile?.pemilik}</p>
            </div>
            <div className="flex-1 md:flex-none bg-white px-5 py-3 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
                <div className="p-2 bg-green-50 text-green-600 rounded-lg">
                  <Wallet size={18} strokeWidth={3} />
                </div>
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter text-xs">MODAL AWAL</p>
                  <p className="text-sm font-black text-slate-800 text-xs uppercase">RP {profile?.modalAwal.toLocaleString()}</p>
                </div>
            </div>
          </header>

          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  { label: 'TOTAL OMSET', val: stats.omset, color: 'blue', icon: TrendingUp },
                  { label: 'KEUNTUNGAN', val: stats.profit, color: 'green', icon: Wallet },
                  { label: 'PIUTANG PENDING', val: stats.pending, color: 'orange', icon: AlertCircle },
                ].map((card) => (
                  <div key={card.label} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 relative group transition-all hover:shadow-md">
                    <div className="flex justify-between items-start text-xs">
                       <div>
                          <h3 className="text-slate-400 font-black text-[10px] uppercase tracking-widest mb-1 text-xs">{card.label}</h3>
                          <p className="text-2xl font-black text-slate-800 text-xs uppercase">RP {card.val.toLocaleString()}</p>
                       </div>
                       <div className={`p-3 bg-${card.color}-50 text-${card.color}-600 rounded-2xl`}>
                          <card.icon size={24} strokeWidth={3} />
                       </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="bg-white p-6 md:p-10 rounded-[2rem] shadow-sm border border-slate-100">
                <h3 className="font-black text-slate-800 mb-8 uppercase tracking-tighter flex items-center gap-3 text-xs">
                  <div className="w-1.5 h-6 bg-blue-600 rounded-full"></div>
                  STATISTIK TRANSAKSI CLOUD
                </h3>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={transactions.slice().reverse()}>
                      <defs>
                        <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#2563eb" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="tanggal" axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: '800', fill: '#94a3b8'}} />
                      <YAxis axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: '800', fill: '#94a3b8'}} />
                      <Tooltip contentStyle={{borderRadius: '16px', border: 'none', padding: '12px', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                      <Area type="monotone" dataKey="totalTagihan" stroke="#2563eb" fillOpacity={1} fill="url(#colorTotal)" strokeWidth={4} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'input' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              <div className="lg:col-span-2 bg-white p-6 md:p-10 rounded-[2.5rem] shadow-sm border border-slate-100 relative">
                {editingTxId && (
                  <div className="mb-6 flex items-center justify-between bg-orange-50 border border-orange-100 p-4 rounded-2xl">
                    <div className="flex items-center gap-3 text-orange-700">
                      <Edit3 size={18} />
                      <span className="text-[11px] font-black uppercase tracking-widest text-xs">MODAL PENGEDITAN AKTIF</span>
                    </div>
                    <button onClick={resetForm} className="p-2 hover:bg-orange-200 rounded-full text-orange-700"><X size={16} /></button>
                  </div>
                )}
                <form onSubmit={saveTransaction} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 text-xs">TANGGAL TRANSAKSI</label>
                    <input type="date" value={formData.tanggal} onChange={(e) => setFormData({...formData, tanggal: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-50 outline-none font-bold uppercase text-xs" required />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 text-xs">JENIS LAYANAN PPOB</label>
                    <select value={formData.jenisTransaksi} onChange={(e) => setFormData({...formData, jenisTransaksi: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-50 outline-none font-bold uppercase text-xs" required>
                      <option value="">PILIH LAYANAN</option>
                      {config.jenisTransaksi.map(item => <option key={item} value={item}>{item}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 text-xs">NAMA PELANGGAN</label>
                    <input placeholder="MASUKKAN NAMA" value={formData.namaPelanggan} onChange={(e) => setFormData({...formData, namaPelanggan: e.target.value.toUpperCase()})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-50 outline-none font-bold uppercase text-xs" required />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 text-xs">WHATSAPP (62...)</label>
                    <input placeholder="628..." value={formData.noWhatsapp} onChange={(e) => setFormData({...formData, noWhatsapp: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-50 outline-none font-bold text-xs uppercase" required />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 text-xs">NOMINAL TRANSAKSI</label>
                    <input type="number" placeholder="CONTOH: 50000" value={formData.nominal} onChange={(e) => setFormData({...formData, nominal: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-100 outline-none font-black text-blue-600 text-lg uppercase text-xs" required />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 text-xs">SUMBER SALDO</label>
                    <select value={formData.akunBank} onChange={(e) => setFormData({...formData, akunBank: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-50 outline-none font-bold uppercase text-xs" required>
                      <option value="">PILIH AKUN</option>
                      {config.akunBank.map(item => <option key={item} value={item}>{item}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2 text-xs uppercase">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 text-xs">METODE BAYAR</label>
                    <select value={formData.metodeBayar} onChange={(e) => setFormData({...formData, metodeBayar: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-50 outline-none font-bold uppercase text-xs" required>
                      <option value="">PILIH METODE</option>
                      {config.metodeBayar.map(item => <option key={item} value={item}>{item}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2 text-xs uppercase">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 text-xs">STATUS BAYAR</label>
                    <select value={formData.statusBayar} onChange={(e) => setFormData({...formData, statusBayar: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-50 outline-none font-bold uppercase text-xs" required>
                      {config.statusBayar.map(item => <option key={item} value={item}>{item}</option>)}
                    </select>
                  </div>
                  <button className={`md:col-span-2 w-full mt-4 flex items-center justify-center gap-3 py-5 rounded-[1.5rem] font-black transition-all shadow-xl uppercase tracking-widest text-xs ${editingTxId ? 'bg-orange-600 shadow-orange-100 hover:bg-orange-700' : 'bg-blue-600 shadow-blue-100 hover:bg-blue-700'} text-white`}>
                    {editingTxId ? <Save size={18} /> : <PlusCircle size={18} />}
                    {editingTxId ? 'PERBARUI TRANSAKSI' : 'SIMPAN KE CLOUD'}
                  </button>
                </form>
              </div>
              <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white shadow-2xl">
                <h4 className="text-blue-400 font-black text-[10px] uppercase tracking-widest mb-8 flex items-center gap-2 text-xs text-xs">
                  <div className="w-1.5 h-4 bg-blue-400 rounded-full"></div> RINGKASAN TAGIHAN
                </h4>
                <div className="space-y-6">
                  <div className="flex justify-between items-center border-b border-white/5 pb-4">
                    <span className="text-white/40 font-bold uppercase text-[10px] tracking-widest text-xs">NOMINAL</span>
                    <span className="font-black text-lg text-xs uppercase">RP {parseFloat(formData.nominal || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-white/5 pb-4 text-xs">
                    <span className="text-white/40 font-bold uppercase text-[10px] tracking-widest text-xs">FEE / ADMIN</span>
                    <span className="font-black text-green-400 text-xs uppercase">+ RP {calculateFee(formData.nominal).toLocaleString()}</span>
                  </div>
                  <div className="bg-white/5 p-6 rounded-3xl">
                    <p className="text-white/30 font-black text-[9px] uppercase tracking-[0.2em] mb-1">TOTAL HARUS DIBAYAR</p>
                    <p className="text-3xl font-black text-white text-xs uppercase">RP {(parseFloat(formData.nominal || 0) + calculateFee(formData.nominal)).toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
              <div className="p-8 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h3 className="font-black text-slate-800 uppercase tracking-tighter text-xs">DATA RIWAYAT TRANSAKSI</h3>
                <div className="bg-blue-50 text-blue-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase border border-blue-100 text-xs">
                   TOTAL: {transactions.length} ITEM
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50">
                      {['TANGGAL', 'LAYANAN', 'PELANGGAN', 'TOTAL', 'STATUS', 'OPSI'].map(h => (
                        <th key={h} className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 text-xs">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {transactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-8 py-6 text-xs font-black text-slate-500 uppercase">{tx.tanggal}</td>
                        <td className="px-8 py-6">
                          <span className="text-[10px] font-black px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg uppercase whitespace-nowrap text-xs">{tx.jenisTransaksi}</span>
                        </td>
                        <td className="px-8 py-6">
                          <div className="font-black text-slate-800 text-xs uppercase">{tx.namaPelanggan}</div>
                          <div className="text-[9px] font-bold text-slate-400 mt-0.5 uppercase">{tx.noWhatsapp}</div>
                        </td>
                        <td className="px-8 py-6">
                          <p className="font-black text-slate-900 text-xs uppercase text-xs uppercase">RP {tx.totalTagihan.toLocaleString()}</p>
                        </td>
                        <td className="px-8 py-6">
                          <button onClick={() => toggleStatus(tx)} className={`text-[9px] font-black px-4 py-2 rounded-xl uppercase tracking-tighter text-xs ${tx.statusBayar !== config.statusBayar[1] ? 'bg-orange-50 text-orange-600 border border-orange-100' : 'bg-green-50 text-green-600 border border-green-100'}`}>{tx.statusBayar}</button>
                        </td>
                        <td className="px-8 py-6">
                          <div className="flex gap-2">
                            <button onClick={() => handleEditClick(tx)} className="p-2.5 bg-slate-50 text-slate-400 hover:text-blue-600 rounded-xl"><Edit3 size={16} /></button>
                            <button onClick={() => deleteTransaction(tx.id)} className="p-2.5 bg-slate-50 text-slate-400 hover:text-red-600 rounded-xl"><Trash2 size={16} /></button>
                            {tx.statusBayar !== config.statusBayar[1] && (
                              <button 
                                onClick={() => sendWhatsAppNotification(tx)} 
                                className="p-2.5 bg-green-50 text-green-600 hover:bg-green-600 hover:text-white rounded-xl transition-all flex items-center gap-2 px-4"
                                title="KIRIM SEMUA TAGIHAN"
                              >
                                <Send size={16} />
                                <span className="text-[9px] font-black uppercase text-xs">AGREGASI</span>
                              </button>
                            )}
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
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
              <div className="xl:col-span-7 bg-white p-6 md:p-10 rounded-[3rem] shadow-sm border border-slate-100">
                <div className="flex items-center gap-4 mb-8">
                  <div className="p-3 bg-blue-600 text-white rounded-2xl"><Calculator size={24} strokeWidth={3} /></div>
                  <h3 className="font-black text-slate-900 uppercase tracking-tighter text-xl text-xs">KALKULATOR SALDO AKTIF</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {config.akunBank.map((bank) => (
                    <div key={bank} className="space-y-2 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 text-xs"><CreditCard size={12} /> SALDO {bank}</label>
                      <input type="number" placeholder="0" value={bankBalances[bank] || ''} onChange={(e) => setBankBalances({...bankBalances, [bank]: e.target.value})} className="w-full bg-transparent border-b border-slate-200 py-2 focus:border-blue-600 outline-none font-black text-slate-800 text-lg text-xs uppercase" />
                    </div>
                  ))}
                </div>
              </div>
              <div className="xl:col-span-5 space-y-6">
                <div className="bg-blue-600 p-10 rounded-[3rem] shadow-xl shadow-blue-100 text-white relative overflow-hidden">
                   <div className="relative z-10 text-xs">
                    <h3 className="font-black text-white/50 text-[10px] uppercase tracking-[0.2em] mb-2 text-xs">TOTAL ASET RIIL (SALDO + PENDING)</h3>
                    <p className="text-4xl font-black tracking-tighter text-xs uppercase">RP {totalRealtimeAsset.toLocaleString()}</p>
                    <div className="mt-8 pt-6 border-t border-white/10 flex justify-between items-end">
                       <div>
                          <p className="text-white/40 text-[9px] font-black uppercase tracking-widest mb-1 text-xs text-xs">DIBANDINGKAN MODAL AWAL</p>
                          <p className="font-black text-lg text-xs uppercase">RP {profile.modalAwal.toLocaleString()}</p>
                       </div>
                       <div className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase ${totalRealtimeAsset >= profile.modalAwal ? 'bg-green-400/20 text-green-300' : 'bg-red-400/20 text-red-300'} text-xs`}>
                          {totalRealtimeAsset >= profile.modalAwal ? 'MODAL AMAN' : 'MODAL BERKURANG'}
                       </div>
                    </div>
                   </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="max-w-5xl space-y-8">
              <div className="bg-slate-900 p-8 md:p-12 rounded-[3rem] text-white flex flex-col md:flex-row justify-between items-center gap-6">
                <div>
                  <h2 className="text-3xl font-black uppercase tracking-tight mb-2 text-xs">KONFIGURASI MASTER</h2>
                  <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">KUSTOMISASI DATA DROPDOWN DAN IDENTITAS USAHA</p>
                </div>
                <div className="bg-white/5 p-4 rounded-3xl border border-white/10"><Settings className="text-blue-500" size={40} /></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[
                  { label: 'METODE BAYAR', key: 'metodeBayar' },
                  { label: 'JENIS TRANSAKSI', key: 'jenisTransaksi' },
                  { label: 'DAFTAR AKUN BANK', key: 'akunBank' },
                  { label: 'DAFTAR STATUS', key: 'statusBayar' }
                ].map((group) => (
                  <div key={group.key} className="bg-white p-6 md:p-8 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col h-full overflow-hidden">
                    <h4 className="font-black text-slate-800 uppercase tracking-widest text-[10px] mb-6 flex items-center gap-2 text-xs">
                       <div className="w-2 h-2 bg-blue-600 rounded-full"></div> {group.label}
                    </h4>
                    <div className="flex-1 space-y-2 mb-6 h-56 overflow-y-auto pr-3 custom-scrollbar">
                      {config[group.key].map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                          <span className="font-black text-[10px] text-slate-700 uppercase text-xs">{item}</span>
                          <button onClick={() => updateConfig(group.key, config[group.key].filter((_, i) => i !== idx))} className="text-slate-300 hover:text-red-600 p-1"><Trash2 size={14} /></button>
                        </div>
                      ))}
                    </div>
                    <form onSubmit={(e) => { e.preventDefault(); const val = e.target.newItem.value.toUpperCase(); if (val) { updateConfig(group.key, [...config[group.key], val]); e.target.reset(); } }} className="flex items-center gap-2 mt-auto bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
                      <input name="newItem" placeholder={`TAMBAH...`} autoComplete="off" className="flex-1 bg-transparent px-4 py-2 text-[10px] font-black uppercase outline-none text-xs" />
                      <button className="bg-blue-600 text-white p-2.5 rounded-xl flex items-center justify-center hover:bg-slate-900 transition-all"><Plus size={16} strokeWidth={4} /></button>
                    </form>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #f8fafc; margin: 4px 0; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
      `}</style>
    </div>
  );
}
